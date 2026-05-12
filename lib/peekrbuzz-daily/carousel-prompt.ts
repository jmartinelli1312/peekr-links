/**
 * Prompt + JSON schema for the cinematic Peekrbuzz IG/FB carousel.
 *
 * Input: one published peekrbuzz_articles row (ES) plus its TMDB entity matches.
 * Output: a 10-slide narrative arc following the "FilmMakerLife / video essay"
 * spec — hook (1) → contexto/ascenso (2-4) → conflicto (5-7) → payoff (8-9)
 * → merged THESIS + Peekr CTA (10).
 *
 * Why 10 slides and not 11: Instagram caps carousels at 10 cards. The original
 * spec fused thesis (slide 10) + CTA (slide 11) which we collapse into a single
 * cinematic closing slide.
 *
 * Gemini returns structured JSON; the route maps `image_query` / `image_kind`
 * to actual TMDB URLs via carousel-tmdb-images.ts.
 */

export interface CarouselEntityHint {
  name: string;
  tmdb_id: number;
  type: "person" | "title";
  media_type?: "movie" | "tv" | "person";
  popularity?: number;
}

export interface CarouselArticleInput {
  title: string;
  summary: string;
  body_html: string;
  editorial_theme: string | null;
  source_name: string | null;
  image_url: string | null;
  entities: CarouselEntityHint[];
}

export type CarouselSlideKind = "hook" | "body" | "thesis";
export type CarouselImageKind = "backdrop" | "still" | "profile" | "poster";

export interface CarouselSlideJson {
  n: number;
  kind: CarouselSlideKind;
  headline: string;
  body: string | null;
  image_query: string;
  image_kind: CarouselImageKind;
  /** Entity name from the input list this slide visually anchors on. May be null when generic. */
  entity_hint: string | null;
}

export interface CarouselJson {
  title: string;
  category: string;
  category_emoji: string;
  thesis: string;
  cta: string;
  caption: string;
  hashtags: string;
  mood: string;
  palette: { primary: string; secondary: string; accent: string; bg: string };
  slides: CarouselSlideJson[];
}

const CATEGORIES = [
  { key: "MOVIE STORY",       emoji: "🎬" },
  { key: "ACTOR STORY",       emoji: "💔" },
  { key: "TV STORY",          emoji: "📺" },
  { key: "BEHIND THE SCENES", emoji: "🍿" },
  { key: "FAN THEORY",        emoji: "😱" },
  { key: "HIDDEN DETAILS",    emoji: "👀" },
  { key: "OSCARS",            emoji: "🏆" },
  { key: "HOLLYWOOD",         emoji: "🔥" },
  { key: "CULT CLASSIC",      emoji: "🎞" },
  { key: "TRAGIC STORIES",    emoji: "😭" },
  { key: "STREAMING NEWS",    emoji: "🚨" },
];

function entitiesBlock(entities: CarouselEntityHint[]): string {
  if (entities.length === 0) return "(no entities resolved)";
  return entities
    .slice(0, 8)
    .map((e) => {
      const kind = e.type === "person" ? "PERSON" : `TITLE/${(e.media_type ?? "movie").toUpperCase()}`;
      const pop = e.popularity ? ` pop=${Math.round(e.popularity)}` : "";
      return `- "${e.name}" [${kind}] tmdb=${e.tmdb_id}${pop}`;
    })
    .join("\n");
}

/**
 * Builds the cinematic-carousel prompt. The output schema is strict so the
 * route can deserialize it without retries in the happy path.
 */
export function buildCarouselPrompt(input: CarouselArticleInput): string {
  // Strip HTML for cleaner Gemini context — body_html has <p>/<strong> markup
  // that adds noise without adding information.
  const cleanBody = (input.body_html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4500);

  const categoryList = CATEGORIES.map((c) => `${c.emoji} ${c.key}`).join(" · ");

  return `Sos el director creativo de Peekr — la app social de cine y series para Latinoamérica. Tu tarea es transformar este artículo de PeekrBuzz en un CARRUSEL CINEMATOGRÁFICO PREMIUM de 10 slides para Instagram y Facebook.

El carrusel debe sentirse como un mini-documental emocional, un video essay de cine, una historia humana poderosa. Inspiraciones: FilmMakerLife, LaZona, mini-documentaries, prestige storytelling.

🎯 OBJETIVO
Maximizar retención, shares, saves, follows y comentarios emocionales. El usuario debe sentir: "necesito llegar al final".

📜 ESTRUCTURA NARRATIVA (10 slides — IG topea en 10):

Slide 1 — HOOK
  · Impactante, emocional, polémico, misterioso.
  · MAYÚSCULAS. 6-18 palabras máximo.
  · Debe abrir un loop mental que solo se cierra al llegar al final.

Slides 2-4 — CONTEXTO / ASCENSO
  · Quién era. Qué logró. Por qué importaba.
  · Crear conexión emocional.

Slides 5-7 — CONFLICTO
  · Caída, traición, fracaso, injusticia, tensión, decisiones críticas.
  · Cada slide DEBE aumentar el impacto emocional.

Slides 8-9 — PAYOFF
  · Consecuencia, regreso, legado, revelación, transformación.
  · Debe sentirse poderoso.

Slide 10 — THESIS + CTA (fusionados)
  · "headline" = la tesis reflexiva (en español, frase corta y poderosa).
    Ejemplos de espíritu: "Hollywood solo te recuerda mientras dejes ganancia." / "La fama no protege a nadie." / "Un papel puede cambiarlo todo."
  · "body" = el CTA en español, premium, elegante, minimalista.
    Ejemplos: "Si amás el cine, este es tu lugar. → @peekr.app" /
              "Descubrí qué ver con Peekr." /
              "Seguinos en @peekr.app para más historias."
  · kind = "thesis"

🖼️ IMÁGENES POR SLIDE
Cada slide tiene un "image_query" + "image_kind" + "entity_hint" que el código mapea contra TMDB (no inventes URLs). Reglas:
  · image_kind ∈ ["backdrop","still","profile","poster"]
  · "backdrop" / "still" → para títulos (películas, series, escenas)
  · "profile" → close-up de una persona (actor, director)
  · "poster" → solo si el slide explícitamente habla del estreno/cartel
  · "entity_hint" DEBE ser exactamente uno de los nombres listados en ENTIDADES (o null si el slide es totalmente genérico — evitalo si podés).
  · "image_query" describe brevemente la intención visual ("Pedro Pascal close-up", "The Last of Us climactic scene", "Heath Ledger Joker behind the scenes").

🎨 TONO
Humano, emocional, cinematográfico, inteligente, moderno, compartible.
NUNCA robótico, corporativo, genérico, ni clickbait barato.

📚 CATEGORÍAS (elegí una — la que mejor encuadra el artículo):
${categoryList}

🎨 PALETA
Sugerí 4 hex codes coherentes con el mood del artículo:
  · primary  → color de marca dominante (acento principal del chip)
  · secondary→ acento secundario para gradientes
  · accent   → highlight para palabras clave
  · bg       → fondo base oscuro

💬 CAPTION INSTAGRAM
Una caption en español de 2-4 párrafos cortos:
  1. Hook emocional (2-3 líneas).
  2. Mini-desarrollo (la tesis sin spoilear el carrusel).
  3. CTA con @peekr.app.
  4. Línea de hashtags (los mismos que devolvés en "hashtags").
Total ≤ 1200 caracteres.

#️⃣ HASHTAGS
8-12 hashtags en español relevantes a la historia + cine + Peekr.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📰 ARTÍCULO (PeekrBuzz, ${input.editorial_theme ?? "actualidad"})
TÍTULO: ${input.title}
RESUMEN: ${input.summary}
CUERPO: ${cleanBody}

🎬 ENTIDADES RESUELTAS EN TMDB (usá SOLO estos nombres en entity_hint):
${entitiesBlock(input.entities)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Respondé SOLO con un JSON sin markdown ni texto extra, con este schema exacto:

{
  "title": "string corto identificando este carrusel",
  "category": "una de las categorías de arriba (exacta, mayúsculas)",
  "category_emoji": "emoji correspondiente",
  "thesis": "string — la frase final (slide 10 headline)",
  "cta": "string — la CTA en español (slide 10 body)",
  "caption": "string — caption IG completa",
  "hashtags": "string — hashtags separados por espacio",
  "mood": "string corto describiendo la atmósfera visual",
  "palette": { "primary": "#RRGGBB", "secondary": "#RRGGBB", "accent": "#RRGGBB", "bg": "#RRGGBB" },
  "slides": [
    { "n": 1,  "kind": "hook",   "headline": "...", "body": null, "image_query": "...", "image_kind": "backdrop|still|profile|poster", "entity_hint": "..." },
    { "n": 2,  "kind": "body",   "headline": "...", "body": "...", "image_query": "...", "image_kind": "...", "entity_hint": "..." },
    { "n": 3,  "kind": "body",   "headline": "...", "body": "...", "image_query": "...", "image_kind": "...", "entity_hint": "..." },
    { "n": 4,  "kind": "body",   "headline": "...", "body": "...", "image_query": "...", "image_kind": "...", "entity_hint": "..." },
    { "n": 5,  "kind": "body",   "headline": "...", "body": "...", "image_query": "...", "image_kind": "...", "entity_hint": "..." },
    { "n": 6,  "kind": "body",   "headline": "...", "body": "...", "image_query": "...", "image_kind": "...", "entity_hint": "..." },
    { "n": 7,  "kind": "body",   "headline": "...", "body": "...", "image_query": "...", "image_kind": "...", "entity_hint": "..." },
    { "n": 8,  "kind": "body",   "headline": "...", "body": "...", "image_query": "...", "image_kind": "...", "entity_hint": "..." },
    { "n": 9,  "kind": "body",   "headline": "...", "body": "...", "image_query": "...", "image_kind": "...", "entity_hint": "..." },
    { "n": 10, "kind": "thesis", "headline": "<thesis>", "body": "<cta>", "image_query": "...", "image_kind": "backdrop", "entity_hint": "..." }
  ]
}

Reglas duras de validación:
- EXACTAMENTE 10 slides en el array.
- Slide 1 kind="hook", slide 10 kind="thesis", slides 2-9 kind="body".
- Headlines del hook en MAYÚSCULAS. Body slides en title-case.
- Headlines (slides 2-9) ≤ 12 palabras.
- Body text (slides 2-9) ≤ 24 palabras.
- Sin emojis dentro de los textos de slide (los emojis viven en category_emoji y caption).
- Texto en español rioplatense neutro (sirve para LATAM completo).`;
}

/**
 * Defensive runtime validator — Gemini sometimes drops a key. We don't throw,
 * but we surface what's missing so the route can decide to retry once.
 */
export function validateCarouselJson(json: unknown): string[] {
  const errors: string[] = [];
  if (!json || typeof json !== "object") return ["payload is not an object"];
  const j = json as Record<string, unknown>;

  for (const key of ["title", "category", "thesis", "cta", "caption", "hashtags"]) {
    if (typeof j[key] !== "string" || !(j[key] as string).trim()) {
      errors.push(`missing/empty ${key}`);
    }
  }

  if (!Array.isArray(j.slides)) {
    errors.push("slides not an array");
    return errors;
  }
  const slides = j.slides as Record<string, unknown>[];
  if (slides.length !== 10) errors.push(`expected 10 slides, got ${slides.length}`);

  slides.forEach((s, i) => {
    const expectedN = i + 1;
    if (s.n !== expectedN) errors.push(`slide[${i}].n expected ${expectedN}, got ${s.n}`);
    if (i === 0 && s.kind !== "hook") errors.push(`slide[0].kind must be 'hook'`);
    else if (i === 9 && s.kind !== "thesis") errors.push(`slide[9].kind must be 'thesis'`);
    else if (i > 0 && i < 9 && s.kind !== "body") errors.push(`slide[${i}].kind must be 'body'`);
    if (typeof s.headline !== "string" || !s.headline.trim()) errors.push(`slide[${i}].headline empty`);
    if (typeof s.image_query !== "string") errors.push(`slide[${i}].image_query missing`);
    if (!["backdrop", "still", "profile", "poster"].includes(String(s.image_kind))) {
      errors.push(`slide[${i}].image_kind invalid: ${s.image_kind}`);
    }
  });

  return errors;
}
