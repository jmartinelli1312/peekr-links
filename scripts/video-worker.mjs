#!/usr/bin/env node
/**
 * Video Stories render worker.
 *
 * Runs on your machine, not on Vercel: a 20-minute narration needs minutes of
 * sustained CPU and an FFmpeg binary, and Vercel functions have neither.
 *
 *   npm run video:worker
 *
 * It polls the job queue over HTTPS, does the heavy lifting locally, and
 * uploads results through short-lived signed URLs. It never holds the Supabase
 * service key, the voice-provider key, or any YouTube token — text-to-speech
 * goes through a backend relay and storage access is per-object.
 *
 * Environment:
 *   VIDEO_STORY_WORKER_SECRET   shared secret (same value as on Vercel)
 *   PEEKR_API_BASE              defaults to https://www.peekr.app
 *   VIDEO_WORKER_POLL_SECONDS   defaults to 15
 */

import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const SUBTITLE_SCRIPT = join(SCRIPTS_DIR, "render-subtitles.py");
const CAPTION_SCRIPT = join(SCRIPTS_DIR, "transcribe-captions.py");

const API_BASE = (process.env.PEEKR_API_BASE || "https://www.peekr.app").replace(/\/$/, "");
const SECRET = process.env.VIDEO_STORY_WORKER_SECRET;
const POLL_SECONDS = Number(process.env.VIDEO_WORKER_POLL_SECONDS || 15);

// Vertical by default (TikTok). The job payload can override these, which is
// how a horizontal YouTube cut gets added later without touching the worker.
const DEFAULT_WIDTH = 1080;
const DEFAULT_HEIGHT = 1920;
const FPS = 30;
/** Bitrate tuned so a 22-minute video lands near 250 MB — small enough for the
 *  publish route to stream to YouTube inside its time budget. */
const VIDEO_BITRATE = "1800k";
const MUSIC_VOLUME = 0.07;

/**
 * Longest a single shot may stay on screen.
 *
 * Scene text is planned from an estimated speaking rate, so a scene can turn
 * out much longer than intended once the real narration exists. Anything past
 * this is split into extra segments here, each pulling a different clip — the
 * renderer, not the estimate, is what decides visual pacing.
 */
const MAX_SEGMENT_SECONDS = 11;
const MIN_SEGMENT_SECONDS = 4;

/** Where the Peekr intro card is allowed to land, and where it aims for. */
const HOOK_MIN_SECONDS = 12;
const HOOK_MAX_SECONDS = 45;
const HOOK_TARGET_SECONDS = 25;

if (!SECRET) {
  console.error("Falta VIDEO_STORY_WORKER_SECRET.");
  process.exit(1);
}

// ── Small helpers ────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function run(command, args, { capture = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit" });
    let stdout = "";
    let stderr = "";
    if (capture) {
      child.stdout.on("data", (d) => (stdout += d));
      child.stderr.on("data", (d) => (stderr += d));
    }
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(`${command} salió con código ${code}${stderr ? `: ${stderr.slice(-800)}` : ""}`));
    });
  });
}

const ffmpeg = (args) => run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args]);

async function probeDuration(path) {
  const out = await run(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
    { capture: true }
  );
  const seconds = Number(out);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error(`No se pudo leer la duración de ${path}`);
  }
  return seconds;
}

async function probeSampleRate(path) {
  const out = await run(
    "ffprobe",
    ["-v", "error", "-select_streams", "a:0", "-show_entries", "stream=sample_rate", "-of", "csv=p=0", path],
    { capture: true }
  );
  const rate = Number(out);
  return Number.isFinite(rate) && rate > 0 ? rate : 24_000;
}

async function download(url, destination) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Descarga falló (HTTP ${res.status})`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(destination));
  return destination;
}

const authHeaders = { Authorization: `Bearer ${SECRET}` };

async function claimJob() {
  const res = await fetch(`${API_BASE}/api/admin/video-stories/jobs`, { headers: authHeaders });
  if (res.status === 204) return null;
  if (!res.ok) throw new Error(`No se pudo tomar un job (HTTP ${res.status})`);
  return res.json();
}

async function reportJob(jobId, status, extra = {}) {
  const res = await fetch(`${API_BASE}/api/admin/video-stories/jobs`, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ job_id: jobId, status, ...extra }),
  });
  if (!res.ok) {
    console.error(`  ⚠ No se pudo reportar el job (HTTP ${res.status})`);
  }
}

/** Uploads a local file to the signed URL the API handed us. */
async function uploadSigned(signedUrl, filePath, contentType) {
  const body = await readFile(filePath);
  const res = await fetch(signedUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType, "x-upsert": "true" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Subida falló (HTTP ${res.status}): ${(await res.text()).slice(0, 200)}`);
  }
}

// ── Audio job ────────────────────────────────────────────────────────────────

async function runAudioJob(job, workDir) {
  const { chunks, voice_id: voiceId, style, speed } = job;
  if (!Array.isArray(chunks) || chunks.length === 0) {
    throw new Error("El job de audio no trae texto");
  }
  if (!job.upload_url) throw new Error("El job de audio no trae URL de subida");

  console.log(`  Sintetizando ${chunks.length} fragmentos con la voz ${voiceId}…`);

  const parts = [];
  let sampleRate = 24_000;

  for (let i = 0; i < chunks.length; i++) {
    // Synthesis goes through the backend relay so the voice key stays there.
    const res = await fetch(`${API_BASE}/api/admin/video-stories/tts`, {
      method: "POST",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ text: chunks[i], voice_id: voiceId, style }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`TTS falló en el fragmento ${i + 1}: ${detail.slice(0, 200)}`);
    }

    const payload = await res.json();
    sampleRate = payload.sample_rate || sampleRate;
    parts.push(Buffer.from(payload.pcm_base64, "base64"));

    if ((i + 1) % 10 === 0 || i === chunks.length - 1) {
      console.log(`    ${i + 1}/${chunks.length}`);
    }
  }

  const rawPath = join(workDir, "narracion.pcm");
  await writeFile(rawPath, Buffer.concat(parts));

  // The word count was calculated for playback at `speed`, so the encode has
  // to actually apply it. atempo only accepts 0.5–2.0 per instance; chain it
  // for anything outside that range.
  const tempo = Number(speed) || 1;
  const filters = [];
  let remaining = tempo;
  while (remaining > 2.0) {
    filters.push("atempo=2.0");
    remaining /= 2.0;
  }
  while (remaining < 0.5) {
    filters.push("atempo=0.5");
    remaining /= 0.5;
  }
  if (Math.abs(remaining - 1) > 0.001) filters.push(`atempo=${remaining.toFixed(4)}`);

  const outPath = join(workDir, "narracion.m4a");
  await ffmpeg([
    "-f", "s16le",
    "-ar", String(sampleRate),
    "-ac", "1",
    "-i", rawPath,
    ...(filters.length ? ["-filter:a", filters.join(",")] : []),
    "-c:a", "aac",
    "-b:a", "128k",
    outPath,
  ]);

  const duration = await probeDuration(outPath);
  console.log(`  Audio listo: ${(duration / 60).toFixed(1)} min`);

  await uploadSigned(job.upload_url, outPath, "audio/mp4");

  // Caption timing is read off the finished file, after atempo — so it is the
  // same timeline the viewer hears and needs no scaling. Whisper supplies the
  // anchors; the script supplies the text. See transcribe-captions.py.
  if (job.subtitles_upload_url) {
    const scriptPath = join(workDir, "guion.txt");
    await writeFile(scriptPath, chunks.join(" "), "utf8");
    const subsPath = join(workDir, "subtitulos.json");

    console.log("  Alineando subtítulos con el audio (Whisper, unos minutos)…");
    await run("python3", [CAPTION_SCRIPT, outPath, scriptPath, subsPath]);

    await uploadSigned(job.subtitles_upload_url, subsPath, "application/json");
  }

  return { duration_seconds: duration };
}

// ── Video job ────────────────────────────────────────────────────────────────

/**
 * Ken Burns filter for stills.
 *
 * A static frame held for 30+ seconds reads as a slideshow, so each still gets
 * a slow push in or out. Direction alternates by scene so consecutive images
 * don't drift the same way.
 *
 * The image is upscaled before zoompan runs: zoompan steps in whole source
 * pixels, so zooming a 1080p frame directly produces visible judder. Working
 * at 1440p and outputting 1080p keeps the motion smooth, and 2560px covers the
 * widest crop the zoom ever needs.
 */
function kenBurnsFilter(seconds, zoomIn, width, height) {
  const frames = Math.max(2, Math.round(seconds * FPS));
  const MAX_ZOOM = 1.12;
  const step = (MAX_ZOOM - 1) / frames;

  const z = zoomIn
    ? `min(zoom+${step.toFixed(6)},${MAX_ZOOM})`
    : `if(eq(on,0),${MAX_ZOOM},max(zoom-${step.toFixed(6)},1.0))`;

  // Work 1.33x above the output so zoompan's whole-pixel stepping doesn't judder.
  const iw = Math.round((width * 4) / 3);
  const ih = Math.round((height * 4) / 3);

  return [
    `scale=${iw}:${ih}:force_original_aspect_ratio=increase`,
    `crop=${iw}:${ih}`,
    // Centred push: x/y keep the focal point in the middle as zoom changes.
    `zoompan=z='${z}':d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${width}x${height}:fps=${FPS}`,
    `setsar=1`,
    `format=yuv420p`,
  ].join(",");
}

/**
 * Normalises any clip or still into a silent, fixed-length 1080p segment.
 * Stills get the Ken Burns treatment; real footage already has motion, so it
 * is only scaled and cropped.
 *
 * `offset` is where inside the source clip this segment starts. It is what
 * keeps a small library from looking small: the same 40-second clip used four
 * times shows four different stretches instead of replaying its first seconds.
 * `loop` is only set when the clip is genuinely too short to fill the segment.
 */
async function normalizeSegment(
  input,
  seconds,
  outPath,
  isImage,
  {
    sceneIndex = 0,
    clipSpeed = 1,
    width = DEFAULT_WIDTH,
    height = DEFAULT_HEIGHT,
    offset = 0,
    loop = false,
  } = {}
) {
  // B-roll runs sped up to match the narration's own 1.5x. Slow footage under
  // fast speech reads as a mismatch and kills the energy the format lives on.
  // setpts only touches video — these segments are muxed silent anyway.
  const speedFilter =
    clipSpeed && Math.abs(clipSpeed - 1) > 0.01 ? `setpts=PTS/${clipSpeed.toFixed(4)},` : "";

  const vf = isImage
    ? kenBurnsFilter(seconds, sceneIndex % 2 === 0, width, height)
    : `${speedFilter}scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1,format=yuv420p`;

  await ffmpeg([
    // -stream_loop and an input seek don't combine cleanly, so the caller only
    // ever asks for one of them.
    ...(isImage ? ["-loop", "1"] : loop ? ["-stream_loop", "-1"] : []),
    ...(!isImage && offset > 0.05 ? ["-ss", offset.toFixed(3)] : []),
    "-i", input,
    "-t", seconds.toFixed(3),
    "-vf", vf,
    "-r", String(FPS),
    "-an",
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-b:v", VIDEO_BITRATE,
    outPath,
  ]);
  return outPath;
}

async function concatSegments(paths, workDir, outName) {
  const listPath = join(workDir, `${outName}.txt`);
  await writeFile(listPath, paths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n"));
  const outPath = join(workDir, `${outName}.mp4`);
  await ffmpeg(["-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", outPath]);
  return outPath;
}

/**
 * Where the intro card cuts in.
 *
 * It used to be "wherever scene 0 happened to end", which is a share-of-words
 * figure with no relation to the sentences — so the narration was chopped
 * mid-word, and any caption straddling the cut stayed on screen through the
 * logo. Snapping to the end of a spoken sentence fixes both: the hook finishes
 * its thought, and no caption spans the insert.
 */
function pickHookEnd(captions, fallback) {
  if (!captions.length) return fallback;

  const sentenceEnds = captions.filter((c) => /[.!?…]["'”’)\]]*$/.test(c.text.trim()));
  const pool = sentenceEnds.length ? sentenceEnds : captions;
  const inRange = pool.filter((c) => c.end >= HOOK_MIN_SECONDS && c.end <= HOOK_MAX_SECONDS);
  const candidates = inRange.length ? inRange : pool;

  let best = candidates[0];
  for (const caption of candidates) {
    if (
      Math.abs(caption.end - HOOK_TARGET_SECONDS) < Math.abs(best.end - HOOK_TARGET_SECONDS)
    ) {
      best = caption;
    }
  }
  return best.end;
}

/**
 * Cuts the narration into the shots the video will actually show.
 *
 * Scene text is planned server-side from an estimated speaking rate, so a
 * "scene" can easily land at 20-40 seconds once the real narration exists —
 * far too long for one stock clip, which is what made the footage look like it
 * repeated. Every scene is subdivided here until no shot exceeds
 * MAX_SEGMENT_SECONDS.
 */
function planSegments(scenes, narrationDuration) {
  const totalWords = scenes.reduce((sum, s) => sum + Math.max(1, s.words || 1), 0);
  const segments = [];

  for (let i = 0; i < scenes.length; i++) {
    const share = (Math.max(1, scenes[i].words || 1) / totalWords) * narrationDuration;
    const pieces = Math.max(1, Math.ceil(share / MAX_SEGMENT_SECONDS));
    const each = share / pieces;
    for (let p = 0; p < pieces; p++) {
      segments.push({ sceneIndex: i, seconds: each, preferredUrl: scenes[i].asset_url });
    }
  }
  return segments;
}

/**
 * Hands out clips so a small library stops looking like a small library.
 *
 * Two rules do the work. Least-used-first spreads the shots evenly instead of
 * hammering whichever category the rotation lands on. And each clip keeps its
 * own playhead, so its second appearance starts where its first one ended —
 * one 60-second clip is five different shots, not the same shot five times.
 */
function createClipLibrary(urls, clipSpeed) {
  const clips = urls.map((url) => ({ url, uses: 0, cursor: 0, duration: null, path: null }));
  const byUrl = new Map(clips.map((c) => [c.url, c]));
  let previous = null;

  return {
    clips,
    /** Picks the next clip, preferring the one the scene plan suggested. */
    take(preferredUrl) {
      const preferred = byUrl.get(preferredUrl);
      const usable = clips.filter((c) => c !== previous || clips.length === 1);
      const pool =
        preferred && preferred !== previous && preferred.uses === Math.min(...usable.map((c) => c.uses))
          ? [preferred]
          : usable;

      let best = pool[0];
      for (const clip of pool) if (clip.uses < best.uses) best = clip;

      best.uses++;
      previous = best;
      return best;
    },
    /** Consumes `seconds` of finished video from this clip and says from where. */
    advance(clip, seconds) {
      // Playback speed means a 10-second shot eats 15 seconds of source.
      const consumed = seconds * clipSpeed;
      if (!clip.duration || clip.duration <= consumed + 0.5) {
        return { offset: 0, loop: !clip.duration || clip.duration < consumed };
      }
      if (clip.cursor + consumed > clip.duration) {
        // Out of fresh material. Restart staggered by half a shot so the second
        // pass cuts at different moments instead of replaying the first.
        clip.passes = (clip.passes ?? 0) + 1;
        const room = clip.duration - consumed;
        clip.cursor = room > 0 ? ((consumed * 0.5 * clip.passes) % room) : 0;
      }
      const offset = clip.cursor;
      clip.cursor += consumed;
      return { offset, loop: false };
    },
  };
}

async function runVideoJob(job, workDir) {
  if (!job.audio_url) throw new Error("El job de video no trae narración");
  if (!job.upload_url) throw new Error("El job de video no trae URL de subida");

  const scenes = (job.scenes || []).filter((s) => s.asset_url);
  if (scenes.length === 0) {
    throw new Error("Ninguna escena tiene recurso visual. Sube material a video-story-assets.");
  }

  console.log("  Descargando narración…");
  const narrationPath = await download(job.audio_url, join(workDir, "narracion.m4a"));
  const narrationDuration = await probeDuration(narrationPath);

  const clipSpeed = Number(job.clip_speed) || 1;
  const width = Number(job.width) || DEFAULT_WIDTH;
  const height = Number(job.height) || DEFAULT_HEIGHT;

  // ── Captions ───────────────────────────────────────────────────────────────
  // Loaded before anything else: the intro's position is derived from them.
  let captions = [];
  if (job.subtitles_url) {
    const rawSubs = await download(job.subtitles_url, join(workDir, "subtitulos.json"));
    captions = JSON.parse(await readFile(rawSubs, "utf8"));
  }

  // ── Shot list ──────────────────────────────────────────────────────────────
  const segments = planSegments(scenes, narrationDuration);

  // The hook is every shot up to the sentence the intro cuts after. Shots are
  // then stretched or trimmed so the boundary lands exactly there.
  const hookEnd = pickHookEnd(captions, segments[0].seconds);
  let elapsed = 0;
  let hookSegments = 0;
  for (const segment of segments) {
    if (elapsed + segment.seconds / 2 > hookEnd) break;
    elapsed += segment.seconds;
    hookSegments++;
  }
  hookSegments = Math.max(1, Math.min(hookSegments, segments.length - 1));

  // Rescale so the hook's shots cover exactly [0, hookEnd] and the rest cover
  // exactly the remaining narration. Without this the visual cut and the audio
  // cut land in different places.
  const plannedHook = segments.slice(0, hookSegments).reduce((s, x) => s + x.seconds, 0);
  const plannedRest = narrationDuration - plannedHook;
  const hookScale = plannedHook > 0 ? hookEnd / plannedHook : 1;
  const restScale = plannedRest > 0 ? (narrationDuration - hookEnd) / plannedRest : 1;
  segments.forEach((segment, i) => {
    segment.seconds = Math.max(
      MIN_SEGMENT_SECONDS / 2,
      segment.seconds * (i < hookSegments ? hookScale : restScale)
    );
  });

  // ── Clips ──────────────────────────────────────────────────────────────────
  const urls = [...new Set(scenes.map((s) => s.asset_url))];
  const library = createClipLibrary(urls, clipSpeed);

  console.log(`  Descargando ${urls.length} clips…`);
  let footageSeconds = 0;
  for (let i = 0; i < library.clips.length; i++) {
    const clip = library.clips[i];
    const isImage = /\.(jpg|jpeg|png|webp)(\?|$)/i.test(clip.url);
    clip.isImage = isImage;
    clip.path = await download(clip.url, join(workDir, `clip-${i}${isImage ? ".img" : ".mp4"}`));
    if (!isImage) {
      clip.duration = await probeDuration(clip.path).catch(() => null);
      footageSeconds += clip.duration ?? 0;
    }
  }

  // Coverage is the number worth watching: at 1.0x every shot in the video can
  // be a different stretch of footage. Below that, material starts repeating no
  // matter how the clips are ordered.
  const needed = narrationDuration * clipSpeed;
  console.log(
    `  ${urls.length} clips — ${(footageSeconds / 60).toFixed(1)} min de material para ` +
      `${(needed / 60).toFixed(1)} min de metraje (cobertura ${(footageSeconds / needed).toFixed(2)}x)`
  );
  if (footageSeconds > 0 && footageSeconds < needed) {
    console.log(
      `    ⚠ Falta material: sube ~${Math.ceil((needed - footageSeconds) / 60)} min más para no repetir tomas.`
    );
  }

  console.log(`  Renderizando ${segments.length} tomas — ${width}x${height}, clips a ${clipSpeed}x…`);
  const sceneSegments = [];
  for (let i = 0; i < segments.length; i++) {
    const clip = library.take(segments[i].preferredUrl);
    const { offset, loop } = library.advance(clip, segments[i].seconds);
    sceneSegments.push(
      await normalizeSegment(clip.path, segments[i].seconds, join(workDir, `toma-${i}.mp4`), clip.isImage, {
        sceneIndex: i,
        clipSpeed,
        width,
        height,
        offset,
        loop,
      })
    );
    if ((i + 1) % 10 === 0 || i === segments.length - 1) {
      console.log(`    ${i + 1}/${segments.length}`);
    }
  }

  // Peekr's intro sits after the hook and the outro closes the video. Both are
  // silent inserts, so the narration is split around the intro and padded with
  // silence — otherwise everything after it drifts out of sync.
  let introSegment = null;
  let introDuration = 0;
  if (job.branding?.intro_url) {
    const introSource = await download(job.branding.intro_url, join(workDir, "intro-src.mp4"));
    introDuration = Math.min(await probeDuration(introSource), 8);
    introSegment = await normalizeSegment(
      introSource, introDuration, join(workDir, "intro.mp4"), false, { width, height }
    );
  }

  let outroSegment = null;
  let outroDuration = 0;
  if (job.branding?.outro_url) {
    const outroSource = await download(job.branding.outro_url, join(workDir, "outro-src.mp4"));
    outroDuration = Math.min(await probeDuration(outroSource), 15);
    outroSegment = await normalizeSegment(
      outroSource, outroDuration, join(workDir, "outro.mp4"), false, { width, height }
    );
  }

  const visualOrder = [
    ...sceneSegments.slice(0, hookSegments),
    ...(introSegment ? [introSegment] : []),
    ...sceneSegments.slice(hookSegments),
    ...(outroSegment ? [outroSegment] : []),
  ];
  const silentVideo = await concatSegments(visualOrder, workDir, "cuerpo");

  // Matching audio timeline: hook → silence(intro) → rest → silence(outro).
  //
  // Done in one filter graph rather than by cutting and re-concatenating files.
  // The old version stream-copied AAC (which can only cut on a ~43 ms packet
  // boundary) and generated its silence at 44.1 kHz against 24 kHz narration —
  // a parameter mismatch the concat demuxer papers over with non-monotonic
  // timestamps. atrim cuts on the sample, and the silence is generated at the
  // narration's own rate.
  let narrationTrack = narrationPath;
  if (introDuration > 0 || outroDuration > 0) {
    const sampleRate = await probeSampleRate(narrationPath);
    const inputs = ["-i", narrationPath];
    const parts = [
      `[0:a]atrim=start=0:end=${hookEnd.toFixed(3)},asetpts=N/SR/TB[hook]`,
      `[0:a]atrim=start=${hookEnd.toFixed(3)},asetpts=N/SR/TB[rest]`,
    ];
    const order = ["[hook]"];
    let next = 1;

    if (introDuration > 0) {
      inputs.push(
        "-f", "lavfi",
        "-t", introDuration.toFixed(3),
        "-i", `anullsrc=channel_layout=mono:sample_rate=${sampleRate}`
      );
      order.push(`[${next++}:a]`);
    }
    order.push("[rest]");
    if (outroDuration > 0) {
      inputs.push(
        "-f", "lavfi",
        "-t", outroDuration.toFixed(3),
        "-i", `anullsrc=channel_layout=mono:sample_rate=${sampleRate}`
      );
      order.push(`[${next++}:a]`);
    }

    parts.push(`${order.join("")}concat=n=${order.length}:v=0:a=1[aout]`);

    narrationTrack = join(workDir, "narracion-final.m4a");
    await ffmpeg([
      ...inputs,
      "-filter_complex", parts.join(";"),
      "-map", "[aout]",
      "-c:a", "aac", "-b:a", "128k",
      narrationTrack,
    ]);
  }

  // ── Subtitles ──────────────────────────────────────────────────────────────
  // Rendered as an alpha track and overlaid, because this FFmpeg has no libass.
  let subtitleConcat = null;
  if (captions.length) {
    // Captions were timed against the narration alone. The finished video
    // inserts the silent intro right after the hook, so everything spoken
    // after that point shifts by exactly the intro's length. hookEnd is a
    // caption boundary, so no line is split across the insert.
    const shifted = captions.map((c) => ({
      text: c.text,
      start: c.start >= hookEnd ? c.start + introDuration : c.start,
      end: c.end > hookEnd ? c.end + introDuration : c.end,
    }));

    const shiftedPath = join(workDir, "subtitulos-final.json");
    await writeFile(shiftedPath, JSON.stringify(shifted));

    const subsDir = join(workDir, "subs");
    const totalSeconds = await probeDuration(silentVideo);
    console.log(`  Dibujando ${shifted.length} subtítulos…`);
    await run("python3", [
      SUBTITLE_SCRIPT,
      shiftedPath,
      subsDir,
      String(width),
      String(height),
      totalSeconds.toFixed(3),
    ]);
    subtitleConcat = join(subsDir, "concat.txt");
  }

  // Final pass: mux narration, duck in the background music, stamp the logo.
  console.log("  Mezclando audio, música, subtítulos y branding…");
  const outPath = join(workDir, "video.mp4");
  const inputs = ["-i", silentVideo, "-i", narrationTrack];
  const filters = [];
  // Bare pad name, never bracketed. Every filter template below wraps it in
  // its own brackets — storing "[0:v]" here produced "[[0:v]]", which FFmpeg
  // rejects with "Trailing garbage after a filter".
  let videoPad = "0:v";
  let audioLabel = "1:a";
  let nextInput = 2;

  if (job.music_url) {
    const musicPath = await download(job.music_url, join(workDir, "musica.m4a"));
    inputs.push("-stream_loop", "-1", "-i", musicPath);
    filters.push(
      `[${nextInput}:a]volume=${MUSIC_VOLUME}[mus]`,
      `[1:a][mus]amix=inputs=2:duration=first:dropout_transition=0[aout]`
    );
    audioLabel = "[aout]";
    nextInput++;
  }

  if (subtitleConcat) {
    inputs.push("-f", "concat", "-safe", "0", "-i", subtitleConcat);
    filters.push(
      `[${nextInput}:v]format=rgba,scale=${width}:${height}[subs]`,
      `[${videoPad}][subs]overlay=0:0:format=auto:shortest=1[vsub]`
    );
    videoPad = "vsub";
    nextInput++;
  }

  if (job.branding?.logo_url) {
    const logoPath = await download(job.branding.logo_url, join(workDir, "logo.png"));
    inputs.push("-i", logoPath);
    // Chains onto whatever the video pad is by now — overlaying 0:v here
    // would silently drop the subtitle track composited a step earlier.
    filters.push(
      // Sized as a share of frame width so it stays discreet in both
      // orientations instead of dominating the narrower vertical cut.
      `[${nextInput}:v]scale=${Math.round(width * 0.11)}:-1[logo]`,
      `[${videoPad}][logo]overlay=W-w-${Math.round(width * 0.04)}:H-h-${Math.round(height * 0.04)}:format=auto[vlogo]`
    );
    videoPad = "vlogo";
    nextInput++;
  }

  // Any video filtering means the stream has to be re-encoded; with none we
  // can stream-copy and save minutes.
  const videoWasFiltered = videoPad !== "0:v";
  if (videoWasFiltered) {
    filters.push(`[${videoPad}]format=yuv420p[vout]`);
    videoPad = "vout";
  }

  // -map takes a bare specifier for an input stream but a bracketed label for
  // a filter output.
  const videoMap = videoWasFiltered ? `[${videoPad}]` : videoPad;

  await ffmpeg([
    ...inputs,
    ...(filters.length ? ["-filter_complex", filters.join(";")] : []),
    "-map", videoMap,
    "-map", audioLabel,
    "-c:v", videoWasFiltered ? "libx264" : "copy",
    ...(videoWasFiltered ? ["-preset", "veryfast", "-b:v", VIDEO_BITRATE] : []),
    "-c:a", "aac",
    "-b:a", "160k",
    "-shortest",
    "-movflags", "+faststart",
    outPath,
  ]);

  const duration = await probeDuration(outPath);
  console.log(`  Video listo: ${(duration / 60).toFixed(1)} min`);

  await uploadSigned(job.upload_url, outPath, "video/mp4");
  return { duration_seconds: duration };
}

// ── Main loop ────────────────────────────────────────────────────────────────

async function processOne() {
  const job = await claimJob();
  if (!job) return false;

  console.log(`\n▶ Job ${job.kind} — ${job.story_title}`);
  const workDir = await mkdtemp(join(tmpdir(), "peekr-video-"));

  try {
    const result =
      job.kind === "audio" ? await runAudioJob(job, workDir) : await runVideoJob(job, workDir);
    await reportJob(job.job_id, "done", result);
    console.log("✔ Listo");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`✖ ${message}`);
    await reportJob(job.job_id, "error", { error_message: message });
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }

  return true;
}

async function main() {
  try {
    await run("ffmpeg", ["-version"], { capture: true });
    await run("ffprobe", ["-version"], { capture: true });
  } catch {
    console.error("Falta FFmpeg. En macOS: brew install ffmpeg");
    process.exit(1);
  }

  // Subtitles are drawn with Pillow because this FFmpeg has no libass, and
  // timed with faster-whisper because arithmetic on character counts drifts.
  try {
    await run("python3", ["-c", "import PIL"], { capture: true });
  } catch {
    console.error(
      "Falta Pillow (se usa para dibujar los subtítulos).\n" +
        "  python3 -m pip install --user Pillow"
    );
    process.exit(1);
  }

  try {
    await run("python3", ["-c", "import faster_whisper"], { capture: true });
  } catch {
    console.error(
      "Falta faster-whisper (se usa para sincronizar los subtítulos con la voz).\n" +
        "  python3 -m pip install --user faster-whisper"
    );
    process.exit(1);
  }

  console.log(`Worker de Video Stories conectado a ${API_BASE}`);
  console.log(`Consultando la cola cada ${POLL_SECONDS}s. Ctrl+C para salir.\n`);

  for (;;) {
    try {
      // Drain the queue before sleeping, so a backlog doesn't trickle out one
      // job per poll interval.
      const worked = await processOne();
      if (!worked) await sleep(POLL_SECONDS * 1000);
    } catch (err) {
      console.error(`Error consultando la cola: ${err instanceof Error ? err.message : err}`);
      await sleep(POLL_SECONDS * 1000);
    }
  }
}

main();
