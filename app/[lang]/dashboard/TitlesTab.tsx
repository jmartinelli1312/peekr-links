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
import { dashTexts, DashTexts } from "./texts";

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

function TitleGrid({ items, lang, metric, t }: { items: TitleRow[]; lang: Lang; metric: "views" | "peekr" | "tmdb"; t: DashTexts }) {
  if (!items || items.length === 0) {
    return <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>{t.noDataPeriod}</div>;
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 14 }}>
      {items.map((it, i) => {
        const poster = posterUrl(it.poster_path);
        const badge =
          metric === "views"
            ? t.badgeViews(fmtInt(it.views_count ?? 0))
            : metric === "peekr"
            ? `★ ${it.peekr_avg ?? "—"} (${fmtInt(it.ratings_count ?? 0)})`
            : `TMDB ${it.vote_average ?? "—"}`;
        return (
          <div key={`${it.tmdb_id}-${i}`} style={{ minWidth: 0 }}>
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
                <img src={poster} alt={pickTitle(it, lang)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: 11, color: "rgba(255,255,255,0.4)", padding: 8, textAlign: "center" }}>
                  {pickTitle(it, lang)}
                </div>
              )}
              <div style={{ position: "absolute", top: 6, left: 6, background: "rgba(0,0,0,0.65)", color: "#fff", fontSize: 11, fontWeight: 700, padding: "2px 6px", borderRadius: 6 }}>
                #{i + 1}
              </div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.9)", marginTop: 6, lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
              {pickTitle(it, lang)}
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
  const t = dashTexts(lang);
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
    return <div style={{ color: "rgba(255,255,255,0.5)", padding: 24 }}>{t.loadingTitles}</div>;
  }

  return (
    <div style={{ opacity: loading ? 0.6 : 1, transition: "opacity .15s" }}>
      {titles && (
        <>
          <Panel title={t.moviesMostViewed} subtitle={t.mostViewedSub}>
            <TitleGrid items={titles.movies_most_viewed} lang={lang} metric="views" t={t} />
          </Panel>
          <Panel title={t.seriesMostViewed} subtitle={t.mostViewedSub}>
            <TitleGrid items={titles.series_most_viewed} lang={lang} metric="views" t={t} />
          </Panel>

          <Panel title={t.moviesTopPeekr} subtitle={t.topPeekrSub}>
            <TitleGrid items={titles.movies_top_rated_peekr} lang={lang} metric="peekr" t={t} />
          </Panel>
          <Panel title={t.seriesTopPeekr} subtitle={t.topPeekrSub}>
            <TitleGrid items={titles.series_top_rated_peekr} lang={lang} metric="peekr" t={t} />
          </Panel>

          <Panel title={t.moviesTopTmdb} subtitle={t.topTmdbSub}>
            <TitleGrid items={titles.movies_top_rated_tmdb} lang={lang} metric="tmdb" t={t} />
          </Panel>
          <Panel title={t.seriesTopTmdb} subtitle={t.topTmdbSub}>
            <TitleGrid items={titles.series_top_rated_tmdb} lang={lang} metric="tmdb" t={t} />
          </Panel>
        </>
      )}

      <Panel title={t.actorsTitle} subtitle={t.actorsSub}>
        {people.length === 0 ? (
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>{t.noDataTmdb}</div>
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
