/**
 * TMDB image picker for cinematic carousel slides.
 *
 * Gemini emits one of four image_kind values plus an entity_hint (a name
 * from the article's entity_matches list). This module resolves that to a
 * real TMDB image URL — we never let the LLM hallucinate URLs.
 *
 * Strategy per kind:
 *   - profile  → /person/{id}/images → profiles[].file_path
 *   - backdrop → /movie/{id}/images or /tv/{id}/images → backdrops[].file_path
 *   - still    → for tv shows, /tv/{id}/season/1/images or aggregate episode
 *                stills; falls back to backdrop. For movies, falls back to backdrop.
 *   - poster   → /movie/{id}/images or /tv/{id}/images → posters[].file_path
 *
 * We rotate through available images so 10 slides don't all reuse the same
 * still — the picker tracks usage count per entity to spread images out.
 */

import type {
  CarouselSlideJson,
  CarouselEntityHint,
  CarouselImageKind,
} from "./carousel-prompt";

const TMDB_BASE = "https://api.themoviedb.org/3";
const IMG_W1280 = "https://image.tmdb.org/t/p/w1280";
const IMG_W780  = "https://image.tmdb.org/t/p/w780";

interface TmdbImagesResp {
  backdrops?: Array<{ file_path: string; vote_average?: number; iso_639_1?: string | null }>;
  posters?:   Array<{ file_path: string; vote_average?: number; iso_639_1?: string | null }>;
  profiles?:  Array<{ file_path: string; vote_average?: number }>;
}

interface EntityImageBank {
  hint: CarouselEntityHint;
  backdrops: string[];   // full URLs, w1280
  posters: string[];     // full URLs, w780
  profiles: string[];    // full URLs, w780
}

/**
 * Fetches up to 12 backdrops + 6 posters per title and up to 8 profiles per
 * person. All requests run in parallel. Failures fall through to an empty
 * bank so the slide just won't have an image and we use a gradient fallback.
 */
export async function buildEntityImageBank(
  entities: CarouselEntityHint[],
  tmdbApiKey: string,
): Promise<Map<string, EntityImageBank>> {
  const bank = new Map<string, EntityImageBank>();

  const tasks = entities.map(async (e) => {
    try {
      const url = e.type === "person"
        ? `${TMDB_BASE}/person/${e.tmdb_id}/images?api_key=${tmdbApiKey}`
        : `${TMDB_BASE}/${e.media_type ?? "movie"}/${e.tmdb_id}/images?api_key=${tmdbApiKey}&include_image_language=en,es,null`;

      const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
      if (!res.ok) {
        bank.set(e.name, { hint: e, backdrops: [], posters: [], profiles: [] });
        return;
      }
      const data = (await res.json()) as TmdbImagesResp;

      // Sort by vote_average desc and prefer English / no-language backdrops
      // (those without burnt-in text). Top 12 backdrops, top 6 posters.
      const backdrops = (data.backdrops ?? [])
        .filter((b) => !b.iso_639_1 || b.iso_639_1 === "en" || b.iso_639_1 === null)
        .sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0))
        .slice(0, 12)
        .map((b) => `${IMG_W1280}${b.file_path}`);

      const posters = (data.posters ?? [])
        .sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0))
        .slice(0, 6)
        .map((p) => `${IMG_W780}${p.file_path}`);

      const profiles = (data.profiles ?? [])
        .sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0))
        .slice(0, 8)
        .map((p) => `${IMG_W780}${p.file_path}`);

      bank.set(e.name, { hint: e, backdrops, posters, profiles });
    } catch {
      bank.set(e.name, { hint: e, backdrops: [], posters: [], profiles: [] });
    }
  });

  await Promise.all(tasks);
  return bank;
}

/**
 * Resolves image URL + credit for each slide. Returns slides decorated with
 * image_url and image_credit. If no image is available, image_url stays null
 * and the renderer falls back to a gradient background.
 */
export function pickSlideImages(
  slides: CarouselSlideJson[],
  bank: Map<string, EntityImageBank>,
  articleFallbackUrl: string | null,
): Array<CarouselSlideJson & { image_url: string | null; image_credit: string | null }> {
  // Track usage counts per (entity, kind) so we rotate through the bank.
  const used: Map<string, Set<string>> = new Map();

  function pickFromBank(
    entityName: string,
    kind: CarouselImageKind,
  ): { url: string; credit: string } | null {
    const b = bank.get(entityName);
    if (!b) return null;

    const candidates =
      kind === "profile" ? b.profiles :
      kind === "poster"  ? b.posters  :
      b.backdrops;
    if (candidates.length === 0) return null;

    const key = `${entityName}|${kind}`;
    const seen = used.get(key) ?? new Set<string>();

    // First unused image; if all used, recycle the first.
    const url = candidates.find((u) => !seen.has(u)) ?? candidates[0];
    seen.add(url);
    used.set(key, seen);

    return { url, credit: `via TMDB · ${entityName}` };
  }

  return slides.map((s) => {
    let resolved: { url: string; credit: string } | null = null;

    if (s.entity_hint) {
      resolved = pickFromBank(s.entity_hint, s.image_kind);
    }

    // Fallback 1: try ANY entity in the bank with the requested kind.
    if (!resolved) {
      for (const [name] of bank) {
        const tryRes = pickFromBank(name, s.image_kind);
        if (tryRes) { resolved = tryRes; break; }
      }
    }

    // Fallback 2: try backdrop from any entity even if a different kind was requested.
    if (!resolved && s.image_kind !== "backdrop") {
      for (const [name] of bank) {
        const tryRes = pickFromBank(name, "backdrop");
        if (tryRes) { resolved = tryRes; break; }
      }
    }

    // Fallback 3: article hero image (single TMDB still cached on the article).
    if (!resolved && articleFallbackUrl) {
      resolved = { url: articleFallbackUrl, credit: "via TMDB" };
    }

    return {
      ...s,
      image_url: resolved?.url ?? null,
      image_credit: resolved?.credit ?? null,
    };
  });
}
