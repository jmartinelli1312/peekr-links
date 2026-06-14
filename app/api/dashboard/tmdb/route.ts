import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/tmdb
 *
 * Returns trending TMDB people (actors/directors) for the creator dashboard.
 * Auth: Bearer token of an enabled creator (row in creator_dashboards). The
 * TMDB_API_KEY is server-only and never reaches the browser.
 *
 * NOTE: TMDB's /trending/person endpoint is global — it does NOT accept a
 * region filter, so trending people are worldwide, not country-scoped. The
 * creator's country still gates access but does not narrow the people list.
 */

const TMDB_BASE = "https://api.themoviedb.org/3";

type TmdbPerson = {
  id: number;
  name: string;
  profile_path: string | null;
  popularity: number;
  known_for_department?: string;
  known_for?: Array<{
    title?: string;
    name?: string;
    media_type?: string;
  }>;
};

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser(token);
  if (userErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Gate: caller must be an enabled creator.
  const { data: creator } = await supabase
    .from("creator_dashboards")
    .select("country_code")
    .eq("user_id", user.id)
    .eq("enabled", true)
    .limit(1);
  if (!creator || creator.length === 0) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "TMDB not configured" }, { status: 500 });
  }

  try {
    const url = `${TMDB_BASE}/trending/person/week?api_key=${apiKey}&language=es-ES`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) {
      return NextResponse.json(
        { error: `TMDB error ${res.status}` },
        { status: 502 }
      );
    }
    const json = (await res.json()) as { results?: TmdbPerson[] };
    const people = (json.results ?? [])
      .filter((p) => p.known_for_department === "Acting" || !p.known_for_department)
      .slice(0, 20)
      .map((p) => ({
        id: p.id,
        name: p.name,
        profile_path: p.profile_path,
        popularity: Math.round(p.popularity),
        known_for: (p.known_for ?? [])
          .map((k) => k.title || k.name)
          .filter(Boolean)
          .slice(0, 3),
      }));

    return NextResponse.json({ people, country_code: creator[0].country_code });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "TMDB fetch failed" },
      { status: 502 }
    );
  }
}
