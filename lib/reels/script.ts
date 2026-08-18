/**
 * Title reel — script generation.
 *
 * Produces a short (30–45s) spoiler-free narration for a movie/series reel,
 * structured as beats the renderer turns into scenes:
 *
 *   hero_in     → big on-screen text, no voice (1.5s)
 *   about       → what it's about (premise only — NO twists)          voice
 *   where       → where to watch + runtime/seasons                    voice
 *   follow      → mid-roll: "si te gusta esto, sigue a @peekr.social" voice
 *   verdict     → rating from Peekr data + who it's for               voice
 *   hero_out    → closing card: "Descarga Peekr en iOS o Android"     voice
 *
 * Hard facts (platform, runtime, certification, Peekr rating) are injected
 * from TMDB/Peekr data — the model only writes copy around them, it never
 * invents numbers. Spanish neutral LATAM (tú), no voseo.
 */

import { getStoryAIProvider } from "@/lib/video-stories/ai/provider";

export interface ReelFacts {
  title: string;
  mediaType: "movie" | "tv";
  year: number | null;
  overview: string;
  genres: string[];
  runtimeMin: number | null;      // movies
  seasons: number | null;         // tv
  certification: string | null;   // e.g. "PG-13"
  platforms: string[];            // AR streaming providers
  peekrRating: number | null;     // avg 1-10 from Peekr users
  peekrRatingCount: number;
  peekrComments: number;
}

export interface ReelBeat {
  kind: "hero_in" | "about" | "where" | "follow" | "verdict" | "hero_out";
  /** On-screen headline (short, uppercase-friendly). */
  headline: string;
  /** Narration text (empty for pure hero cards). */
  voice: string;
}

export interface ReelScript {
  hook: string;              // hero_in headline
  beats: ReelBeat[];
  caption: string;           // IG caption
  hashtags: string;
}

const IG_HANDLE = "@peekr.social";

export async function generateReelScript(facts: ReelFacts): Promise<ReelScript> {
  const ai = await getStoryAIProvider();

  const kindLabel = facts.mediaType === "tv" ? "serie" : "película";
  const durationLine = facts.mediaType === "tv"
    ? (facts.seasons ? `${facts.seasons} temporada${facts.seasons === 1 ? "" : "s"}` : "")
    : (facts.runtimeMin ? `${Math.floor(facts.runtimeMin / 60)}h ${facts.runtimeMin % 60}min` : "");
  const platformLine = facts.platforms.length ? facts.platforms.slice(0, 2).join(" y ") : "";
  const ratingLine = facts.peekrRating != null && facts.peekrRatingCount >= 3
    ? `${facts.peekrRating.toFixed(1)}/10 según ${facts.peekrRatingCount} usuarios de Peekr`
    : "";

  const prompt = `Eres guionista de reels de cine para Peekr (app social de películas y series en LATAM, Instagram ${IG_HANDLE}).
Escribe el guion de un reel de 30–45 segundos que recomiende esta ${kindLabel} SIN SPOILERS.

DATOS (usa SOLO estos hechos; no inventes cifras, plataformas ni premios):
- Título: ${facts.title}${facts.year ? ` (${facts.year})` : ""}
- Tipo: ${kindLabel}
- Géneros: ${facts.genres.join(", ") || "n/d"}
- Sinopsis oficial: ${facts.overview.slice(0, 600)}
- Duración: ${durationLine || "n/d"}
- Dónde verla: ${platformLine || "n/d (di 'búscala en tu plataforma')"}
- Clasificación: ${facts.certification ?? "n/d"}
- Rating Peekr: ${ratingLine || "n/d (no menciones rating)"}

REGLAS:
- Español neutro latinoamericano, tratamiento de "tú". PROHIBIDO el voseo (nada de "mirá", "tenés", "querés").
- CERO spoilers: solo la premisa / primer acto. Nunca reveles giros, finales, muertes ni identidades.
- Frases cortas, ritmo de reel, tono cercano y entusiasta pero no exagerado.
- El beat "follow" va a MITAD del video, ANTES del veredicto: invita a seguir ${IG_HANDLE} si les gusta este contenido.
- El beat "hero_out" cierra pidiendo DESCARGAR PEEKR en iOS o Android para descubrir qué ver.
- Cada "voice" ≤ 30 palabras. "headline" ≤ 8 palabras, sin emojis.
- Total narrado (suma de voice) entre 70 y 100 palabras.

Responde SOLO con JSON exacto:
{
  "hook": "headline gancho para la portada, ≤ 8 palabras, sin nombrar el título",
  "beats": [
    {"kind":"hero_in","headline":"...","voice":""},
    {"kind":"about","headline":"¿De qué trata?","voice":"..."},
    {"kind":"where","headline":"¿Dónde verla y cuánto dura?","voice":"..."},
    {"kind":"follow","headline":"Sígueme para más","voice":"Si te gusta este contenido, sigue a Peekr punto social para más recomendaciones."},
    {"kind":"verdict","headline":"...","voice":"..."},
    {"kind":"hero_out","headline":"Descarga Peekr","voice":"..."}
  ],
  "caption": "caption para Instagram, 2-3 líneas, con el título y una invitación a descargar Peekr",
  "hashtags": "#peekr #cine #series ... (8-12 hashtags relevantes)"
}`;

  const raw = await ai.completeJson<ReelScript>(prompt, {
    temperature: 0.7,
    maxOutputTokens: 1500,
    timeoutMs: 45_000,
  });

  return sanitize(raw, facts);
}

// Belt-and-braces: guarantee the structural beats exist even if the model
// drifts, and keep the fixed CTAs on-brand.
function sanitize(s: ReelScript, facts: ReelFacts): ReelScript {
  const byKind = new Map(s.beats?.map((b) => [b.kind, b]) ?? []);
  const get = (k: ReelBeat["kind"], fallbackHeadline: string, fallbackVoice: string): ReelBeat => {
    const b = byKind.get(k);
    return {
      kind: k,
      headline: (b?.headline ?? fallbackHeadline).trim().slice(0, 60),
      voice: (b?.voice ?? fallbackVoice).trim().slice(0, 240),
    };
  };
  const beats: ReelBeat[] = [
    { ...get("hero_in", s.hook ?? facts.title, ""), voice: "" },
    get("about", "¿De qué trata?", facts.overview.slice(0, 160)),
    get("where", "¿Dónde verla y cuánto dura?", ""),
    {
      kind: "follow",
      headline: "Sígueme para más",
      voice: "Si te gusta este contenido, sigue a Peekr punto social para más recomendaciones.",
    },
    get("verdict", "Nuestro veredicto", ""),
    {
      kind: "hero_out",
      headline: "Descarga Peekr",
      voice: get("hero_out", "", "Descarga Peekr en iOS o Android y descubre qué ver.").voice
        || "Descarga Peekr en iOS o Android y descubre qué ver.",
    },
  ];
  return {
    hook: (s.hook ?? facts.title).trim().slice(0, 60),
    beats,
    caption: (s.caption ?? `${facts.title} — descúbrela en Peekr.`).trim().slice(0, 1200),
    hashtags: (s.hashtags ?? "#peekr #cine #series #recomendaciones #streaming").trim().slice(0, 300),
  };
}
