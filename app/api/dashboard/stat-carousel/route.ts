import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 90; // 2 slide renders

const TMDB_IMG = "https://image.tmdb.org/t/p";

/**
 * POST /api/dashboard/stat-carousel
 *
 * Body: {
 *   kind: string,                 // e.g. "movies_most_viewed"
 *   heading: string,              // hero title ("Películas más vistas en Peekr")
 *   subtitle: string,             // period + country line ("Últimos 30 días · Argentina")
 *   country: string,              // "AR" | ... | "ALL"
 *   period_label: string,
 *   items: [{ tmdb_id: number, media_type: "movie"|"tv" }]   // top 5, ranked
 * }
 *
 * Generates a 2-slide stat carousel for the creator dashboard:
 *   1. stat_hero — heading over the #1 title's backdrop.
 *   2. stat_list — ranked 1-5 (poster, title, director, year) over the #2
 *      title's backdrop.
 * Slides render via the render_single_slide edge function into the public
 * buzz-slides bucket. A stat_carousels row tracks the result + later publishes.
 *
 * Auth: Bearer token of an admin or an enabled creator-dashboard owner.
 */

interface ItemIn {
  tmdb_id: number;
  media_type: "movie" | "tv";
}

export async function POST(req: NextRequest) {
  const admin = getSupabaseAdmin();

  // ── Auth ───────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const {
    data: { user },
    error: userError,
  } = await admin.auth.getUser(token);
  if (userError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [{ data: prof }, { data: dash }] = await Promise.all([
    admin.from("profiles").select("is_admin").eq("id", user.id).maybeSingle(),
    admin.from("creator_dashboards").select("country_code").eq("user_id", user.id).eq("enabled", true),
  ]);
  const isAdmin = !!prof?.is_admin;
  if (!isAdmin && (dash ?? []).length === 0) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── Body ───────────────────────────────────────────────────────────────────
  const body = (await req.json().catch(() => ({}))) as {
    kind?: string; heading?: string; subtitle?: string;
    country?: string; period_label?: string; items?: ItemIn[];
  };
  const kind = typeof body.kind === "string" ? body.kind : null;
  const heading = typeof body.heading === "string" ? body.heading.slice(0, 120) : null;
  const subtitle = typeof body.subtitle === "string" ? body.subtitle.slice(0, 120) : "";
  const country = typeof body.country === "string" ? body.country.toUpperCase() : "ALL";
  const items = Array.isArray(body.items)
    ? body.items.filter((i): i is ItemIn => typeof i?.tmdb_id === "number" && (i.media_type === "movie" || i.media_type === "tv")).slice(0, 5)
    : [];
  if (!kind || !heading || items.length < 2) {
    return NextResponse.json({ error: "kind, heading and ≥2 items required" }, { status: 400 });
  }
  // Non-admins can only build carousels for countries they own (or nothing else).
  if (!isAdmin) {
    const owned = (dash ?? []).map((d) => String(d.country_code).toUpperCase());
    if (country === "ALL" || !owned.includes(country)) {
      return NextResponse.json({ error: "Forbidden for this country" }, { status: 403 });
    }
  }

  // ── Enrich items from titles_cache ─────────────────────────────────────────
  const ids = items.map((i) => i.tmdb_id);
  const { data: cached } = await admin
    .from("titles_cache")
    .select("tmdb_id, media_type, title_es, title_en, poster_path, poster_es, backdrop_path, backdrop_es, director, release_date")
    .in("tmdb_id", ids);
  type CacheRow = {
    tmdb_id: number; media_type: string; title_es: string | null; title_en: string | null;
    poster_path: string | null; poster_es: string | null;
    backdrop_path: string | null; backdrop_es: string | null;
    director: string | null; release_date: string | null;
  };
  const cacheKey = (id: number, mt: string) => `${mt}:${id}`;
  const byKey = new Map<string, CacheRow>();
  for (const r of (cached ?? []) as CacheRow[]) {
    if (!byKey.has(cacheKey(r.tmdb_id, r.media_type))) byKey.set(cacheKey(r.tmdb_id, r.media_type), r);
  }

  const enriched = items.map((i, idx) => {
    const c = byKey.get(cacheKey(i.tmdb_id, i.media_type));
    const poster = c?.poster_es ?? c?.poster_path ?? null;
    const backdrop = c?.backdrop_es ?? c?.backdrop_path ?? null;
    const year = c?.release_date ? parseInt(String(c.release_date).slice(0, 4), 10) || null : null;
    return {
      rank: idx + 1,
      tmdb_id: i.tmdb_id,
      media_type: i.media_type,
      title: c?.title_es ?? c?.title_en ?? `#${i.tmdb_id}`,
      poster_path: poster,
      posterUrl: poster ? `${TMDB_IMG}/w342${poster}` : null,
      backdropUrl: backdrop ? `${TMDB_IMG}/w1280${backdrop}` : null,
      director: c?.director ?? null,
      year,
    };
  });

  // ── Create the tracking row first (its id names the storage folder) ────────
  const caption = `${heading}${subtitle ? ` — ${subtitle}` : ""}\n\n` +
    enriched.map((e) => `${e.rank}. ${e.title}${e.year ? ` (${e.year})` : ""}`).join("\n") +
    `\n\n📲 Descubre más en peekr.app\n\n#peekr #cine #series #estadisticas #streaming`;

  const { data: rowIns, error: rowErr } = await admin
    .from("stat_carousels")
    .insert({
      user_id: user.id,
      kind,
      country,
      period_label: body.period_label ?? null,
      heading,
      caption,
      items: enriched.map(({ posterUrl: _p, backdropUrl: _b, ...rest }) => rest),
    })
    .select("id")
    .single();
  if (rowErr || !rowIns) {
    return NextResponse.json({ error: `insert: ${rowErr?.message ?? "no row"}` }, { status: 500 });
  }
  const rowId = rowIns.id as string;

  // ── Render the two slides via render_single_slide ──────────────────────────
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Supabase env not configured" }, { status: 500 });
  }

  async function renderSlide(slideIndex: number, type: string, data: unknown): Promise<string> {
    const res = await fetch(`${supabaseUrl}/functions/v1/render_single_slide`, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ draft_id: `stat-${rowId}`, slide_index: slideIndex, type, data }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new Error(`render slide ${slideIndex}: ${res.status} ${await res.text()}`);
    const j = (await res.json()) as { url?: string };
    if (!j.url) throw new Error(`render slide ${slideIndex}: no url`);
    return j.url;
  }

  try {
    const slideUrls = [
      await renderSlide(1, "stat_hero", {
        heading,
        subtitle,
        backdropUrl: enriched[0]?.backdropUrl ?? null,
      }),
      await renderSlide(2, "stat_list", {
        items: enriched.map((e) => ({
          rank: e.rank, posterUrl: e.posterUrl, title: e.title, director: e.director, year: e.year,
        })),
        backdropUrl: enriched[1]?.backdropUrl ?? enriched[0]?.backdropUrl ?? null,
      }),
    ];

    await admin.from("stat_carousels").update({ slide_urls: slideUrls }).eq("id", rowId);
    return NextResponse.json({ ok: true, id: rowId, slide_urls: slideUrls, caption });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg, id: rowId }, { status: 500 });
  }
}
