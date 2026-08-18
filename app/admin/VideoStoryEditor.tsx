"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, apiBlobGet, apiBlobUrl, apiGet, apiSend } from "./videoStoriesApi";
import {
  GENRE_LABELS,
  GENRES,
  STATUS_COLORS,
  STATUS_LABELS,
  countWords,
  estimateMinutes,
  formatMinutes,
  targetWordRange,
  type Genre,
  type StoryReview,
  type StoryStatus,
  type VideoStorySettings,
} from "@/lib/video-stories/types";

interface Story {
  id: string;
  internal_title: string;
  youtube_title: string | null;
  youtube_description: string | null;
  genre: string;
  premise: string | null;
  script: string | null;
  hook: string | null;
  midpoint_twist: string | null;
  ending: string | null;
  cta: string | null;
  word_count: number;
  estimated_minutes: number;
  status: StoryStatus;
  review_json: StoryReview | null;
  error_message: string | null;
  voice_id: string | null;
  voice_speed: number;
  audio_duration_seconds: number | null;
  video_duration_seconds: number | null;
  youtube_video_id: string | null;
  youtube_visibility: "private" | "unlisted" | "public";
}

interface Job {
  id: string;
  kind: "audio" | "video";
  status: "queued" | "running" | "done" | "error";
  error_message: string | null;
  created_at: string;
}

interface Voice {
  id: string;
  label: string;
  description: string;
}

const REVIEW_LABELS: Record<keyof Omit<StoryReview, "verdict" | "notas">, string> = {
  coherencia: "Coherencia",
  repeticiones: "Repeticiones",
  originalidad: "Originalidad",
  duracion: "Duración",
  gancho: "Gancho",
  final: "Final",
};

/** Statuses where a background job is running and the view should keep polling. */
const BUSY_STATUSES = new Set<StoryStatus>(["generating_audio", "generating_video"]);

export default function VideoStoryEditor({
  storyId,
  onClose,
}: {
  storyId: string;
  onClose: () => void;
}) {
  const [story, setStory] = useState<Story | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [settings, setSettings] = useState<VideoStorySettings | null>(null);
  const [voices, setVoices] = useState<Voice[]>([]);

  const [title, setTitle] = useState("");
  const [youtubeTitle, setYoutubeTitle] = useState("");
  const [genre, setGenre] = useState<Genre>("infidelidad");
  const [script, setScript] = useState("");
  const [cta, setCta] = useState("");
  const [voiceId, setVoiceId] = useState("");

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const [sampleUrl, setSampleUrl] = useState<string | null>(null);
  const [sampleVoice, setSampleVoice] = useState<string>("");
  const [covers, setCovers] = useState<{ tiktok?: string; youtube?: string }>({});
  const [media, setMedia] = useState<{ audio_url: string | null; video_url: string | null }>({
    audio_url: null,
    video_url: null,
  });

  const [confirmPublish, setConfirmPublish] = useState(false);
  const [visibility, setVisibility] = useState<"private" | "unlisted" | "public">("private");
  const [youtube, setYoutube] = useState<{ connected: boolean; channel_title: string | null } | null>(
    null
  );

  const sampleUrlRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiGet<{ story: Story; jobs: Job[] }>(
        `/api/admin/video-stories/${storyId}`
      );
      setStory(data.story);
      setJobs(data.jobs);
      setTitle(data.story.internal_title);
      setYoutubeTitle(data.story.youtube_title ?? "");
      setGenre(data.story.genre as Genre);
      setScript(data.story.script ?? "");
      setCta(data.story.cta ?? "");
      setVoiceId(data.story.voice_id ?? "");
      setVisibility(data.story.youtube_visibility);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [storyId]);

  useEffect(() => {
    // Fetch-on-mount. The state updates land in async callbacks, which is the
    // intended shape — the rule flags the call site regardless.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useEffect(() => {
    apiGet<{ settings: VideoStorySettings }>("/api/admin/video-stories/settings")
      .then((d) => setSettings(d.settings))
      .catch(() => undefined);
    apiGet<{ voices: Voice[] }>("/api/admin/video-stories/voices")
      .then((d) => setVoices(d.voices))
      .catch(() => undefined);
    apiGet<{ connected: boolean; channel_title: string | null }>(
      "/api/admin/video-stories/youtube/status"
    )
      .then(setYoutube)
      .catch(() => undefined);
  }, []);

  // While a render is running the worker owns the row, so poll instead of
  // waiting for the admin to refresh.
  useEffect(() => {
    if (!story || !BUSY_STATUSES.has(story.status)) return;
    const timer = setInterval(() => void load(), 10_000);
    return () => clearInterval(timer);
  }, [story, load]);

  const refreshMedia = useCallback(async () => {
    try {
      setMedia(
        await apiGet<{ audio_url: string | null; video_url: string | null }>(
          `/api/admin/video-stories/${storyId}/media`
        )
      );
    } catch {
      /* signed URLs are best-effort; the buttons stay hidden without them */
    }
  }, [storyId]);

  useEffect(() => {
    if (story && (story.status === "audio_ready" || story.status === "video_ready" || story.status === "published")) {
      // Signed URLs expire, so they are minted when the status says there is
      // media to show rather than being stored with the row.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void refreshMedia();
    }
  }, [story, refreshMedia]);

  // Object URLs for voice samples are revoked so repeated previews don't leak.
  useEffect(() => {
    sampleUrlRef.current = sampleUrl;
  }, [sampleUrl]);
  useEffect(() => {
    return () => {
      if (sampleUrlRef.current) URL.revokeObjectURL(sampleUrlRef.current);
    };
  }, []);

  const liveWordCount = useMemo(() => countWords(script) + countWords(cta), [script, cta]);
  const liveMinutes = useMemo(
    () => (settings ? estimateMinutes(liveWordCount, settings) : 0),
    [liveWordCount, settings]
  );
  const range = useMemo(() => (settings ? targetWordRange(settings) : null), [settings]);
  const inRange = range ? liveWordCount >= range.min && liveWordCount <= range.max : true;

  /**
   * Wraps an action with busy/error handling, and turns the API's 409 "locked"
   * response into a confirmation prompt.
   *
   * The callback receives `confirmed` as an argument rather than reading it
   * from state: a setState here would not be visible to the retry, so the
   * second attempt would send the same unconfirmed body and 409 again.
   */
  async function run<T>(
    key: string,
    fn: (confirmed: boolean) => Promise<T>
  ): Promise<T | null> {
    setBusy(key);
    setError("");
    setInfo("");
    try {
      return await fn(false);
    } catch (err) {
      if (err instanceof ApiError && err.code === "locked") {
        if (window.confirm(`${err.message}\n\n¿Continuar?`)) {
          try {
            return await fn(true);
          } catch (retryErr) {
            setError(retryErr instanceof Error ? retryErr.message : String(retryErr));
            return null;
          }
        }
        return null;
      }
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    const result = await run("save", (confirmed) =>
      apiSend<{ story: Story }>(`/api/admin/video-stories/${storyId}`, "PATCH", {
        internal_title: title,
        youtube_title: youtubeTitle,
        genre,
        script,
        cta,
        voice_id: voiceId || undefined,
        confirm_overwrite: confirmed,
      })
    );
    if (result) {
      setInfo("Guardado.");
      await load();
    }
  }

  async function regenerate() {
    const result = await run("regenerate", (confirmed) =>
      apiSend(`/api/admin/video-stories/${storyId}/regenerate`, "POST", {
        genre,
        confirm_overwrite: confirmed,
      })
    );
    if (result) {
      setInfo("Historia regenerada.");
      await load();
    }
  }

  async function approve() {
    const result = await run("approve", () =>
      apiSend(`/api/admin/video-stories/${storyId}/approve`, "POST")
    );
    if (result) {
      setInfo("Historia aprobada. Ya puedes generar el audio.");
      await load();
    }
  }

  async function buildCover(format: "tiktok" | "youtube") {
    const result = await run(`cover:${format}`, () =>
      apiBlobGet(`/api/admin/video-stories/${storyId}/cover?format=${format}`)
    );
    if (result) {
      // Revoke the previous object URL so repeated renders don't leak.
      setCovers((prev) => {
        if (prev[format]) URL.revokeObjectURL(prev[format] as string);
        return { ...prev, [format]: result };
      });
    }
  }

  async function playSample(id: string) {
    const result = await run(`sample:${id}`, () =>
      apiBlobUrl("/api/admin/video-stories/voices/preview", { voice_id: id })
    );
    if (result) {
      if (sampleUrl) URL.revokeObjectURL(sampleUrl);
      setSampleUrl(result);
      // Without this the player could be holding another voice's sample while
      // a different radio is selected — which is exactly how a voice gets
      // judged by the wrong audio.
      setSampleVoice(id);
    }
  }

  async function saveDefaultVoice() {
    if (!voiceId) return;
    const result = await run("default-voice", () =>
      apiSend("/api/admin/video-stories/settings", "PATCH", { default_voice_id: voiceId })
    );
    if (result) setInfo(`«${voiceId}» quedó como voz predeterminada.`);
  }

  async function generateAudio() {
    const result = await run("audio", () =>
      apiSend(`/api/admin/video-stories/${storyId}/audio`, "POST", { voice_id: voiceId })
    );
    if (result) {
      setInfo("Audio en cola. Ejecuta el worker local (npm run video:worker) para procesarlo.");
      await load();
    }
  }

  async function generateVideo() {
    const result = await run("video", () =>
      apiSend<{ scenes: number; scenes_without_asset: number }>(
        `/api/admin/video-stories/${storyId}/video`,
        "POST"
      )
    );
    if (result) {
      setInfo(
        `Video en cola: ${result.scenes} escenas${
          result.scenes_without_asset ? `, ${result.scenes_without_asset} sin recurso visual` : ""
        }. Ejecuta el worker local para renderizarlo.`
      );
      await load();
    }
  }

  async function publish() {
    const result = await run("publish", () =>
      apiSend<{ url: string; thumbnail_error: string | null }>(
        `/api/admin/video-stories/${storyId}/publish`,
        "POST",
        { confirm: true, visibility }
      )
    );
    setConfirmPublish(false);
    if (result) {
      setInfo(
        `Publicado en YouTube: ${result.url}${
          result.thumbnail_error ? ` (la miniatura falló: ${result.thumbnail_error})` : ""
        }`
      );
      await load();
    }
  }

  if (loading) return <div style={{ marginTop: 20, color: "rgba(255,255,255,0.6)" }}>Cargando…</div>;
  if (!story) return <div style={{ marginTop: 20, color: "#fca5a5" }}>{error || "No encontrada"}</div>;

  const review = story.review_json;
  const activeJob = jobs.find((j) => j.status === "queued" || j.status === "running");

  return (
    <div style={{ marginTop: 20 }}>
      <style>{`
        .ed-head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
        .ed-back {
          padding: 8px 14px; border-radius: 10px; background: transparent;
          border: 1px solid rgba(255,255,255,0.14); color: rgba(255,255,255,0.78);
          font-weight: 700; font-size: 13px; cursor: pointer;
        }
        .ed-card {
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px; padding: 18px; margin-bottom: 16px;
        }
        .ed-card h3 { margin: 0 0 14px 0; font-size: 16px; font-weight: 800; }
        .ed-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
        .ed-field label { font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.6); }
        .ed-input, .ed-textarea, .ed-select {
          padding: 10px 12px; border-radius: 10px; background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.12); color: white; font-size: 14px;
          width: 100%; font-family: inherit;
        }
        .ed-textarea { min-height: 380px; line-height: 1.65; resize: vertical; }
        .ed-row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
        .ed-btn {
          padding: 9px 16px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.14);
          background: transparent; color: rgba(255,255,255,0.82); font-weight: 700;
          font-size: 13px; cursor: pointer;
        }
        .ed-btn.primary { background: #FA0082; border-color: #FA0082; color: white; }
        .ed-btn.ok { background: rgba(34,197,94,0.16); border-color: rgba(34,197,94,0.4); color: #4ade80; }
        .ed-btn:disabled { opacity: 0.5; cursor: default; }
        .ed-meta { font-size: 13px; color: rgba(255,255,255,0.6); }
        .ed-scores { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 10px; }
        .ed-score {
          background: rgba(255,255,255,0.04); border-radius: 10px; padding: 10px 12px;
        }
        .ed-score-label { font-size: 11px; color: rgba(255,255,255,0.5); }
        .ed-score-value { font-size: 20px; font-weight: 900; margin-top: 2px; }
        .ed-notes { margin: 10px 0 0 18px; padding: 0; font-size: 13px; color: rgba(255,255,255,0.65); line-height: 1.6; }
        .ed-voice {
          display: flex; align-items: center; gap: 10px; padding: 10px 12px;
          border-radius: 10px; border: 1px solid rgba(255,255,255,0.1); margin-bottom: 8px;
        }
        .ed-voice.sel { border-color: #FA0082; background: rgba(250,0,130,0.08); }
        .ed-alert { border-radius: 12px; padding: 12px 14px; font-size: 13px; margin-bottom: 14px; }
        .ed-alert.err { background: rgba(239,68,68,0.10); border: 1px solid rgba(239,68,68,0.35); color: #fca5a5; }
        .ed-alert.ok  { background: rgba(34,197,94,0.10); border: 1px solid rgba(34,197,94,0.32); color: #86efac; }
        .ed-alert.warn{ background: rgba(245,158,11,0.10); border: 1px solid rgba(245,158,11,0.35); color: #fcd34d; }
        .ed-pill {
          display: inline-flex; align-items: center; padding: 5px 12px;
          border-radius: 999px; font-size: 12px; font-weight: 800;
        }
      `}</style>

      <div className="ed-head">
        <button className="ed-back" onClick={onClose}>
          ← Volver
        </button>
        <span
          className="ed-pill"
          style={{
            background: `${STATUS_COLORS[story.status]}22`,
            color: STATUS_COLORS[story.status],
          }}
        >
          {STATUS_LABELS[story.status]}
        </span>
        {activeJob ? (
          <span className="ed-meta">
            Job {activeJob.kind} · {activeJob.status} — el worker local lo procesa.
          </span>
        ) : null}
      </div>

      {error ? <div className="ed-alert err">{error}</div> : null}
      {info ? <div className="ed-alert ok">{info}</div> : null}
      {story.error_message && !error ? (
        <div className="ed-alert warn">{story.error_message}</div>
      ) : null}

      {/* ── Guion ─────────────────────────────────────────────────────────── */}
      <div className="ed-card">
        <h3>Historia</h3>

        <div className="ed-field">
          <label htmlFor="ed-title">Título interno</label>
          <input
            id="ed-title"
            className="ed-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="ed-field">
          <label htmlFor="ed-yt-title">Título sugerido para YouTube</label>
          <input
            id="ed-yt-title"
            className="ed-input"
            maxLength={100}
            value={youtubeTitle}
            onChange={(e) => setYoutubeTitle(e.target.value)}
          />
        </div>

        <div className="ed-field">
          <label htmlFor="ed-genre">Género</label>
          <select
            id="ed-genre"
            className="ed-select"
            value={genre}
            onChange={(e) => setGenre(e.target.value as Genre)}
          >
            {GENRES.map((g) => (
              <option key={g} value={g}>
                {GENRE_LABELS[g]}
              </option>
            ))}
          </select>
        </div>

        {story.premise ? (
          <div className="ed-field">
            <label>Premisa</label>
            <div className="ed-meta" style={{ lineHeight: 1.6 }}>
              {story.premise}
            </div>
          </div>
        ) : null}

        <div className="ed-field">
          <label htmlFor="ed-script">Guion</label>
          <textarea
            id="ed-script"
            className="ed-textarea"
            value={script}
            onChange={(e) => setScript(e.target.value)}
          />
        </div>

        <div className="ed-field">
          <label htmlFor="ed-cta">CTA de Peekr (se narra al final)</label>
          <textarea
            id="ed-cta"
            className="ed-textarea"
            style={{ minHeight: 100 }}
            value={cta}
            onChange={(e) => setCta(e.target.value)}
          />
        </div>

        <div className="ed-row" style={{ justifyContent: "space-between" }}>
          <div className="ed-meta">
            <strong style={{ color: inRange ? "#4ade80" : "#fcd34d" }}>
              {liveWordCount.toLocaleString("es-AR")} palabras
            </strong>{" "}
            · {formatMinutes(liveMinutes)} estimados
            {range ? (
              <span style={{ color: "rgba(255,255,255,0.42)" }}>
                {" "}
                (objetivo {range.min.toLocaleString("es-AR")}–{range.max.toLocaleString("es-AR")})
              </span>
            ) : null}
          </div>

          <div className="ed-row">
            <button className="ed-btn primary" onClick={save} disabled={busy !== null}>
              {busy === "save" ? "Guardando…" : "Guardar"}
            </button>
            <button className="ed-btn" onClick={regenerate} disabled={busy !== null}>
              {busy === "regenerate" ? "Regenerando… (1–3 min)" : "Regenerar historia"}
            </button>
            <button
              className="ed-btn ok"
              onClick={approve}
              disabled={busy !== null || story.status === "published"}
            >
              {busy === "approve" ? "Aprobando…" : "Aprobar historia"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Revisión automática ───────────────────────────────────────────── */}
      {review ? (
        <div className="ed-card">
          <h3>Revisión automática</h3>
          <div className="ed-scores">
            {(Object.keys(REVIEW_LABELS) as Array<keyof typeof REVIEW_LABELS>).map((key) => (
              <div key={key} className="ed-score">
                <div className="ed-score-label">{REVIEW_LABELS[key]}</div>
                <div
                  className="ed-score-value"
                  style={{
                    color: review[key] >= 7 ? "#4ade80" : review[key] >= 4 ? "#fcd34d" : "#f87171",
                  }}
                >
                  {review[key]}
                </div>
              </div>
            ))}
          </div>
          {review.notas?.length ? (
            <ul className="ed-notes">
              {review.notas.map((note, i) => (
                <li key={i}>{note}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {/* ── Voz y audio ───────────────────────────────────────────────────── */}
      <div className="ed-card">
        <h3>Voz y audio</h3>

          {voices.map((voice) => (
            <div key={voice.id} className={`ed-voice${voiceId === voice.id ? " sel" : ""}`}>
              <input
                type="radio"
                name="voice"
                checked={voiceId === voice.id}
                onChange={() => setVoiceId(voice.id)}
                aria-label={voice.label}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{voice.label}</div>
                <div className="ed-meta">{voice.description}</div>
              </div>
              <button
                className="ed-btn"
                onClick={() => playSample(voice.id)}
                disabled={busy !== null}
              >
                {busy === `sample:${voice.id}` ? "…" : "▶ Muestra"}
              </button>
            </div>
          ))}

          {sampleUrl ? (
            <div style={{ marginTop: 10 }}>
              <div className="ed-meta" style={{ marginBottom: 4 }}>
                Sonando: <strong style={{ color: "white" }}>{sampleVoice}</strong>
                {sampleVoice !== voiceId ? (
                  <span style={{ color: "#fcd34d" }}>
                    {" "}
                    — no es la voz seleccionada ({voiceId})
                  </span>
                ) : null}
              </div>
              <audio src={sampleUrl} controls autoPlay style={{ width: "100%" }} />
            </div>
          ) : null}

          <div className="ed-row" style={{ marginTop: 14 }}>
            <span className="ed-meta">
              Velocidad de narración: {story.voice_speed}x (se cambia en Configuración)
            </span>
          </div>

          <div className="ed-row" style={{ marginTop: 12 }}>
            <button className="ed-btn" onClick={saveDefaultVoice} disabled={busy !== null || !voiceId}>
              Guardar como voz predeterminada
            </button>
            <button
              className="ed-btn primary"
              onClick={generateAudio}
              disabled={
                busy !== null ||
                !voiceId ||
                story.status === "generating_audio" ||
                story.status === "pending" ||
                story.status === "needs_review"
              }
              title={
                story.status === "pending" || story.status === "needs_review"
                  ? "Aprueba la historia primero"
                  : undefined
              }
            >
              {story.status === "generating_audio" ? "Generando audio…" : "Generar audio completo"}
            </button>
          </div>

          {media.audio_url ? (
            <div style={{ marginTop: 14 }}>
              <audio src={media.audio_url} controls style={{ width: "100%" }} />
              <div className="ed-meta" style={{ marginTop: 6 }}>
                Duración real: {formatMinutes((story.audio_duration_seconds ?? 0) / 60)}
              </div>
            </div>
          ) : null}
      </div>

      {/* ── Video ─────────────────────────────────────────────────────────── */}
      {/* Shown whenever narration exists — including after a failed render,
          which is exactly when you need the retry button. */}
      {story.audio_duration_seconds !== null ||
      story.status === "audio_ready" ||
      story.status === "generating_video" ||
      story.status === "video_ready" ||
      story.status === "published" ? (
        <div className="ed-card">
          <h3>Video</h3>

          <div className="ed-row">
            <button
              className="ed-btn primary"
              onClick={generateVideo}
              disabled={busy !== null || story.status === "generating_video"}
            >
              {story.status === "generating_video"
                ? "Renderizando…"
                : story.video_duration_seconds
                  ? "Regenerar video"
                  : "Generar video 16:9"}
            </button>
            {media.video_url ? (
              <a className="ed-btn" href={media.video_url} download>
                Descargar para revisión
              </a>
            ) : null}
          </div>

          {media.video_url ? (
            <div style={{ marginTop: 14 }}>
              <video
                src={media.video_url}
                controls
                style={{ width: "100%", borderRadius: 12, background: "#000" }}
              />
              <div className="ed-meta" style={{ marginTop: 6 }}>
                Duración: {formatMinutes((story.video_duration_seconds ?? 0) / 60)}
              </div>
            </div>
          ) : (
            <div className="ed-meta" style={{ marginTop: 10 }}>
              El render corre en el worker local. Los recursos visuales salen del bucket
              <code> video-story-assets</code>, en carpetas por etiqueta.
            </div>
          )}
        </div>
      ) : null}

      {/* ── Portada ───────────────────────────────────────────────────────── */}
      <div className="ed-card">
        <h3>Portada</h3>
        <div className="ed-meta" style={{ marginBottom: 12 }}>
          Usa el gancho como texto principal, con las palabras clave en magenta.
          Es la imagen que subes como portada en TikTok y como miniatura en YouTube.
        </div>

        <div className="ed-row">
          <button
            className="ed-btn primary"
            onClick={() => buildCover("tiktok")}
            disabled={busy !== null}
          >
            {busy === "cover:tiktok" ? "Generando…" : "Portada TikTok (1080×1920)"}
          </button>
          <button
            className="ed-btn"
            onClick={() => buildCover("youtube")}
            disabled={busy !== null}
          >
            {busy === "cover:youtube" ? "Generando…" : "Miniatura YouTube (1280×720)"}
          </button>
        </div>

        <div className="ed-row" style={{ marginTop: 14, alignItems: "flex-start" }}>
          {(["tiktok", "youtube"] as const).map((f) =>
            covers[f] ? (
              <div key={f} style={{ flex: "0 0 auto", maxWidth: f === "tiktok" ? 220 : 380 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={covers[f]}
                  alt={`Portada ${f}`}
                  style={{ width: "100%", borderRadius: 10, display: "block" }}
                />
                <a
                  className="ed-btn"
                  href={covers[f]}
                  download={`peekr-stories-${storyId}-${f}.png`}
                  style={{ display: "inline-block", marginTop: 8 }}
                >
                  Descargar
                </a>
              </div>
            ) : null
          )}
        </div>
      </div>

      {/* ── YouTube ───────────────────────────────────────────────────────── */}
      {story.status === "video_ready" || story.status === "published" ? (
        <div className="ed-card">
          <h3>YouTube</h3>

          {story.youtube_video_id ? (
            <div className="ed-meta">
              Publicado como{" "}
              <a
                href={`https://www.youtube.com/watch?v=${story.youtube_video_id}`}
                target="_blank"
                rel="noreferrer"
                style={{ color: "#FA0082" }}
              >
                {story.youtube_video_id}
              </a>{" "}
              · visibilidad {story.youtube_visibility}
            </div>
          ) : !youtube?.connected ? (
            <div className="ed-alert warn" style={{ marginBottom: 0 }}>
              No hay ninguna cuenta de YouTube conectada. Conéctala desde ⚙ Configuración.
            </div>
          ) : confirmPublish ? (
            <div>
              <div className="ed-alert warn">
                <strong>Confirma la publicación</strong>
                <div style={{ marginTop: 8, lineHeight: 1.7 }}>
                  Canal: <strong>{youtube.channel_title ?? "—"}</strong>
                  <br />
                  Título: <strong>{youtubeTitle || story.internal_title}</strong>
                  <br />
                  Visibilidad: <strong>{visibility}</strong>
                  <br />
                  Duración: <strong>{formatMinutes((story.video_duration_seconds ?? 0) / 60)}</strong>
                </div>
              </div>
              <div className="ed-row">
                <button className="ed-btn primary" onClick={publish} disabled={busy !== null}>
                  {busy === "publish" ? "Subiendo…" : "Confirmar y publicar"}
                </button>
                <button className="ed-btn" onClick={() => setConfirmPublish(false)}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="ed-row">
              <select
                className="ed-select"
                style={{ width: "auto" }}
                value={visibility}
                onChange={(e) =>
                  setVisibility(e.target.value as "private" | "unlisted" | "public")
                }
                aria-label="Visibilidad"
              >
                <option value="private">Privado</option>
                <option value="unlisted">No listado</option>
                <option value="public">Público</option>
              </select>
              <button className="ed-btn primary" onClick={() => setConfirmPublish(true)}>
                Publicar en YouTube
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
