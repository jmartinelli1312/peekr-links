"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiSend } from "./videoStoriesApi";
import VideoStoryEditor from "./VideoStoryEditor";
import {
  FILTER_LABELS,
  GENRE_LABELS,
  GENRES,
  STATUS_COLORS,
  STATUS_LABELS,
  formatMinutes,
  type Genre,
  type StoryFilter,
  type StoryStatus,
  type VideoStorySettings,
} from "@/lib/video-stories/types";

interface StoryRow {
  id: string;
  internal_title: string;
  youtube_title: string | null;
  genre: string;
  status: StoryStatus;
  scheduled_for: string | null;
  word_count: number;
  estimated_minutes: number;
  generated_at: string;
  error_message: string | null;
  youtube_video_id: string | null;
  published_at: string | null;
}

interface YouTubeStatus {
  connected: boolean;
  channel_title: string | null;
  connected_at: string | null;
}

const FILTERS: StoryFilter[] = ["pendientes", "produccion", "publicadas"];

const DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function formatDate(value?: string | null): string {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return "—";
  }
}

export default function VideoStoriesTab() {
  const [filter, setFilter] = useState<StoryFilter>("pendientes");
  const [stories, setStories] = useState<StoryRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genre, setGenre] = useState<Genre | "">("");
  const [openId, setOpenId] = useState<string | null>(null);

  const [settings, setSettings] = useState<VideoStorySettings | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const [youtube, setYoutube] = useState<YouTubeStatus | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiGet<{ stories: StoryRow[]; counts: Record<string, number> }>(
        `/api/admin/video-stories?filter=${filter}`
      );
      setStories(data.stories);
      setCounts(data.counts);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [filter]);

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
    apiGet<YouTubeStatus>("/api/admin/video-stories/youtube/status")
      .then(setYoutube)
      .catch(() => undefined);
  }, []);

  // The OAuth callback bounces back to /admin with a query flag; surface it
  // and then clean the URL so a refresh doesn't repeat the message.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get("youtube");
    if (!result) return;
    if (result === "connected") {
      // Reading a one-shot URL flag on mount is exactly what this effect is
      // for; there is nowhere else to surface it.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInfo("Cuenta de YouTube conectada.");
      apiGet<YouTubeStatus>("/api/admin/video-stories/youtube/status")
        .then(setYoutube)
        .catch(() => undefined);
    } else {
      setError(`No se pudo conectar YouTube (${params.get("reason") ?? "error"}).`);
    }
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  async function generateNow() {
    setGenerating(true);
    setError("");
    setInfo("");
    try {
      await apiSend<{ id: string }>("/api/admin/video-stories/generate", "POST", {
        genre: genre || undefined,
      });
      setInfo("Historia generada. Revísala antes de aprobar.");
      setFilter("pendientes");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  }

  async function saveSettings(patch: Partial<VideoStorySettings>) {
    if (!settings) return;
    setSavingSettings(true);
    setError("");
    try {
      const data = await apiSend<{ settings: VideoStorySettings }>(
        "/api/admin/video-stories/settings",
        "PATCH",
        patch
      );
      setSettings(data.settings);
      setInfo("Configuración guardada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingSettings(false);
    }
  }

  async function connectYouTube() {
    try {
      const { url } = await apiGet<{ url: string }>("/api/admin/video-stories/youtube/connect");
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function disconnectYouTube() {
    if (!window.confirm("¿Desconectar la cuenta de YouTube?")) return;
    try {
      await apiSend("/api/admin/video-stories/youtube/status", "POST");
      setYoutube({ connected: false, channel_title: null, connected_at: null });
      setInfo("Cuenta de YouTube desconectada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  if (openId) {
    return (
      <VideoStoryEditor
        storyId={openId}
        onClose={() => {
          setOpenId(null);
          void load();
        }}
      />
    );
  }

  return (
    <div style={{ marginTop: 20 }}>
      <style>{`
        .vs-toolbar {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          align-items: center;
          margin-bottom: 18px;
        }
        .vs-filter {
          padding: 8px 16px;
          border-radius: 999px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          background: transparent;
          border: 1px solid rgba(255,255,255,0.12);
          color: rgba(255,255,255,0.6);
        }
        .vs-filter.active {
          background: rgba(250,0,130,0.12);
          border-color: #FA0082;
          color: #FA0082;
        }
        .vs-primary {
          padding: 9px 18px;
          border-radius: 10px;
          background: #FA0082;
          border: none;
          color: white;
          font-weight: 800;
          font-size: 13px;
          cursor: pointer;
        }
        .vs-primary:disabled { opacity: 0.55; cursor: default; }
        .vs-ghost {
          padding: 9px 16px;
          border-radius: 10px;
          background: transparent;
          border: 1px solid rgba(255,255,255,0.14);
          color: rgba(255,255,255,0.78);
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
        }
        .vs-select {
          padding: 9px 12px;
          border-radius: 10px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.12);
          color: white;
          font-size: 13px;
        }
        .vs-list { display: flex; flex-direction: column; gap: 10px; }
        .vs-row {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px;
          padding: 14px 16px;
        }
        @media (min-width: 900px) {
          .vs-row {
            grid-template-columns: minmax(0,3fr) 1fr 1fr 1fr 1fr auto;
            align-items: center;
          }
        }
        .vs-title { font-size: 15px; font-weight: 800; color: white; line-height: 1.35; }
        .vs-sub { font-size: 12px; color: rgba(255,255,255,0.5); margin-top: 3px; }
        .vs-cell-label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: rgba(255,255,255,0.38);
          margin-bottom: 2px;
        }
        .vs-cell-value { font-size: 13px; color: rgba(255,255,255,0.82); font-weight: 600; }
        .vs-pill {
          display: inline-flex;
          align-items: center;
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 800;
        }
        .vs-empty {
          padding: 34px;
          text-align: center;
          color: rgba(255,255,255,0.4);
          font-size: 14px;
          background: rgba(255,255,255,0.02);
          border-radius: 12px;
        }
        .vs-panel {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px;
          padding: 16px;
          margin-bottom: 18px;
        }
        .vs-field { display: flex; flex-direction: column; gap: 5px; }
        .vs-field label { font-size: 12px; color: rgba(255,255,255,0.6); font-weight: 700; }
        .vs-input {
          padding: 8px 10px;
          border-radius: 8px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.12);
          color: white;
          font-size: 13px;
          width: 100%;
        }
        .vs-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 12px;
        }
        .vs-day {
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          background: transparent;
          border: 1px solid rgba(255,255,255,0.12);
          color: rgba(255,255,255,0.55);
        }
        .vs-day.on { background: rgba(250,0,130,0.14); border-color: #FA0082; color: #FA0082; }
        .vs-note { font-size: 12px; color: rgba(255,255,255,0.5); margin-top: 8px; line-height: 1.5; }
        .vs-alert {
          border-radius: 12px;
          padding: 12px 14px;
          font-size: 13px;
          margin-bottom: 14px;
        }
        .vs-alert.err { background: rgba(239,68,68,0.10); border: 1px solid rgba(239,68,68,0.35); color: #fca5a5; }
        .vs-alert.ok  { background: rgba(34,197,94,0.10); border: 1px solid rgba(34,197,94,0.32); color: #86efac; }
      `}</style>

      {error ? <div className="vs-alert err">{error}</div> : null}
      {info ? <div className="vs-alert ok">{info}</div> : null}

      <div className="vs-toolbar">
        {FILTERS.map((key) => (
          <button
            key={key}
            className={`vs-filter${filter === key ? " active" : ""}`}
            onClick={() => setFilter(key)}
          >
            {FILTER_LABELS[key]}
            {counts[key] ? ` · ${counts[key]}` : ""}
          </button>
        ))}

        <div style={{ flex: 1 }} />

        <select
          className="vs-select"
          value={genre}
          onChange={(e) => setGenre(e.target.value as Genre | "")}
          aria-label="Género"
        >
          <option value="">Género automático</option>
          {GENRES.map((g) => (
            <option key={g} value={g}>
              {GENRE_LABELS[g]}
            </option>
          ))}
        </select>

        <button className="vs-primary" onClick={generateNow} disabled={generating}>
          {generating ? "Generando… (1–3 min)" : "Generar historia ahora"}
        </button>

        <button className="vs-ghost" onClick={() => setShowSettings((v) => !v)}>
          ⚙ Configuración
        </button>
      </div>

      {showSettings && settings ? (
        <div className="vs-panel">
          <div className="vs-grid">
            <div className="vs-field">
              <label htmlFor="vs-hour">Hora de generación</label>
              <input
                id="vs-hour"
                className="vs-input"
                type="number"
                min={0}
                max={23}
                value={settings.schedule_hour}
                onChange={(e) =>
                  setSettings({ ...settings, schedule_hour: Number(e.target.value) })
                }
                onBlur={() => void saveSettings({ schedule_hour: settings.schedule_hour })}
              />
            </div>

            <div className="vs-field">
              <label htmlFor="vs-tz">Zona horaria</label>
              <input
                id="vs-tz"
                className="vs-input"
                value={settings.schedule_timezone}
                onChange={(e) =>
                  setSettings({ ...settings, schedule_timezone: e.target.value })
                }
                onBlur={() => void saveSettings({ schedule_timezone: settings.schedule_timezone })}
              />
            </div>

            <div className="vs-field">
              <label htmlFor="vs-speed">Velocidad de narración</label>
              <input
                id="vs-speed"
                className="vs-input"
                type="number"
                step={0.1}
                min={0.5}
                max={3}
                value={settings.playback_speed}
                onChange={(e) =>
                  setSettings({ ...settings, playback_speed: Number(e.target.value) })
                }
                onBlur={() => void saveSettings({ playback_speed: settings.playback_speed })}
              />
            </div>

            <div className="vs-field">
              <label htmlFor="vs-min">Duración mín. (min)</label>
              <input
                id="vs-min"
                className="vs-input"
                type="number"
                value={settings.target_min_minutes}
                onChange={(e) =>
                  setSettings({ ...settings, target_min_minutes: Number(e.target.value) })
                }
                onBlur={() => void saveSettings({ target_min_minutes: settings.target_min_minutes })}
              />
            </div>

            <div className="vs-field">
              <label htmlFor="vs-max">Duración máx. (min)</label>
              <input
                id="vs-max"
                className="vs-input"
                type="number"
                value={settings.target_max_minutes}
                onChange={(e) =>
                  setSettings({ ...settings, target_max_minutes: Number(e.target.value) })
                }
                onBlur={() => void saveSettings({ target_max_minutes: settings.target_max_minutes })}
              />
            </div>
          </div>

          <div className="vs-field" style={{ marginTop: 14 }}>
            <label htmlFor="vs-style">Estilo de narración</label>
            <textarea
              id="vs-style"
              className="vs-input"
              style={{ minHeight: 90, fontFamily: "inherit", lineHeight: 1.5 }}
              value={settings.voice_style}
              onChange={(e) => setSettings({ ...settings, voice_style: e.target.value })}
              onBlur={() => void saveSettings({ voice_style: settings.voice_style })}
            />
            <div className="vs-note" style={{ marginTop: 4 }}>
              Instrucción que recibe el modelo de voz junto con el texto. Define el tono
              y evita que la lectura cambie de carácter entre párrafos. No menciona
              género a propósito: manda el timbre de la voz que elijas.
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <div className="vs-cell-label">Días de generación</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
              {DAY_LABELS.map((label, index) => {
                const day = index + 1;
                const on = settings.schedule_days.includes(day);
                return (
                  <button
                    key={day}
                    className={`vs-day${on ? " on" : ""}`}
                    disabled={savingSettings}
                    onClick={() => {
                      const next = on
                        ? settings.schedule_days.filter((d) => d !== day)
                        : [...settings.schedule_days, day].sort((a, b) => a - b);
                      if (next.length === 0) return;
                      setSettings({ ...settings, schedule_days: next });
                      void saveSettings({ schedule_days: next });
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="vs-note">
            La tarea programada solo genera el borrador. El audio, el video y la publicación
            siempre se disparan a mano.
            <br />
            Objetivo actual: {Math.round(
              settings.target_min_minutes * settings.words_per_minute * settings.playback_speed
            ).toLocaleString("es-AR")}
            –
            {Math.round(
              settings.target_max_minutes * settings.words_per_minute * settings.playback_speed
            ).toLocaleString("es-AR")}{" "}
            palabras ({settings.target_min_minutes}–{settings.target_max_minutes} min a{" "}
            {settings.playback_speed}x).
          </div>

          <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="vs-cell-label">YouTube</div>
            {youtube?.connected ? (
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 6, flexWrap: "wrap" }}>
                <span className="vs-cell-value">
                  Conectado a <strong>{youtube.channel_title ?? "canal sin nombre"}</strong>
                </span>
                <button className="vs-ghost" onClick={disconnectYouTube}>
                  Desconectar
                </button>
              </div>
            ) : (
              <div style={{ marginTop: 6 }}>
                <button className="vs-ghost" onClick={connectYouTube}>
                  Conectar cuenta de Google
                </button>
                <div className="vs-note">
                  Necesario para publicar. La autorización se guarda solo en el backend.
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="vs-empty">Cargando historias…</div>
      ) : stories.length === 0 ? (
        <div className="vs-empty">
          No hay historias en «{FILTER_LABELS[filter]}».
        </div>
      ) : (
        <div className="vs-list">
          {stories.map((story) => (
            <div key={story.id} className="vs-row">
              <div>
                <div className="vs-title">{story.internal_title}</div>
                <div className="vs-sub">
                  {story.youtube_title || "Sin título de YouTube"}
                  {story.error_message ? ` · ${story.error_message.slice(0, 120)}` : ""}
                </div>
              </div>

              <div>
                <div className="vs-cell-label">Género</div>
                <div className="vs-cell-value">
                  {GENRE_LABELS[story.genre as Genre] ?? story.genre}
                </div>
              </div>

              <div>
                <div className="vs-cell-label">Programada</div>
                <div className="vs-cell-value">
                  {story.scheduled_for ? formatDate(story.scheduled_for) : formatDate(story.generated_at)}
                </div>
              </div>

              <div>
                <div className="vs-cell-label">Duración est.</div>
                <div className="vs-cell-value">
                  {formatMinutes(story.estimated_minutes)}
                  <span style={{ color: "rgba(255,255,255,0.4)", fontWeight: 400 }}>
                    {" "}
                    · {story.word_count.toLocaleString("es-AR")} pal.
                  </span>
                </div>
              </div>

              <div>
                <div className="vs-cell-label">Estado</div>
                <span
                  className="vs-pill"
                  style={{
                    background: `${STATUS_COLORS[story.status]}22`,
                    color: STATUS_COLORS[story.status],
                  }}
                >
                  {STATUS_LABELS[story.status] ?? story.status}
                </span>
              </div>

              <button className="vs-ghost" onClick={() => setOpenId(story.id)}>
                Abrir
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
