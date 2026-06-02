"use client";

import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  artRangeToUtcIso,
  BRAND,
  fmtInt,
  Lang,
  Panel,
  pickTitle,
  posterUrl,
  TitleRow,
} from "./_shared";

type Range = { from: string; to: string };

type TitlesResult = {
  movies_most_viewed: TitleRow[];
  series_most_viewed: TitleRow[];
  movies_top_rated_peekr: TitleRow[];
  series_top_rated_peekr: TitleRow[];
  movies_top_rated_tmdb: TitleRow[];
  series_top_rated_tmdb: TitleRow[];
};

type Person = {
  id: number;
  name: string;
  profile_path: string | null;
  popularity: number;
  known_for: string[];
};

function TitleGrid({ items, lang, metric }: { items: TitleRow[]; lang: Lang; metric: "views" | "peekr" | "tmdb" }) {
  if (!items || items.length === 0) {
    return <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Sin datos en el período</div>;
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 14 }}>
      {items.map((t, i) => {
        const poster = posterUrl(t.poster_path);
        const badge =
          metric === "views"
            ? `${fmtInt(t.views_count ?? 0)} vistas`
            : metric === "peekr"
            ? `★ ${t.peekr_avg ?? "—"} (${fmtInt(t.ratings_count ?? 0)})`
            : `TMDB ${t.vote_average ?? "—"}`;
        return (
          <div key={`${t.tmdb_id}-${i}`} style={{ minWidth: 0 }}>
            <div
              style={{
                position: "relative",
                aspectRatio: "2 / 3",
                borderRadius: 10,
                overflow: "hidden",
                background: "rgba(255,255,255,0.06)",
              }}
            >
              {poster ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={poster} alt={pickTitle(t, lang)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: 11, color: "rgba(255,255,255,0.4)", padding: 8, textAlign: "center" }}>
                  {pickTitle(t, lang)}
                </div>
              )}
              <div style={{ position: "absolute", top: 6, left: 6, background: "rgba(0,0,0,0.65)", color: "#fff", fontSize: 11, fontWeight: 700, padding: "2px 6px", borderRadius: 6 }}>
                #{i + 1}
              </div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.9)", marginTop: 6, lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
              {pickTitle(t, lang)}
            </div>
            <div style={{ fontSize: 11, color: metric === "views" ? BRAND : "rgba(255,255,255,0.55)", marginTop: 2 }}>{badge}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function TitlesTab({
  supabase,
  range,
  lang,
}: {
  supabase: SupabaseClient;
  range: Range;
  lang: Lang;
}) {
  const [titles, setTitles] = useState<TitlesResult | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const { fromTs, toTsExclusive } = artRangeToUtcIso(range);
      const titlesRes = await supabase.rpc("creator_titles", {
        p_from: fromTs,
        p_to_exclusive: toTsExclusive,
        p_limit: 10,
      });
      if (titlesRes.error) throw titlesRes.error;
      setTitles(titlesRes.data as TitlesResult);

      // Actors come from TMDB via the server route (key never hits the browser)
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (token) {
        const res = await fetch("/api/dashboard/tmdb", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const json = (await res.json()) as { people?: Person[] };
          setPeople(json.people ?? []);
        }
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [supabase, range]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  if (err) {
    return <div style={{ color: "#fca5a5", padding: 16 }}>⚠ {err}</div>;
  }
  if (loading && !titles) {
    return <div style={{ color: "rgba(255,255,255,0.5)", padding: 24 }}>Cargando títulos…</div>;
  }

  return (
    <div style={{ opacity: loading ? 0.6 : 1, transition: "opacity .15s" }}>
      {titles && (
        <>
          <Panel title="Películas más vistas en Peekr" subtitle="Por cantidad de vistas en el país y período">
            <TitleGrid items={titles.movies_most_viewed} lang={lang} metric="views" />
          </Panel>
          <Panel title="Series más vistas en Peekr" subtitle="Por cantidad de vistas en el país y período">
            <TitleGrid items={titles.series_most_viewed} lang={lang} metric="views" />
          </Panel>

          <Panel title="Películas mejor rateadas en Peekr" subtitle="Promedio de rating de usuarios del país (mín. 3 ratings)">
            <TitleGrid items={titles.movies_top_rated_peekr} lang={lang} metric="peekr" />
          </Panel>
          <Panel title="Series mejor rateadas en Peekr" subtitle="Promedio de rating de usuarios del país (mín. 3 ratings)">
            <TitleGrid items={titles.series_top_rated_peekr} lang={lang} metric="peekr" />
          </Panel>

          <Panel title="Películas mejor rateadas en TMDB" subtitle="vote_average de TMDB entre los títulos activos del período">
            <TitleGrid items={titles.movies_top_rated_tmdb} lang={lang} metric="tmdb" />
          </Panel>
          <Panel title="Series mejor rateadas en TMDB" subtitle="vote_average de TMDB entre los títulos activos del período">
            <TitleGrid items={titles.series_top_rated_tmdb} lang={lang} metric="tmdb" />
          </Panel>
        </>
      )}

      <Panel title="Actores trending (TMDB)" subtitle="Personas en tendencia esta semana — global (TMDB no permite filtrar por región)">
        {people.length === 0 ? (
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Sin datos de TMDB</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 14 }}>
            {people.map((p, i) => {
              const photo = posterUrl(p.profile_path);
              return (
                <div key={p.id} style={{ minWidth: 0 }}>
                  <div style={{ position: "relative", aspectRatio: "2 / 3", borderRadius: 10, overflow: "hidden", background: "rgba(255,255,255,0.06)" }}>
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photo} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: 11, color: "rgba(255,255,255,0.4)", padding: 8, textAlign: "center" }}>
                        {p.name}
                      </div>
                    )}
                    <div style={{ position: "absolute", top: 6, left: 6, background: "rgba(0,0,0,0.65)", color: "#fff", fontSize: 11, fontWeight: 700, padding: "2px 6px", borderRadius: 6 }}>
                      #{i + 1}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.9)", marginTop: 6, lineHeight: 1.25 }}>{p.name}</div>
                  {p.known_for.length > 0 && (
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.known_for.join(", ")}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}
