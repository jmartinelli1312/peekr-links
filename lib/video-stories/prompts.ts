/**
 * Prompts for the Video Stories generator.
 *
 * All copy is written in neutral LATAM Spanish (tú, never vos) to match the
 * rest of Peekr's Spanish surface.
 *
 * Originality is a hard constraint, repeated in every prompt: the stories may
 * borrow genre conventions and narrative structure from cinema, but never the
 * plot, characters, dialogue, or recognisable twists of an existing film.
 */

import { GENRE_LABELS, GENRE_SEEDS, type Genre, type VideoStorySettings } from "./types";
import { targetWordRange } from "./types";

const ORIGINALITY_RULE = `REGLAS (obligatorias):
- La historia es FICCIÓN, aunque suene a algo que pasó de verdad.
- Personajes inventados. NO uses nombres de personas reales, famosos, marcas ni lugares identificables.
- No copies casos reales conocidos ni historias virales que ya circulan.
- Nada sobrenatural, nada de crímenes violentos ni contenido sexual explícito: es conflicto humano cotidiano.
- Si tu idea se parece demasiado a algo que ya viste, descártala y propone otra.`;

const VOICE_RULE = `ESTILO (crítico para que funcione):
- PRIMERA PERSONA. La narradora o el narrador cuenta algo que le pasó a ella o a él.
- Tono de confesión: como quien le cuenta algo fuerte a una amiga, no como quien lee un libro.
- Español neutro de Latinoamérica. Usa "tú", nunca "vos" ni argentinismos.
- Frases cortas y habladas. Esto se narra en voz alta, no se lee.
- Detalles concretos y cotidianos (un mensaje, una hora, un gesto) en vez de descripciones literarias.
- Diálogos textuales cuando aportan: "y me dijo que...", "le respondí que...".
- Sin encabezados, sin viñetas, sin acotaciones. Solo el relato corrido.
- Nada de metáforas rebuscadas ni prosa de novela. Si suena a literatura, está mal.`;

// ── Premise ──────────────────────────────────────────────────────────────────

export interface PremiseResult {
  internal_title: string;
  youtube_title: string;
  premise: string;
  hook: string;
  midpoint_twist: string;
  ending: string;
}

/** Constrains decoding so the premise can't come back as malformed JSON. */
export const PREMISE_SCHEMA = {
  type: "object",
  properties: {
    internal_title: { type: "string" },
    youtube_title: { type: "string" },
    premise: { type: "string" },
    hook: { type: "string" },
    midpoint_twist: { type: "string" },
    ending: { type: "string" },
  },
  required: [
    "internal_title",
    "youtube_title",
    "premise",
    "hook",
    "midpoint_twist",
    "ending",
  ],
} as const;

/** Same idea for the automatic review. */
export const REVIEW_SCHEMA = {
  type: "object",
  properties: {
    coherencia: { type: "integer" },
    repeticiones: { type: "integer" },
    originalidad: { type: "integer" },
    duracion: { type: "integer" },
    gancho: { type: "integer" },
    final: { type: "integer" },
    verdict: { type: "string" },
    notas: { type: "array", items: { type: "string" } },
  },
  required: [
    "coherencia",
    "repeticiones",
    "originalidad",
    "duracion",
    "gancho",
    "final",
    "verdict",
    "notas",
  ],
} as const;

export function buildPremisePrompt(genre: Genre, settings: VideoStorySettings): string {
  const { min, max } = targetWordRange(settings);
  return `Eres guionista de historias narradas para TikTok y YouTube, del tipo que la gente escucha entera porque necesita saber cómo termina. Vas a diseñar una historia original sobre ${GENRE_LABELS[genre]}.

SITUACIONES POSIBLES (elige una o inventa otra del mismo tipo): ${GENRE_SEEDS[genre]}.

${ORIGINALITY_RULE}

CONTEXTO DE PRODUCCIÓN:
- La historia se va a narrar en audio y durará entre ${settings.target_min_minutes} y ${settings.target_max_minutes} minutos.
- El guion completo tendrá entre ${min} y ${max} palabras.
- El canal es Peekr, una app social de series y películas.

Diseña:
1. Un título interno corto para uso del equipo.
2. Un título sugerido para YouTube: la situación en una línea, en primera persona, máximo 80 caracteres, sin emojis y sin MAYÚSCULAS sostenidas.
3. Una premisa de 4 a 6 frases, en primera persona: quién soy, qué relación tengo con la otra persona, qué hizo y por qué me afecta.
4. El gancho inicial: la PRIMERA FRASE del video. Tiene que soltar el conflicto de una, sin preámbulo. Modelo: "Mi hermana me pidió ser la primera en caminar por el pasillo el día de mi boda, y le dije que sí, pero nunca le aclaré a qué estaba accediendo exactamente." Concreta, con un detalle raro, y que obligue a seguir escuchando.
5. El giro intermedio: lo que descubro y que cambia el sentido de todo lo anterior.
6. El final: cómo se resuelve. Que se sienta merecido — quien hizo el daño paga de alguna forma, o yo tomo una decisión que cierra el asunto.

Responde SOLO con este JSON, sin texto alrededor:
{
  "internal_title": "...",
  "youtube_title": "...",
  "premise": "...",
  "hook": "...",
  "midpoint_twist": "...",
  "ending": "..."
}`;
}

// ── Script, generated act by act ─────────────────────────────────────────────

export const ACTS = [
  {
    key: "acto_1",
    label: "Acto 1 — Gancho y contexto",
    brief:
      "Arranca con el gancho tal cual, como primera frase. Después contá el contexto mínimo: quién es la otra persona, qué relación tenemos, cómo veníamos. Cerrá el acto con el primer hecho que me hizo sospechar o incomodarme.",
  },
  {
    key: "acto_2",
    label: "Acto 2 — Escalada",
    brief:
      "La cosa empeora. Sumá dos o tres episodios concretos, con fechas, mensajes o frases textuales. Yo trato de darle el beneficio de la duda y me sigo tragando cosas. Todavía NO reveles el giro.",
  },
  {
    key: "acto_3",
    label: "Acto 3 — El descubrimiento",
    brief:
      "Contá cómo me entero de la verdad, con detalle: qué vi, quién me lo dijo, qué sentí en ese momento. Volvé sobre cosas del Acto 2 que ahora se entienden distinto. Terminá justo antes de la confrontación.",
  },
  {
    key: "acto_4",
    label: "Acto 4 — Confrontación y cierre",
    brief:
      "La confrontación, con diálogo textual. Cómo reaccionó, qué dijo la gente alrededor, qué decidí. Cerrá con dónde quedó cada uno hoy y una última línea corta que deje pensando.",
  },
] as const;

export function buildActPrompt(params: {
  genre: Genre;
  premise: PremiseResult;
  actIndex: number;
  wordsForAct: number;
  previousActs: string[];
}): string {
  const { genre, premise, actIndex, wordsForAct, previousActs } = params;
  const act = ACTS[actIndex];

  const previousBlock = previousActs.length
    ? `\nLO QUE YA SE NARRÓ (no lo repitas, continúa desde acá):\n"""\n${previousActs
        .join("\n\n")
        .slice(-6000)}\n"""\n`
    : "";

  return `Eres un guionista de historias narradas. Estás escribiendo ${act.label} de una historia original de género ${GENRE_LABELS[genre]}.

${ORIGINALITY_RULE}

${VOICE_RULE}

FICHA DE LA HISTORIA:
- Premisa: ${premise.premise}
- Gancho inicial: ${premise.hook}
- Giro intermedio: ${premise.midpoint_twist}
- Final: ${premise.ending}
${previousBlock}
TAREA — ${act.label}:
${act.brief}

EXTENSIÓN: aproximadamente ${wordsForAct} palabras. Es importante acercarte a esa cifra: la duración del video depende de eso.

Devuelve ÚNICAMENTE el texto narrativo de este acto. Sin títulos, sin "Acto 1", sin comentarios, sin comillas envolventes.`;
}

/** Closing CTA read after the story ends. Written once, not model-generated. */
export function buildCtaPrompt(genre: Genre): string {
  return `Escribe el cierre en off de un video narrado del canal de Peekr, una app social de series y películas donde puedes llevar registro de lo que ves, puntuarlo y ver qué están viendo tus amigos.

La historia que acaba de terminar es sobre ${GENRE_LABELS[genre]}.

Requisitos:
- Español neutro de Latinoamérica ("tú", nunca "vos").
- Entre 45 y 70 palabras.
- Empieza conectando con la sensación que deja la historia, no con el producto.
- Invita a suscribirse al canal y a bajar Peekr.
- Tono cálido y directo. Nada de "no olvides darle like y activar la campanita".

Devuelve solo el texto, sin comillas ni comentarios.`;
}

// ── Automatic review ─────────────────────────────────────────────────────────

export function buildReviewPrompt(params: {
  genre: Genre;
  script: string;
  wordCount: number;
  settings: VideoStorySettings;
}): string {
  const { genre, script, wordCount, settings } = params;
  const { min, max } = targetWordRange(params.settings);

  return `Eres editor de guiones. Evalúa este relato narrado en primera persona sobre ${GENRE_LABELS[genre]} con criterio profesional y honesto. No seas complaciente.

DATOS:
- Palabras: ${wordCount}
- Rango objetivo: ${min} a ${max} palabras (${settings.target_min_minutes}–${settings.target_max_minutes} minutos a velocidad ${settings.playback_speed}x).

GUION:
"""
${script.slice(0, 120_000)}
"""

Puntúa de 0 a 10 cada criterio:
- coherencia: ¿la trama se sostiene? ¿hay agujeros lógicos o personajes que cambian sin razón?
- repeticiones: 10 = sin repeticiones; baja el puntaje si hay frases, ideas o descripciones que se repiten.
- originalidad: 10 = original; BAJA MUCHO el puntaje si reconoces el argumento, los personajes o el giro de una obra existente. Si detectas un parecido concreto, nómbralo en las notas.
- duracion: 10 = dentro del rango objetivo; baja según lo lejos que esté.
- gancho: ¿la primera frase suelta el conflicto de una? ¿retiene a alguien que llegó de casualidad?
- final: ¿cierra de verdad y se siente merecido, o queda flojo?
Penaliza fuerte si suena a literatura en vez de a alguien contando algo que le pasó, o si se va a lo sobrenatural.

Veredicto:
- "ok" si todo está en 7 o más.
- "needs_review" si algo está entre 4 y 6.
- "error" si algún criterio está en 3 o menos, o si la historia copia una obra existente.

Responde SOLO con este JSON:
{
  "coherencia": 0,
  "repeticiones": 0,
  "originalidad": 0,
  "duracion": 0,
  "gancho": 0,
  "final": 0,
  "verdict": "ok",
  "notas": ["...", "..."]
}`;
}

