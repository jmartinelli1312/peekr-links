import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const TMDB_KEY = process.env.TMDB_API_KEY!;
const TMDB_BASE = "https://api.themoviedb.org/3";

function tmdbLanguage(lang: string) {
  if (lang === "es") return "es-ES";
  if (lang === "pt") return "pt-BR";
  return "en-US";
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const q = (searchParams.get("q") || "").trim();
  const tab = searchParams.get("tab") || "titles";
  const lang = searchParams.get("lang") || "es";

  if (!q) {
    return NextResponse.json({ results: [] });
  }

  const apiLang = tmdbLanguage(lang);

  try {
    if (tab === "people") {
      const res = await fetch(
        `${TMDB_BASE}/search/person?api_key=${TMDB_KEY}&language=${apiLang}&query=${encodeURIComponent(q)}`,
        { next: { revalidate: 3600 } }
      );
      const data = await res.json();
      return NextResponse.json({ results: data?.results ?? [] });
    }

    if (tab === "users") {
      const { data } = await supabase
        .from("profiles")
        .select("id,username,display_name,avatar_url")
        .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
        .limit(12);

      return NextResponse.json({ results: data ?? [] });
    }

    // Default: titles
    const res = await fetch(
      `${TMDB_BASE}/search/multi?api_key=${TMDB_KEY}&language=${apiLang}&query=${encodeURIComponent(q)}`,
      { next: { revalidate: 3600 } }
    );
    const data = await res.json();
    const titles = (data?.results ?? []).filter(
      (i: any) => i.media_type === "movie" || i.media_type === "tv"
    );
    return NextResponse.json({ results: titles });
  } catch {
    return NextResponse.json({ results: [] }, { status: 500 });
  }
}
