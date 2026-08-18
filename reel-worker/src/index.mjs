// Peekr reel worker — polls title_reels for status='queued', renders a 9:16
// MP4 (trailer clips + ElevenLabs voice + word captions + brand cards) and
// uploads it to Supabase Storage. Runs forever on Railway.
//
// Env:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   (worker is server-side; no RLS)
//   FAL_KEY                                    (ElevenLabs via fal.ai)
//   REEL_VOICE                                 (optional; ElevenLabs voice)
//   REEL_MUSIC_URL                             (optional; royalty-free bed MP3)
//   POLL_MS                                    (default 15000)

import { createClient } from "@supabase/supabase-js";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { synthesize, DEFAULT_VOICE } from "./tts.mjs";
import { buildAss } from "./ass.mjs";

const run = promisify(execFile);
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const POLL_MS = Number(process.env.POLL_MS || 15000);
const BUCKET = "reels";
const W = 1080, H = 1920;
const HANDLE = "@peekr.social";

const log = (...a) => console.log(new Date().toISOString(), ...a);

// ── Helpers ──────────────────────────────────────────────────────────────────

async function ffprobeDuration(file) {
  const { stdout } = await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]);
  return parseFloat(stdout.trim());
}

async function downloadTrailer(youtubeKey, out) {
  // Best mp4 ≤1080p; no audio needed (we mute it) but keep it simple: -f mp4.
  await run("yt-dlp", [
    "-f", "bv*[ext=mp4][height<=1080]/b[ext=mp4]/b",
    "--no-playlist", "--no-warnings", "-o", out,
    `https://www.youtube.com/watch?v=${youtubeKey}`,
  ], { timeout: 180_000 });
  return out;
}

async function whisperWords(mp3) {
  const { stdout } = await run("python3", [new URL("./whisper_words.py", import.meta.url).pathname, mp3, "es"], { timeout: 300_000, maxBuffer: 20 * 1024 * 1024 });
  return JSON.parse(stdout);
}

// ── Core render ──────────────────────────────────────────────────────────────

async function renderReel(reel) {
  const work = await mkdtemp(join(tmpdir(), "reel-"));
  try {
    const script = reel.script;
    const beats = script.beats;

    // 1) Voice per narrated beat (so we know each beat's exact duration).
    const voice = reel.voice_id || DEFAULT_VOICE;
    const audioParts = [];
    for (let i = 0; i < beats.length; i++) {
      const b = beats[i];
      if (!b.voice) { audioParts.push(null); continue; }
      const p = join(work, `v${i}.mp3`);
      await synthesize(b.voice, p, { voice });
      audioParts.push({ path: p, dur: await ffprobeDuration(p) });
    }

    // 2) Timeline. Silent beats get fixed lengths; narrated = voice + padding.
    const FIXED = { hero_in: 2.2 };
    const PAD = 0.55;
    let cursor = 0;
    const timeline = beats.map((b, i) => {
      const dur = audioParts[i] ? audioParts[i].dur + PAD : (FIXED[b.kind] ?? 2.0);
      const seg = { kind: b.kind, headline: b.headline, start: cursor, end: cursor + dur, audio: audioParts[i] };
      cursor += dur;
      return seg;
    });
    const total = cursor;

    // 3) Narration track: concat voices at their beat offsets (silence between).
    // Build with ffmpeg adelay per part → amix.
    const voiceInputs = [], voiceFilters = [], voiceLabels = [];
    let vi = 0;
    for (const seg of timeline) {
      if (!seg.audio) continue;
      voiceInputs.push("-i", seg.audio.path);
      voiceFilters.push(`[${vi}:a]adelay=${Math.round(seg.start * 1000)}|${Math.round(seg.start * 1000)}[a${vi}]`);
      voiceLabels.push(`[a${vi}]`);
      vi++;
    }
    const narration = join(work, "narration.wav");
    await run("ffmpeg", ["-y", ...voiceInputs, "-filter_complex",
      `${voiceFilters.join(";")};${voiceLabels.join("")}amix=inputs=${vi}:normalize=0,apad=whole_dur=${total.toFixed(2)}[out]`,
      "-map", "[out]", "-ar", "48000", "-ac", "2", narration]);

    // 4) Word timings on the full narration (single Whisper pass → global times).
    const { words } = await whisperWords(narration);

    // 5) Trailer → download, then pick clips: cycle through the trailer, one
    //    slice per beat, skipping the first 3s (studio logos) and using
    //    different offsets so it feels cut, not continuous.
    const trailer = join(work, "trailer.mp4");
    await downloadTrailer(reel.trailer_youtube_key, trailer);
    const tdur = await ffprobeDuration(trailer);
    const usable = Math.max(5, tdur - 6);
    const clipFilters = [];
    const clipLabels = [];
    let ci = 0;
    for (const seg of timeline) {
      const dur = seg.end - seg.start;
      // Spread offsets across the trailer; hero/follow/out reuse later, punchier parts.
      const frac = (ci + 0.5) / timeline.length;
      const off = 3 + Math.min(usable - dur, frac * usable);
      // 9:16 fill: scale trailer to cover 1080x1920 (crop center) for the
      // blurred background, and fit the trailer inside for the sharp layer.
      clipFilters.push(
        `[0:v]trim=start=${off.toFixed(2)}:duration=${dur.toFixed(2)},setpts=PTS-STARTPTS,` +
        `split=2[bg${ci}][fg${ci}];` +
        `[bg${ci}]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},boxblur=30:5,eq=brightness=-0.15[bgb${ci}];` +
        `[fg${ci}]scale=${W}:-2[fgs${ci}];` +
        `[bgb${ci}][fgs${ci}]overlay=(W-w)/2:(H-h)/2[c${ci}]`,
      );
      clipLabels.push(`[c${ci}]`);
      ci++;
    }

    // 6) Compose: concat clips → dark cards for follow/hero_out → ASS text → audio mix.
    const ass = join(work, "text.ass");
    await writeFile(ass, buildAss({ timeline, words, handle: HANDLE, title: reel.title }));

    // Darken card beats (follow / hero_out / hero_in) so the text pops.
    // NOTE: we pass filter_complex as a direct argv string (no shell), so
    // filtergraph escaping applies: commas inside an expression must be
    // escaped as "\," and no quotes are used.
    const darkRanges = timeline
      .filter((s) => ["hero_in", "follow", "hero_out"].includes(s.kind))
      .map((s) => `between(t\\,${s.start.toFixed(2)}\\,${s.end.toFixed(2)})`)
      .join("+");
    const darken = darkRanges ? `,drawbox=x=0:y=0:w=${W}:h=${H}:color=black@0.55:t=fill:enable=${darkRanges}` : "";

    const music = process.env.REEL_MUSIC_URL ? await fetchToFile(process.env.REEL_MUSIC_URL, join(work, "music.mp3")) : null;
    const audioInputs = ["-i", narration, ...(music ? ["-stream_loop", "-1", "-i", music] : [])];
    const audioFilter = music
      ? `[1:a]volume=1.0[nar];[2:a]volume=0.12,atrim=0:${total.toFixed(2)}[mus];[nar][mus]amix=inputs=2:duration=first:normalize=0,afade=t=out:st=${(total - 0.8).toFixed(2)}:d=0.8[aout]`
      : `[1:a]afade=t=out:st=${(total - 0.8).toFixed(2)}:d=0.8[aout]`;

    const out = join(work, "reel.mp4");
    const filterComplex =
      `${clipFilters.join(";")};${clipLabels.join("")}concat=n=${ci}:v=1:a=0,fps=30${darken},` +
      `subtitles=filename=${ass.replace(/([:\\'])/g, "\\$1")}:fontsdir=/usr/share/fonts[vout];${audioFilter}`;

    await run("ffmpeg", ["-y", "-i", trailer, ...audioInputs, "-filter_complex", filterComplex,
      "-map", "[vout]", "-map", "[aout]", "-t", total.toFixed(2),
      "-c:v", "libx264", "-preset", "medium", "-crf", "21", "-pix_fmt", "yuv420p", "-profile:v", "high",
      "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", out], { timeout: 600_000, maxBuffer: 50 * 1024 * 1024 });

    // 7) Thumbnail (frame at 1s of hero) + upload both.
    const thumb = join(work, "thumb.jpg");
    await run("ffmpeg", ["-y", "-ss", "0.8", "-i", out, "-frames:v", "1", "-q:v", "3", thumb]);

    const base = `${reel.id}`;
    const [videoUrl, thumbUrl] = await Promise.all([
      upload(`${base}/reel.mp4`, await readFile(out), "video/mp4"),
      upload(`${base}/thumb.jpg`, await readFile(thumb), "image/jpeg"),
    ]);
    return { videoUrl, thumbUrl, duration: total };
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

async function fetchToFile(url, out) {
  const r = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!r.ok) throw new Error(`music download ${r.status}`);
  await writeFile(out, Buffer.from(await r.arrayBuffer()));
  return out;
}

async function upload(path, buf, contentType) {
  const { error } = await sb.storage.from(BUCKET).upload(path, buf, { contentType, upsert: true, cacheControl: "31536000" });
  if (error) throw new Error(`upload ${path}: ${error.message}`);
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

// ── Poll loop ────────────────────────────────────────────────────────────────

async function claimNext() {
  // Atomic claim: only flip queued→rendering if still queued.
  const { data } = await sb.from("title_reels").select("*").eq("status", "queued").order("created_at").limit(1);
  const r = data?.[0];
  if (!r) return null;
  const { data: claimed } = await sb.from("title_reels")
    .update({ status: "rendering", updated_at: new Date().toISOString() })
    .eq("id", r.id).eq("status", "queued").select("*").maybeSingle();
  return claimed;
}

async function tick() {
  const reel = await claimNext();
  if (!reel) return;
  log(`▶ rendering ${reel.id} — ${reel.title}`);
  try {
    const { videoUrl, thumbUrl, duration } = await renderReel(reel);
    await sb.from("title_reels").update({
      status: "ready", video_url: videoUrl, thumbnail_url: thumbUrl, duration_sec: duration,
      rendered_at: new Date().toISOString(), updated_at: new Date().toISOString(), error: null,
    }).eq("id", reel.id);
    log(`✓ ready ${reel.id} (${duration.toFixed(1)}s)`);
  } catch (e) {
    const msg = e?.stderr ? `${e.message}\n${String(e.stderr).slice(-1500)}` : String(e?.message ?? e);
    log(`✗ failed ${reel.id}: ${msg}`);
    await sb.from("title_reels").update({ status: "failed", error: msg.slice(0, 4000), updated_at: new Date().toISOString() }).eq("id", reel.id);
  }
}

log(`reel worker up — voice=${DEFAULT_VOICE} poll=${POLL_MS}ms`);
for (;;) {
  try { await tick(); } catch (e) { log("tick error", e); }
  await new Promise((r) => setTimeout(r, POLL_MS));
}
