/**
 * Prompt builders for the daily Peekrbuzz pipeline. Kept separate from the
 * route so prompts can be unit-tested and tweaked without touching the
 * surrounding I/O glue.
 */

export interface SignalForScoring {
  id: number;
  title: string;
  summary: string | null;
  source_name: string | null;
}

/**
 * Pass 1 — batch scoring. Gemini reads up to ~50 RSS signals and returns a
 * scored shortlist with extracted entities and editorial theme.
 */
export function buildScoringPrompt(signals: SignalForScoring[]): string {
  const lines = signals.map((s) =>
    `[ID: ${s.id}] "${(s.title || "").slice(0, 160)}" | Fuente: ${s.source_name ?? "?"} | ${(s.summary || "").slice(0, 220)}`,
  );

  return `Sos el editor jefe de Peekr, una app social latinoamericana de series y películas. Te paso titulares de noticias de cine y TV scrapeados de RSS en español hoy. Tu tarea es identificar los que tienen MAYOR potencial viral en redes sociales (Instagram, TikTok, Twitter latinoamericanos).

REGLAS DURAS:
1. SOLO interesan noticias de personas FAMOSAS reconocibles globalmente o títulos MAINSTREAM. Descartá:
   - Personas o títulos obscuros que el usuario promedio LATAM no reconozca
   - Noticias muy locales (TV española solamente, sin alcance LATAM)
   - Refritos, opiniones sin protagonista famoso, listas genéricas
   - Spoilers/críticas sin gancho noticioso
2. Para cada noticia elegida, extraé los nombres EXACTOS de:
   - Títulos mencionados (series, películas) — escribilos como aparecen en el original
   - Personas (actores, actrices, directores, showrunners) — nombres completos
3. Asigná score 0-100:
   - 90-100: celebridad mundial top-tier (Tom Cruise, Pedro Pascal, Margot Robbie, Zendaya, etc.) + noticia jugosa
   - 75-89: actor/director reconocible LATAM + noticia con gancho
   - 60-74: serie/peli mainstream + actualización con interés
   - 50-59: nicho fuerte pero potencial limitado
   - <50: DESCARTAR
4. Clasificá editorial_theme:
   - "actualidad" → estrenos, fichajes, declaraciones de actores, premios
   - "lanzamiento" → confirmación o adelanto de nueva serie/película/temporada
   - "historia" → retrospectivas, aniversarios, datos del making-of
   - "dato_peekr" → curiosidades técnicas, cifras de audiencia, ranking
5. Elegí MÁXIMO 12 noticias. Si menos superan el umbral mínimo (50), devolvé menos.

Respondé SOLO con un JSON array, sin markdown ni texto extra:
[
  {
    "signal_id": <number>,
    "score": <0-100>,
    "titles": ["..."],
    "people": ["..."],
    "theme": "actualidad" | "lanzamiento" | "historia" | "dato_peekr",
    "reason": "una frase muy corta justificando"
  }
]

SIGNALS:
${lines.join("\n")}`;
}

export interface RewriteContext {
  original_title: string;
  original_summary: string;
  source_name: string;
  source_url: string;
  titles: string[];
  people: string[];
  theme_hint: string;
}

/**
 * Pass 3 — Gemini rewrites one signal into a Peekrbuzz-voice ES article.
 * Returns JSON: { title, summary, body_html, editorial_theme }.
 */
export function buildRewritePrompt(ctx: RewriteContext): string {
  return `Sos el editor de Peekrbuzz, la sección de noticias de la app Peekr (cine + TV). Reescribí esta noticia en tono Peekr: cercano, entretenido, español neutro LATAM, sin formalidades de medio tradicional español. Hablale al lector de vos.

ORIGINAL (fuente: ${ctx.source_name}):
Título: ${ctx.original_title}
Resumen: ${ctx.original_summary}

Entidades famosas a mencionar naturalmente:
- Títulos: ${ctx.titles.join(", ") || "(ninguno)"}
- Personas: ${ctx.people.join(", ") || "(ninguno)"}

REGLAS:
- title: máximo 90 caracteres, con gancho fuerte, sin clickbait barato
- summary: 1-2 frases, 220 caracteres máximo, deben enganchar a leer
- body_html: 3-4 párrafos <p>, total 250-400 palabras, con datos concretos del original
- NO copies frases del original — reescribí completamente con vocabulario propio
- NO inventes datos que no estén en el original
- NO uses emojis
- NO menciones la fuente original en el cuerpo (queda en metadata)
- editorial_theme: elegí entre "actualidad" | "lanzamiento" | "historia" | "dato_peekr" (sugerencia: ${ctx.theme_hint})

Respondé SOLO con JSON válido sin markdown:
{"title":"...","summary":"...","body_html":"<p>...</p><p>...</p><p>...</p>","editorial_theme":"actualidad"}`;
}

export interface TranslateContext {
  source_title: string;
  source_summary: string;
  source_body_html: string;
  editorial_theme: string;
  target_lang: "en" | "pt";
}

/**
 * Used by the approve-daily endpoint to translate a selected ES article into
 * EN or PT. Cultural adaptation, not literal translation.
 */
export function buildTranslatePrompt(ctx: TranslateContext): string {
  const langLabel = ctx.target_lang === "en" ? "English (US, neutral)" : "Portuguese (Brazilian)";
  return `You are the Peekr editor. Translate this Spanish editorial article into ${langLabel}. Cultural adaptation is welcome — this is editorial, not literal.

KEEP:
- The Peekr voice: friendly, entertaining, audience-aware
- The editorial_theme value
- The same paragraph structure inside body_html
- Tone appropriate for ${langLabel}

REWRITE:
- title (max 90 chars)
- summary (1-2 sentences, max 220 chars)
- body_html (same paragraph count, 250-400 words)

ES original:
Title: ${ctx.source_title}
Summary: ${ctx.source_summary}
Body: ${ctx.source_body_html.replace(/<[^>]+>/g, " ").slice(0, 1500)}

Reply with ONLY this JSON, no markdown:
{"title":"...","summary":"...","body_html":"<p>...</p><p>...</p>","editorial_theme":"${ctx.editorial_theme}"}`;
}
