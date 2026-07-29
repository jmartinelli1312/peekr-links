"use client";

import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  artRangeToUtcIso,
  BRAND,
  countryName,
  fmtInt,
  Lang,
  Panel,
  pickTitle,
  posterUrl,
  Preset,
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

// ── Stat-carousel generation bar (one per stats panel) ────────────────────────
// Generates a 2-slide branded carousel (hero + top-5 list) for the section's
// current data, then offers publishing to SneakPeeks (own account) and to
// Peekr's IG (admin review queue).

function periodPhrase(preset: Preset, range: Range, lang: Lang): string {
  const map: Record<string, { es: string; pt: string; en: string }> = {
    today: { es: "Hoy", pt: "Hoje", en: "Today" },
    yesterday: { es: "Ayer", pt: "Ontem", en: "Yesterday" },
    "7d": { es: "Últimos 7 días", pt: "Últimos 7 dias", en: "Last 7 days" },
    "30d": { es: "Últimos 30 días", pt: "Últimos 30 dias", en: "Last 30 days" },
    "90d": { es: "Últimos 90 días", pt: "Últimos 90 dias", en: "Last 90 days" },
  };
  const m = map[preset];
  if (m) return m[lang];
  return `${range.from} → ${range.to}`;
}

function StatCarouselBar({
  supabase,
  kind,
  metricLabel,
  items,
  country,
  preset,
  range,
  lang,
}: {
  supabase: SupabaseClient;
  kind: string;
  metricLabel: string;
  items: TitleRow[];
  country: string;
  preset: Preset;
  range: Range;
  lang: Lang;
}) {
  const [busy, setBusy] = useState<null | "gen" | "sneakpeek" | "ig">(null);
  const [result, setResult] = useState<{ id: string; slide_urls: string[] } | null>(null);
  const [published, setPublished] = useState<{ sneakpeek?: boolean; ig?: boolean }>({});
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const mediaType = kind.startsWith("movies") ? "movie" : "tv";
  const top5 = (items ?? []).slice(0, 5);
  const isAll = country === "ALL";

  async function authedPost(path: string, body: unknown) {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) throw new Error("No session");
    return fetch(path, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async function generate() {
    setBusy("gen"); setError(""); setMsg("");
    try {
      const subtitle = `${periodPhrase(preset, range, lang)}${isAll ? "" : ` · ${countryName(country)}`}`;
      const res = await authedPost("/api/dashboard/stat-carousel", {
        kind,
        heading: metricLabel,
        subtitle,
        country,
        period_label: periodPhrase(preset, range, lang),
        items: top5.map((t) => ({ tmdb_id: t.tmdb_id, media_type: mediaType })),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; id?: string; slide_urls?: string[] };
      if (!res.ok || !data.id || !data.slide_urls) setError(data.error ?? `HTTP ${res.status}`);
      else {
        setResult({ id: data.id, slide_urls: data.slide_urls });
        setPublished({});
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function publish(target: "sneakpeek" | "ig") {
    if (!result) return;
    setBusy(target); setError(""); setMsg("");
    try {
      const res = await authedPost("/api/dashboard/stat-carousel/publish", { id: result.id, target });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) setError(data.error ?? `HTTP ${res.status}`);
      else {
        setPublished((p) => ({ ...p, [target]: true }));
        setMsg(
          target === "sneakpeek"
            ? (lang === "en" ? "Published to your SneakPeeks ✓" : lang === "pt" ? "Publicado nos seus SneakPeeks ✓" : "Publicado en tus SneakPeeks ✓")
            : (lang === "en" ? "Sent to Peekr IG review queue ✓" : lang === "pt" ? "Enviado à fila de revisão do IG ✓" : "Enviado a revisión para el IG de Peekr ✓"),
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  if (top5.length < 2) return null;

  const btn = (bg: string, border: string, color: string): React.CSSProperties => ({
    background: bg, border: `1px solid ${border}`, color,
    borderRadius: 8, padding: "7px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer",
  });

  const genLabel = lang === "en" ? "🎨 Generate carousel" : lang === "pt" ? "🎨 Gerar carrossel" : "🎨 Generar carrusel";

  return (
    <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <button style={btn("rgba(204,0,102,0.16)", "rgba(204,0,102,0.55)", "#ff80bf")} onClick={generate} disabled={busy !== null}>
          {busy === "gen" ? "…" : genLabel}
        </button>
        {result && (
          <>
            <button
              style={btn("rgba(34,197,94,0.14)", "rgba(34,197,94,0.5)", "#86efac")}
              onClick={() => publish("sneakpeek")}
              disabled={busy !== null || published.sneakpeek}
            >
              {published.sneakpeek ? "✓ SneakPeeks" : busy === "sneakpeek" ? "…" : "📲 Publicar en SneakPeeks"}
            </button>
            <button
              style={btn("rgba(99,102,241,0.16)", "rgba(99,102,241,0.55)", "#c7d2fe")}
              onClick={() => publish("ig")}
              disabled={busy !== null || published.ig}
            >
              {published.ig ? "✓ IG (en revisión)" : busy === "ig" ? "…" : "📸 Enviar al IG de Peekr"}
            </button>
          </>
        )}
        {msg && <span style={{ fontSize: 12, color: "#86efac" }}>{msg}</span>}
        {error && <span style={{ fontSize: 12, color: "#fca5a5" }}>⚠ {error}</span>}
      </div>
      {result && (
        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          {result.slide_urls.map((u, i) => (
            <a key={u} href={u} target="_blank" rel="noreferrer" style={{ display: "block", width: 132 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt={`slide ${i + 1}`} style={{ width: "100%", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)" }} />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

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
  country,
  preset,
}: {
  supabase: SupabaseClient;
  range: Range;
  lang: Lang;
  country: string;
  preset: Preset;
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
      const titlesRes = await supabase.rpc("cdash_titles", {
        p_from: fromTs,
        p_to_exclusive: toTsExclusive,
        p_limit: 10,
        p_country: country,
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
  }, [supabase, range, country]);

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
            <StatCarouselBar supabase={supabase} kind="movies_most_viewed" metricLabel={t.moviesMostViewed} items={titles.movies_most_viewed} country={country} preset={preset} range={range} lang={lang} />
          </Panel>
          <Panel title={t.seriesMostViewed} subtitle={t.mostViewedSub}>
            <TitleGrid items={titles.series_most_viewed} lang={lang} metric="views" t={t} />
            <StatCarouselBar supabase={supabase} kind="series_most_viewed" metricLabel={t.seriesMostViewed} items={titles.series_most_viewed} country={country} preset={preset} range={range} lang={lang} />
          </Panel>

          <Panel title={t.moviesTopPeekr} subtitle={t.topPeekrSub}>
            <TitleGrid items={titles.movies_top_rated_peekr} lang={lang} metric="peekr" t={t} />
            <StatCarouselBar supabase={supabase} kind="movies_top_rated_peekr" metricLabel={t.moviesTopPeekr} items={titles.movies_top_rated_peekr} country={country} preset={preset} range={range} lang={lang} />
          </Panel>
          <Panel title={t.seriesTopPeekr} subtitle={t.topPeekrSub}>
            <TitleGrid items={titles.series_top_rated_peekr} lang={lang} metric="peekr" t={t} />
            <StatCarouselBar supabase={supabase} kind="series_top_rated_peekr" metricLabel={t.seriesTopPeekr} items={titles.series_top_rated_peekr} country={country} preset={preset} range={range} lang={lang} />
          </Panel>

          <Panel title={t.moviesTopTmdb} subtitle={t.topTmdbSub}>
            <TitleGrid items={titles.movies_top_rated_tmdb} lang={lang} metric="tmdb" t={t} />
            <StatCarouselBar supabase={supabase} kind="movies_top_rated_tmdb" metricLabel={t.moviesTopTmdb} items={titles.movies_top_rated_tmdb} country={country} preset={preset} range={range} lang={lang} />
          </Panel>
          <Panel title={t.seriesTopTmdb} subtitle={t.topTmdbSub}>
            <TitleGrid items={titles.series_top_rated_tmdb} lang={lang} metric="tmdb" t={t} />
            <StatCarouselBar supabase={supabase} kind="series_top_rated_tmdb" metricLabel={t.seriesTopTmdb} items={titles.series_top_rated_tmdb} country={country} preset={preset} range={range} lang={lang} />
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
