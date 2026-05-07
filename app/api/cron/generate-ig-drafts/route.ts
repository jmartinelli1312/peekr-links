import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

// ── Auth ──────────────────────────────────────────────────────────────────────

function isAuthorized(request: NextRequest): boolean {
  const auth = request.headers.get("authorization") || "";
  const cronSecret = process.env.CRON_SECRET;
  return !!(cronSecret && auth === `Bearer ${cronSecret}`);
}

// ── Gemini helpers ────────────────────────────────────────────────────────────

async function callGemini(prompt: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 512 },
      }),
      signal: AbortSignal.timeout(30_000),
    }
  );
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
}

function parseGeminiJson(text: string): Record<string, unknown> {
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(cleaned);
}

// ── TMDB helpers ──────────────────────────────────────────────────────────────

async function tmdbGet(path: string): Promise<Record<string, unknown>> {
  const apiKey = process.env.TMDB_API_KEY;
  const url = `https://api.themoviedb.org/3${path}${path.includes("?") ? "&" : "?"}api_key=${apiKey}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`TMDB HTTP ${res.status} for ${path}`);
  return res.json();
}

/**
 * TMDB TV genre IDs to exclude — non-fiction / talk / reality formats.
 * Combined-credits cast items include `genre_ids` per credit.
 */
const EXCLUDED_TV_GENRES = new Set([
  10767, // Talk
  10763, // News
  10764, // Reality
  10766, // Soap
  10762, // Kids (optional — remove if you want animated content)
]);

/**
 * Given a TMDB person id, return up to `limit` real movie/series titles
 * (sorted by popularity, excluding talk shows / reality / news).
 */
async function getFilteredCredits(personId: number, limit = 8): Promise<string[]> {
  try {
    const data = await tmdbGet(`/person/${personId}/combined_credits?language=es-ES`);
    const cast = (data.cast as Array<{
      id: number;
      title?: string;
      name?: string;
      media_type: string;
      genre_ids?: number[];
      popularity?: number;
      character?: string;
    }>) ?? [];

    return cast
      .filter((c) => {
        // Keep movies unconditionally (movies don't have talk show genre)
        if (c.media_type === "movie") return true;
        // For TV, exclude non-fiction genres
        if (c.media_type === "tv") {
          const genres = c.genre_ids ?? [];
          return !genres.some((g) => EXCLUDED_TV_GENRES.has(g));
        }
        return false;
      })
      .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
      .slice(0, limit)
      .map((c) => c.title ?? c.name ?? "")
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Search TMDB for a movie or TV show by title and return:
 * - `posterUrl`: TMDB poster (w780), or null
 * - `tmdbTitle`: canonical title from TMDB
 */
async function findTmdbPoster(query: string): Promise<{ posterUrl: string | null; tmdbTitle: string }> {
  try {
    // Try movie first, then TV
    for (const type of ["movie", "tv"] as const) {
      const data = await tmdbGet(`/search/${type}?query=${encodeURIComponent(query)}&language=es-ES`);
      const results = (data.results as Array<{
        poster_path?: string | null;
        title?: string;
        name?: string;
        popularity?: number;
      }>) ?? [];
      const hit = results.find((r) => r.poster_path);
      if (hit) {
        return {
          posterUrl: `https://image.tmdb.org/t/p/w780${hit.poster_path}`,
          tmdbTitle: String(hit.title ?? hit.name ?? query),
        };
      }
    }
  } catch { /* ignore */ }
  return { posterUrl: null, tmdbTitle: query };
}

// ── Utility ───────────────────────────────────────────────────────────────────

function dayOfYear(d: Date): number {
  const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 0));
  const diff = d.getTime() - start.getTime();
  return Math.floor(diff / 86_400_000);
}

// ── Draft generators ──────────────────────────────────────────────────────────

interface DraftDetail {
  type: string;
  title: string;
}

const ACTORS = [
  "Pedro Almodóvar",
  "Guillermo del Toro",
  "Alfonso Cuarón",
  "Gael García Bernal",
  "Penélope Cruz",
  "Antonio Banderas",
  "Salma Hayek",
  "Ricardo Darín",
  "Lucrecia Martel",
  "Alejandro González Iñárritu",
  "Rodrigo Sorogoyen",
  "Ana de Armas",
  "Diego Luna",
  "Demián Bichir",
  "Fernanda Montenegro",
  "Wagner Moura",
  "Alice Braga",
  "Édgar Ramírez",
  "Eugenio Derbez",
  "Cecilia Roth",
];

async function generateActualidad(
  lang: "es" | "pt",
  admin: ReturnType<typeof import("@/lib/supabase-admin").getSupabaseAdmin>
): Promise<DraftDetail | null> {
  const { data: articles, error } = await admin
    .from("peekrbuzz_articles")
    .select("id, title, summary, image_url, source_name")
    .eq("review_status", "pending_review")
    .eq("is_published", false)
    .eq("language", lang)
    .order("published_at", { ascending: false })
    .limit(1);

  if (error || !articles || articles.length === 0) return null;

  const article = articles[0] as {
    id: string;
    title: string;
    summary: string;
    image_url: string | null;
    source_name: string;
  };

  // ── Ask Gemini to generate content AND identify the main title ────────────
  const prompt =
    `Eres editor de redes sociales de Peekr (app de películas/series para LatAm). Artículo:\n` +
    `Título: ${article.title}\nResumen: ${article.summary}\n\n` +
    `Generá:\n1. Hook impactante (≤80 chars, sin emojis)\n2. 4 puntos clave sobre la película/serie/estreno (≤90 chars c/u)\n` +
    `3. main_title: nombre exacto de la película o serie principal del artículo (o null si no aplica)\n\n` +
    `IMPORTANTE: Si el artículo es sobre una aparición en un talk show o programa de entrevistas (Fallon, Kimmel, Leno, The View, etc.), ` +
    `devuelve main_title con el nombre de la película/serie que promocionaba el invitado, no el talk show.\n\n` +
    `Responde SOLO JSON:\n{"hook":"...","points":["...","...","...","..."],"main_title":"..."}`;

  let geminiText = "";
  try {
    geminiText = await callGemini(prompt);
    const parsed = parseGeminiJson(geminiText);
    const hook_text = String(parsed.hook ?? "");
    const bullet_points = (parsed.points as string[]) ?? [];
    const mainTitle = parsed.main_title ? String(parsed.main_title) : null;

    // ── Resolve poster: prefer TMDB over RSS article image ─────────────────
    let posterUrl: string | null = article.image_url ?? null;
    let seedTitle: string | undefined;

    if (mainTitle) {
      const tmdb = await findTmdbPoster(mainTitle);
      if (tmdb.posterUrl) {
        posterUrl = tmdb.posterUrl;    // ← official TMDB poster, not show photo
        seedTitle = tmdb.tmdbTitle;
      }
    }

    const { error: insertError } = await admin.from("peekrbuzz_ig_queue").insert({
      draft_type: "actualidad",
      article_id: article.id,
      hook_text,
      bullet_points,
      caption: `${hook_text}\n\nLink en bio → PeekrBuzz`,
      seed_poster_url: posterUrl,
      seed_title: seedTitle ?? null,
      source_label: article.source_name,
      status: "pending_review",
      language: lang,
    });

    if (insertError) {
      console.error(`[actualidad-${lang}] Insert error:`, insertError.message);
      return null;
    }

    return { type: `actualidad-${lang}`, title: article.title };
  } catch (err) {
    console.error(`[actualidad-${lang}] Error:`, err instanceof Error ? err.message : err);
    return null;
  }
}

async function generateActor(
  admin: ReturnType<typeof import("@/lib/supabase-admin").getSupabaseAdmin>
): Promise<DraftDetail | null> {
  const today = new Date();
  const person = ACTORS[dayOfYear(today) % ACTORS.length];

  // ── 1. Look up person in TMDB ──────────────────────────────────────────────
  let profileUrl: string | null = null;
  let topCreditsLine = "";

  try {
    const searchData = await tmdbGet(
      `/search/person?query=${encodeURIComponent(person)}&language=es-ES`
    );
    const results = (searchData.results as Array<{
      id: number;
      profile_path?: string | null;
      popularity?: number;
    }>) ?? [];

    const hit = results.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))[0];

    if (hit) {
      // Profile photo from TMDB
      if (hit.profile_path) {
        profileUrl = `https://image.tmdb.org/t/p/w780${hit.profile_path}`;
      }

      // Top movie/series credits, filtered — no talk shows
      const credits = await getFilteredCredits(hit.id);
      if (credits.length > 0) {
        topCreditsLine = `\nPelículas y series principales (solo ficción): ${credits.join(", ")}.`;
      }
    }
  } catch (err) {
    console.warn("[actor] TMDB lookup failed:", err instanceof Error ? err.message : err);
  }

  // ── 2. Generate carousel content with Gemini ───────────────────────────────
  const prompt =
    `Sos editor de Peekr, app de cine para LatAm. Generá un carrusel de Instagram sobre ${person} con ángulo de trayectoria/logros en CINE y SERIES DE FICCIÓN únicamente.${topCreditsLine}\n\n` +
    `IMPORTANTE: No menciones talk shows, programas de entrevistas, apariciones en shows nocturnos ni reality shows. Solo películas y series de ficción.\n\n` +
    `En español:\n1. Hook impactante sobre su carrera en cine/series (≤80 chars)\n2. 4 puntos fascinantes de su filmografía real (≤90 chars c/u)\n3. Caption con CTA y 5 hashtags de cine\n\n` +
    `SOLO JSON:\n{"hook":"...","points":["...","...","...","..."],"caption":"..."}`;

  try {
    const geminiText = await callGemini(prompt);
    const parsed = parseGeminiJson(geminiText);
    const hook_text = String(parsed.hook ?? "");
    const bullet_points = (parsed.points as string[]) ?? [];
    const caption = String(parsed.caption ?? "");

    const { error: insertError } = await admin.from("peekrbuzz_ig_queue").insert({
      draft_type: "actor",
      hook_text,
      bullet_points,
      caption,
      seed_title: person,
      seed_poster_url: profileUrl,   // ← TMDB profile photo, not null
      status: "pending_review",
      language: "es",
    });

    if (insertError) {
      console.error("[actor] Insert error:", insertError.message);
      return null;
    }

    return { type: "actor", title: person };
  } catch (err) {
    console.error("[actor] Error:", err instanceof Error ? err.message : err);
    return null;
  }
}

async function generateLanzamiento(
  admin: ReturnType<typeof import("@/lib/supabase-admin").getSupabaseAdmin>
): Promise<DraftDetail | null> {
  try {
    const today = new Date().toISOString().split("T")[0];
    const upcomingData = await tmdbGet("/movie/upcoming?language=es-ES&region=AR");
    const results = (upcomingData.results as Array<{
      id: number;
      title: string;
      overview: string;
      poster_path: string | null;
      release_date: string;
    }>) ?? [];

    const movie = results.find(
      (m) => m.poster_path !== null && m.release_date > today
    );
    if (!movie) return null;

    const year = movie.release_date.split("-")[0];
    const prompt =
      `Generá un carrusel de Instagram sobre el estreno de "${movie.title}" (${year}). Overview: ${movie.overview}.\n\n` +
      `En español:\n1. Hook (≤80 chars, por qué verla)\n2. 4 razones para no perdérsela (≤90 chars c/u)\n3. Caption con fecha de estreno y 5 hashtags\n\n` +
      `SOLO JSON:\n{"hook":"...","points":["...","...","...","..."],"caption":"..."}`;

    const geminiText = await callGemini(prompt);
    const parsed = parseGeminiJson(geminiText);
    const hook_text = String(parsed.hook ?? "");
    const bullet_points = (parsed.points as string[]) ?? [];
    const caption = String(parsed.caption ?? "");

    const { error: insertError } = await admin.from("peekrbuzz_ig_queue").insert({
      draft_type: "lanzamiento",
      hook_text,
      bullet_points,
      caption,
      seed_title: movie.title,
      seed_poster_url: `https://image.tmdb.org/t/p/w780${movie.poster_path}`,
      status: "pending_review",
      language: "es",
    });

    if (insertError) {
      console.error("[lanzamiento] Insert error:", insertError.message);
      return null;
    }

    return { type: "lanzamiento", title: movie.title };
  } catch (err) {
    console.error("[lanzamiento] Error:", err instanceof Error ? err.message : err);
    return null;
  }
}

async function generateReco(
  admin: ReturnType<typeof import("@/lib/supabase-admin").getSupabaseAdmin>
): Promise<DraftDetail | null> {
  try {
    // Most watchlisted content in the last 7 days
    const { data: topRows } = await admin
      .from("watchlist")
      .select("tmdb_id, media_type")
      .gte("created_at", new Date(Date.now() - 7 * 86_400_000).toISOString());

    let seedId: number;
    let seedMediaType: string;
    let seedTitle = "The Shawshank Redemption";

    if (topRows && topRows.length > 0) {
      // Count occurrences
      const counts: Record<string, { tmdb_id: number; media_type: string; count: number }> = {};
      for (const row of topRows as { tmdb_id: number; media_type: string }[]) {
        const key = `${row.tmdb_id}:${row.media_type}`;
        if (!counts[key]) counts[key] = { tmdb_id: row.tmdb_id, media_type: row.media_type, count: 0 };
        counts[key].count++;
      }
      const top = Object.values(counts).sort((a, b) => b.count - a.count)[0];
      seedId = top.tmdb_id;
      seedMediaType = top.media_type;
    } else {
      seedId = 278;
      seedMediaType = "movie";
    }

    // Fetch TMDB details
    const path = seedMediaType === "tv" ? "/tv" : "/movie";
    const details = await tmdbGet(`${path}/${seedId}?language=es-ES`);
    seedTitle = String((details.title ?? details.name) ?? seedTitle);
    const seedPosterPath = details.poster_path ? String(details.poster_path) : null;

    // Fetch recommendations
    const recoData = await tmdbGet(`${path}/${seedId}/recommendations?language=es-ES`);
    const recos = (recoData.results as Array<{ title?: string; name?: string }> ?? []).slice(0, 4);
    if (recos.length < 2) return null;

    const rec1 = String(recos[0]?.title ?? recos[0]?.name ?? "");
    const rec2 = String(recos[1]?.title ?? recos[1]?.name ?? "");
    const rec3 = String(recos[2]?.title ?? recos[2]?.name ?? rec2);
    const rec4 = String(recos[3]?.title ?? recos[3]?.name ?? rec3);

    const prompt =
      `Generá un carrusel "Si te gustó ${seedTitle}, te recomendamos:" con estas opciones: ${rec1}, ${rec2}, ${rec3}, ${rec4}.\n\n` +
      `En español:\n1. Hook tipo "si sos fan de ${seedTitle}" (≤80 chars)\n` +
      `2. 4 recomendaciones formato "TÍTULO: por qué" (≤90 chars c/u)\n` +
      `3. Caption con CTA a ver más en Peekr + 5 hashtags\n\n` +
      `SOLO JSON:\n{"hook":"...","points":["...","...","...","..."],"caption":"..."}`;

    const geminiText = await callGemini(prompt);
    const parsed = parseGeminiJson(geminiText);
    const hook_text = String(parsed.hook ?? "");
    const bullet_points = (parsed.points as string[]) ?? [];
    const caption = String(parsed.caption ?? "");

    const { error: insertError } = await admin.from("peekrbuzz_ig_queue").insert({
      draft_type: "reco",
      hook_text,
      bullet_points,
      caption,
      seed_title: seedTitle,
      seed_poster_url: seedPosterPath ? `https://image.tmdb.org/t/p/w780${seedPosterPath}` : null,
      status: "pending_review",
      language: "es",
    });

    if (insertError) {
      console.error("[reco] Insert error:", insertError.message);
      return null;
    }

    return { type: "reco", title: seedTitle };
  } catch (err) {
    console.error("[reco] Error:", err instanceof Error ? err.message : err);
    return null;
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = getSupabaseAdmin();

    // Run all draft generators; failures are isolated — a null means "skipped"
    const results = await Promise.allSettled([
      generateActualidad("es", admin),
      generateActualidad("pt", admin),
      generateActor(admin),
      generateLanzamiento(admin),
      generateReco(admin),
    ]);

    const details: DraftDetail[] = [];
    for (const result of results) {
      if (result.status === "fulfilled" && result.value !== null) {
        details.push(result.value);
      } else if (result.status === "rejected") {
        console.error("[generate-ig-drafts] Draft generator rejected:", result.reason);
      }
    }

    return NextResponse.json({
      ok: true,
      drafts_created: details.length,
      details,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[generate-ig-drafts] Unhandled error:", message);
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
