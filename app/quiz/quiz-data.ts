// Cinema IQ quiz — data + scoring.
// Hybrid: 10 taste/habit questions → a shareable ARCHETYPE + a Cinema IQ (0-100).
// No "losers": every result is brag-worthy. The IQ number powers the
// "menos del X% llega a este nivel" hook that drives the IG share.

export type ArchKey =
  | "culto"
  | "maraton"
  | "critico"
  | "joyas"
  | "nostalgico"
  | "estrenos";

export interface Archetype {
  key: ArchKey;
  emoji: string;
  name: string;
  tagline: string;
  desc: string;
  /** Two-stop gradient for the result card. */
  grad: [string, string];
}

export interface QuizOption {
  text: string;
  /** Points added per archetype for this answer. */
  w: Partial<Record<ArchKey, number>>;
  /** Cinema-knowledge points (0-5) contributed to the IQ score. */
  iq: number;
}

export interface QuizQuestion {
  q: string;
  options: QuizOption[];
}

export const ARCHETYPES: Record<ArchKey, Archetype> = {
  culto: {
    key: "culto",
    emoji: "🎬",
    name: "Cinéfilo de Culto",
    tagline: "Ves lo que nadie vio.",
    desc: "Tu cine favorito no está en las carteleras. Buscas autores, festivales y esas películas raras que solo tú conoces. El algoritmo te sigue a ti, no al revés.",
    grad: ["#2A0A3D", "#0D0D0D"],
  },
  maraton: {
    key: "maraton",
    emoji: "🍿",
    name: "Máquina de Maratones",
    tagline: "Una temporada por noche.",
    desc: "Para ti 'un capítulo más' es una promesa que jamás cumples. Empiezas una serie y no existe nada hasta el final. Imparable, insaciable, siempre con algo en curso.",
    grad: ["#3D1A00", "#0D0D0D"],
  },
  critico: {
    key: "critico",
    emoji: "🧠",
    name: "Crítico Implacable",
    tagline: "Nada te la cuela.",
    desc: "Ves cine con lupa: guion, dirección, fotografía. Tus recomendaciones valen oro porque nunca fallan… y tus 'no la veas' salvan vidas. Exigente y con criterio.",
    grad: ["#0A1F3D", "#0D0D0D"],
  },
  joyas: {
    key: "joyas",
    emoji: "💎",
    name: "Cazador de Joyas Ocultas",
    tagline: "Descubrís antes que todos.",
    desc: "Tienes el don de encontrar EL título perfecto antes de que se vuelva viral. Eres el amigo al que todos le piden qué ver. Tu watchlist es un tesoro.",
    grad: ["#0A3D2E", "#0D0D0D"],
  },
  nostalgico: {
    key: "nostalgico",
    emoji: "🕰️",
    name: "Nostálgico de Culto",
    tagline: "Los clásicos no se discuten.",
    desc: "Para ti el cine de verdad ya se hizo. Conoces a los maestros, defiendes los clásicos y vuelves a ver tus favoritas mil veces. Elegancia atemporal con buen gusto.",
    grad: ["#3D2A00", "#0D0D0D"],
  },
  estrenos: {
    key: "estrenos",
    emoji: "🔥",
    name: "Cazaestrenos",
    tagline: "Estabas ahí el día del release.",
    desc: "Lo nuevo es lo tuyo. Ves los estrenos antes que nadie y el spoiler es tu peor enemigo. Siempre al día, siempre primero. La conversación empieza contigo.",
    grad: ["#3D001F", "#0D0D0D"],
  },
};

export const QUESTIONS: QuizQuestion[] = [
  {
    q: "Es viernes 9pm. ¿Qué haces?",
    options: [
      { text: "Reviso mi watchlist eterna y elijo una joya", w: { joyas: 3, culto: 1 }, iq: 3 },
      { text: "Empiezo una serie nueva y no paro hasta el amanecer", w: { maraton: 3 }, iq: 2 },
      { text: "Vuelvo a ver un clásico que ya vi cinco veces", w: { nostalgico: 3 }, iq: 3 },
      { text: "Busco EL estreno del día", w: { estrenos: 3 }, iq: 2 },
    ],
  },
  {
    q: "Un amigo dice que 'El Padrino es aburrida'. Reaccionas:",
    options: [
      { text: "Le explico plano por plano por qué se equivoca", w: { critico: 3, culto: 1 }, iq: 5 },
      { text: "Respeto su opinión, pero muero por dentro", w: { nostalgico: 2 }, iq: 3 },
      { text: "'¿El Padrino? Muy mainstream para mí'", w: { culto: 2 }, iq: 2 },
      { text: "Le paso 3 mejores para su gusto", w: { joyas: 2 }, iq: 3 },
    ],
  },
  {
    q: "Tu métrica para darle play a algo:",
    options: [
      { text: "Que la crítica la ame y gane premios", w: { critico: 3 }, iq: 4 },
      { text: "Que casi nadie que conozco la haya visto", w: { culto: 3 }, iq: 3 },
      { text: "Que tenga 8 temporadas para maratonear", w: { maraton: 3 }, iq: 1 },
      { text: "Que sea EL estreno del momento", w: { estrenos: 3 }, iq: 2 },
    ],
  },
  {
    q: "¿Subtítulos o doblaje?",
    options: [
      { text: "Subtítulos siempre, el idioma original es sagrado", w: { culto: 2, critico: 2 }, iq: 5 },
      { text: "Doblaje, quiero relajarme sin leer", w: { maraton: 2 }, iq: 1 },
      { text: "Depende del país de la película", w: { joyas: 2 }, iq: 4 },
      { text: "Lo que cargue más rápido, pero YA", w: { estrenos: 2 }, iq: 2 },
    ],
  },
  {
    q: "El género que te define:",
    options: [
      { text: "Cine de autor y festivales", w: { culto: 3 }, iq: 5 },
      { text: "Thriller y policial que no puedo pausar", w: { maraton: 2, critico: 1 }, iq: 3 },
      { text: "Clásicos y Hollywood dorado", w: { nostalgico: 3 }, iq: 4 },
      { text: "Sci-fi, acción y blockbusters nuevos", w: { estrenos: 3 }, iq: 2 },
    ],
  },
  {
    q: "Cuando termina una gran película:",
    options: [
      { text: "Leo análisis y teorías por horas", w: { critico: 2, culto: 2 }, iq: 5 },
      { text: "Ya estoy dándole play a la siguiente", w: { maraton: 3 }, iq: 1 },
      { text: "La recomiendo a medio mundo", w: { joyas: 3 }, iq: 3 },
      { text: "Vuelvo a ver mis escenas favoritas", w: { nostalgico: 2 }, iq: 2 },
    ],
  },
  {
    q: "Un director que respetas:",
    options: [
      { text: "Uno que nadie de mi grupo conoce", w: { culto: 3 }, iq: 4 },
      { text: "Nolan, Villeneuve… los grandes de hoy", w: { estrenos: 2, critico: 1 }, iq: 3 },
      { text: "Kubrick, Hitchcock… los maestros", w: { nostalgico: 3, critico: 1 }, iq: 5 },
      { text: "No sigo directores, sigo historias", w: { maraton: 2 }, iq: 1 },
    ],
  },
  {
    q: "Tu watchlist tiene sobre todo:",
    options: [
      { text: "Joyas raras que fui juntando por años", w: { joyas: 3, culto: 1 }, iq: 4 },
      { text: "200 series que jamás voy a terminar", w: { maraton: 3 }, iq: 1 },
      { text: "Clásicos que 'tengo que ver sí o sí'", w: { nostalgico: 2 }, iq: 3 },
      { text: "Solo los estrenos de este mes", w: { estrenos: 3 }, iq: 2 },
    ],
  },
  {
    q: "Rating honesto: ¿cuántas ves por semana?",
    options: [
      { text: "Una, pero elegida con cirugía", w: { critico: 2, culto: 2 }, iq: 4 },
      { text: "Siete o más, soy imparable", w: { maraton: 3 }, iq: 2 },
      { text: "Las que pueda, cazando ocultas", w: { joyas: 2 }, iq: 3 },
      { text: "Todos los estrenos que salgan", w: { estrenos: 3 }, iq: 2 },
    ],
  },
  {
    q: "La frase que más te representa:",
    options: [
      { text: "'El cine murió después de los 2000'", w: { nostalgico: 3 }, iq: 3 },
      { text: "'Tengo LA recomendación perfecta para ti'", w: { joyas: 3 }, iq: 3 },
      { text: "'Ya la vi, ya la analicé, siguiente'", w: { critico: 2, maraton: 1 }, iq: 3 },
      { text: "'Estreno nuevo = plan cancelado'", w: { estrenos: 3 }, iq: 2 },
    ],
  },
];

export interface QuizResult {
  archetype: Archetype;
  iq: number;
  topPercent: string; // e.g. "el 3%"
}

/** Computes the archetype + Cinema IQ from the chosen option index per question. */
export function computeResult(answers: number[]): QuizResult {
  const scores: Record<ArchKey, number> = {
    culto: 0,
    maraton: 0,
    critico: 0,
    joyas: 0,
    nostalgico: 0,
    estrenos: 0,
  };
  let rawIq = 0;

  answers.forEach((optIdx, qIdx) => {
    const opt = QUESTIONS[qIdx]?.options[optIdx];
    if (!opt) return;
    rawIq += opt.iq;
    for (const [k, v] of Object.entries(opt.w)) {
      scores[k as ArchKey] += v as number;
    }
  });

  // Winning archetype (ties → declaration order in ARCHETYPES).
  let winner: ArchKey = "culto";
  let best = -1;
  (Object.keys(ARCHETYPES) as ArchKey[]).forEach((k) => {
    if (scores[k] > best) {
      best = scores[k];
      winner = k;
    }
  });

  // IQ: flattering curve — nobody lands below ~60, typical 75-92, rare 95+.
  const iq = Math.max(60, Math.min(99, Math.round(50 + rawIq * 1.18)));

  return { archetype: ARCHETYPES[winner], iq, topPercent: topPercentFor(iq) };
}

function topPercentFor(iq: number): string {
  if (iq >= 97) return "el 1%";
  if (iq >= 93) return "el 3%";
  if (iq >= 89) return "el 7%";
  if (iq >= 84) return "el 15%";
  if (iq >= 78) return "el 30%";
  return "el 45%";
}
