/**
 * Shared types and length math for the Video Stories pipeline.
 *
 * Length math in one place because it is easy to get wrong: the narration is
 * generated at a normal speaking rate but *played back* at 1.5x, so the script
 * needs roughly 1.5x more words than a 20-minute read would suggest.
 *
 *   effective wpm = words_per_minute × playback_speed
 *   104 × 1.5 = 156 wpm  →  18 min ≈ 2.808 words, 25 min ≈ 3.900 words
 *
 * The 104 is measured from a real narration, not assumed — see the constant.
 */

export const STORY_STATUSES = [
  "pending",
  "needs_review",
  "approved",
  "generating_audio",
  "audio_ready",
  "generating_video",
  "video_ready",
  "published",
  "error",
] as const;

export type StoryStatus = (typeof STORY_STATUSES)[number];

/** Spanish labels shown in the dashboard. */
export const STATUS_LABELS: Record<StoryStatus, string> = {
  pending: "Pendiente",
  needs_review: "Requiere revisión",
  approved: "Aprobada",
  generating_audio: "Generando audio",
  audio_ready: "Audio listo",
  generating_video: "Generando video",
  video_ready: "Video listo",
  published: "Publicada",
  error: "Error",
};

export const STATUS_COLORS: Record<StoryStatus, string> = {
  pending: "#94a3b8",
  needs_review: "#f59e0b",
  approved: "#22c55e",
  generating_audio: "#06b6d4",
  audio_ready: "#06b6d4",
  generating_video: "#a855f7",
  video_ready: "#a855f7",
  published: "#FA0082",
  error: "#ef4444",
};

/** The three filters shown inside the Video Stories tab. */
export type StoryFilter = "pendientes" | "produccion" | "publicadas";

export const FILTER_STATUSES: Record<StoryFilter, StoryStatus[]> = {
  pendientes: ["pending", "needs_review"],
  produccion: [
    "approved",
    "generating_audio",
    "audio_ready",
    "generating_video",
    "video_ready",
    "error",
  ],
  publicadas: ["published"],
};

export const FILTER_LABELS: Record<StoryFilter, string> = {
  pendientes: "Pendientes",
  produccion: "En producción",
  publicadas: "Publicadas",
};

/**
 * Story categories.
 *
 * These are personal-drama themes, not fiction genres. The format that travels
 * is the confessional one — betrayals, cheating, family blow-ups told in first
 * person as if they happened to the narrator. Mystery and thriller plots don't
 * hold the same audience: people stay for "what did she do next", not for a
 * puzzle.
 */
export const GENRES = [
  "infidelidad",
  "familia",
  "traicion",
  "venganza",
  "boda",
  "trabajo",
  "dinero",
  "vecinos",
  "expareja",
] as const;

export type Genre = (typeof GENRES)[number];

export const GENRE_LABELS: Record<Genre, string> = {
  infidelidad: "Infidelidad",
  familia: "Drama familiar",
  traicion: "Traición de amistad",
  venganza: "Venganza / karma",
  boda: "Bodas",
  trabajo: "Trabajo",
  dinero: "Dinero y herencias",
  vecinos: "Vecinos",
  expareja: "Ex parejas",
};

/** Concrete situations per category, so premises don't converge on one plot. */
export const GENRE_SEEDS: Record<Genre, string> = {
  infidelidad:
    "descubrir una infidelidad por un detalle mínimo; una coartada que no cierra; enterarse por alguien inesperado",
  familia:
    "un hermano que siempre fue el favorito; unos padres que piden algo desmedido; un secreto familiar que sale a la luz",
  traicion:
    "una amiga que repite tu vida; alguien que usa lo que le contaste en tu contra; una traición en un grupo cerrado",
  venganza:
    "alguien que abusa de tu paciencia hasta que se le da vuelta; una injusticia que se corrige sola; un favor que sale caro",
  boda: "una exigencia absurda antes del casamiento; una invitada que arruina algo; un pedido que esconde otra cosa",
  trabajo:
    "un jefe que se cuelga un logro ajeno; un compañero que sabotea; un ascenso que destapa algo",
  dinero:
    "una herencia que divide a la familia; un préstamo que nunca vuelve; un gasto que alguien ocultó",
  vecinos:
    "un vecino que invade el espacio; un conflicto de convivencia que escala; algo que se descubre por la pared",
  expareja:
    "un ex que reaparece con otra intención; algo que se supo después de la separación; un encuentro incómodo",
};

/**
 * B-roll categories. These are folder names inside the `video-story-assets`
 * bucket, so adding one means creating a folder and dropping clips in.
 *
 * They deliberately have NOTHING to do with the story. In this format the
 * narration carries the plot while the screen shows unrelated, high-stimulus
 * footage that holds attention on its own — things opening, being made, being
 * poured, being cut. Matching visuals to the story's mood is what makes these
 * videos feel like a slideshow and lose viewers.
 *
 * What works: constant motion, saturated color, a visible process with a
 * payoff, and no need to understand it. Deliberately the opposite of the
 * dark/moody palette Peekr uses for its own branding, which stays confined to
 * the intro, outro, and logo.
 */
export const VISUAL_TAGS = [
  "unboxing",
  "liquidos",
  "squishy",
  "maquillaje",
  "pintura",
  "cocina",
  "corte",
  "armado",
  "restauracion",
  "orden",
] as const;

export type VisualTag = (typeof VISUAL_TAGS)[number];

/** Human labels for the dashboard and docs. */
export const VISUAL_TAG_LABELS: Record<VisualTag, string> = {
  unboxing: "Unboxings — cajas, regalos, sorpresas",
  liquidos: "Líquidos — jugos, café, resina, miel",
  squishy: "Squishy — slime, arena cinética, apretables",
  maquillaje: "Maquillaje — aplicación paso a paso, transformación",
  pintura: "Pintura — cuadros y murales en ejecución",
  cocina: "Cocina — preparación, emplatado, postres",
  corte: "Cortes — jabón, prensa, cortes precisos",
  armado: "Armado — lego, muebles, maquetas",
  restauracion: "Restauración — limpiezas y antes/después",
  orden: "Orden — organizar, acomodar, encastrar",
};

export interface VideoStorySettings {
  id: number;
  schedule_enabled: boolean;
  schedule_timezone: string;
  schedule_hour: number;
  /** ISO day-of-week: 1 = Monday … 7 = Sunday. Default {1,3,6}. */
  schedule_days: number[];
  target_min_minutes: number;
  target_max_minutes: number;
  playback_speed: number;
  words_per_minute: number;
  default_voice_id: string;
  /**
   * Natural-language delivery direction. Deliberately says nothing about
   * gender: the chosen voice's own timbre should lead. It only pins the
   * delivery so the read doesn't drift between chunks.
   */
  voice_style: string;
  default_visibility: "private" | "unlisted" | "public";
  updated_at: string;
}

export interface Scene {
  index: number;
  /** Narration text for this scene. */
  text: string;
  /** Visual tag used to select b-roll. */
  tag: VisualTag;
  /** Resolved asset path inside video-story-assets, filled by the worker. */
  asset?: string;
}

export interface StoryReview {
  coherencia: number;
  repeticiones: number;
  originalidad: number;
  duracion: number;
  gancho: number;
  final: number;
  /** 'ok' | 'needs_review' | 'error' — drives the resulting story status. */
  verdict: "ok" | "needs_review" | "error";
  notas: string[];
}

export interface VideoStory {
  id: string;
  internal_title: string;
  youtube_title: string | null;
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
  scheduled_for: string | null;
  voice_id: string | null;
  voice_speed: number;
  audio_path: string | null;
  audio_duration_seconds: number | null;
  video_path: string | null;
  video_duration_seconds: number | null;
  scenes_json: Scene[] | null;
  youtube_video_id: string | null;
  youtube_visibility: "private" | "unlisted" | "public";
  youtube_description: string | null;
  published_at: string | null;
  generated_at: string;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface VideoStoryJob {
  id: string;
  story_id: string;
  kind: "audio" | "video";
  status: "queued" | "running" | "done" | "error";
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error_message: string | null;
  attempts: number;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

// ── Length math ──────────────────────────────────────────────────────────────

/** Words consumed per minute of finished video, accounting for playback speed. */
export function effectiveWpm(settings: Pick<VideoStorySettings, "words_per_minute" | "playback_speed">): number {
  return settings.words_per_minute * settings.playback_speed;
}

/** Counts words the same way everywhere: runs of non-whitespace. */
export function countWords(text: string | null | undefined): number {
  if (!text) return 0;
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/** Finished-video minutes for a given word count. */
export function estimateMinutes(
  wordCount: number,
  settings: Pick<VideoStorySettings, "words_per_minute" | "playback_speed">
): number {
  const wpm = effectiveWpm(settings);
  if (wpm <= 0) return 0;
  return Math.round((wordCount / wpm) * 100) / 100;
}

/** Inclusive word range that lands inside the target minute range. */
export function targetWordRange(settings: VideoStorySettings): { min: number; max: number; ideal: number } {
  const wpm = effectiveWpm(settings);
  const min = Math.round(settings.target_min_minutes * wpm);
  const max = Math.round(settings.target_max_minutes * wpm);
  return { min, max, ideal: Math.round((min + max) / 2) };
}

/** "21:30" style label for a minute figure. */
export function formatMinutes(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return "—";
  const total = Math.round(minutes * 60);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export const DEFAULT_SETTINGS: VideoStorySettings = {
  id: 1,
  schedule_enabled: true,
  schedule_timezone: "America/Argentina/Buenos_Aires",
  schedule_hour: 9,
  schedule_days: [1, 3, 6],
  target_min_minutes: 18,
  target_max_minutes: 25,
  playback_speed: 1.5,
  // Measured, not assumed: a real Laomedeia narration ran 5.238 words in
  // 33.45 minutes at 1.5x, i.e. 104 words per minute unsped. The 150 that was
  // here before was a guess and produced 33-minute videos against a 25-minute
  // target. Re-measure if the voice or the style direction changes.
  words_per_minute: 104,
  default_voice_id: "Laomedeia",
  voice_style:
    "Respeta el timbre natural de la voz, sin alterarlo. Tono de confesión: le estás contando algo fuerte a alguien de confianza. Ritmo ágil y con energía, con emoción real pero sin exagerar. Mantén exactamente el mismo timbre y el mismo carácter de principio a fin, sin variar entre párrafos.",
  default_visibility: "private",
  updated_at: new Date(0).toISOString(),
};
