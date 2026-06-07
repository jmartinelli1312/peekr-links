"use client";

import { use, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import JSZip from "jszip";
import { supabase } from "@/lib/supabase";

const BRAND = "#FA0082";
type Lang = "es" | "en" | "pt";

// ─────────────────────────────────────────────────────────────────────────
// i18n
// ─────────────────────────────────────────────────────────────────────────
const I18N: Record<Lang, Record<string, string>> = {
  es: {
    title: "Imports",
    subtitle: "Traé tu historial de otras apps a Peekr.",
    lbName: "Letterboxd",
    lbDesc: "Importá tus películas vistas, calificaciones y reseñas.",
    nfName: "Netflix",
    nfDesc: "Importá tu historial de reproducción.",
    soon: "Próximamente",
    howTitle: "Cómo exportar tu Letterboxd",
    step1: "Entrá a letterboxd.com desde la web (no la app).",
    step2: "Andá a Settings → Data → Export your data.",
    step3: "Se descarga un archivo .zip. Subilo acá abajo.",
    drop: "Arrastrá tu .zip de Letterboxd o hacé click para elegirlo",
    parsing: "Leyendo el archivo…",
    resolving: "Buscando las películas en nuestra base…",
    importing: "Importando…",
    foundWatched: "películas vistas",
    foundReviews: "reseñas",
    foundWatchlist: "en watchlist",
    matched: "encontradas",
    needsReview: "para revisar",
    notFound: "no encontradas",
    includeLow: "Incluir las dudosas (pueden no ser la película correcta)",
    confirm: "Importar a mi perfil",
    cancel: "Elegir otro archivo",
    loginNeeded: "Necesitás iniciar sesión para importar.",
    login: "Iniciar sesión",
    doneTitle: "¡Listo!",
    doneActivities: "películas agregadas a tu perfil",
    doneReviews: "reseñas importadas",
    doneWatchlist: "títulos agregados a tu watchlist",
    doneSkipped: "ya estaban en tu perfil (omitidas)",
    backProfile: "Ver mi perfil",
    importAnother: "Importar otro archivo",
    onlyMovies: "Letterboxd es solo películas — las series no se importan.",
    errorParse: "No pudimos leer el archivo. ¿Es el .zip de Letterboxd?",
    errorGeneric: "Algo salió mal. Probá de nuevo.",
    ratingNote: "Las calificaciones de 0–5 estrellas se convierten a la escala 0–10 de Peekr.",
  },
  en: {
    title: "Imports",
    subtitle: "Bring your history from other apps into Peekr.",
    lbName: "Letterboxd",
    lbDesc: "Import your watched films, ratings and reviews.",
    nfName: "Netflix",
    nfDesc: "Import your viewing history.",
    soon: "Coming soon",
    howTitle: "How to export your Letterboxd",
    step1: "Go to letterboxd.com on the web (not the app).",
    step2: "Open Settings → Data → Export your data.",
    step3: "A .zip file downloads. Upload it below.",
    drop: "Drag your Letterboxd .zip here or click to choose it",
    parsing: "Reading the file…",
    resolving: "Matching your films to our database…",
    importing: "Importing…",
    foundWatched: "watched films",
    foundReviews: "reviews",
    foundWatchlist: "in watchlist",
    matched: "matched",
    needsReview: "to review",
    notFound: "not found",
    includeLow: "Include uncertain matches (may be the wrong film)",
    confirm: "Import to my profile",
    cancel: "Choose another file",
    loginNeeded: "You need to sign in to import.",
    login: "Sign in",
    doneTitle: "Done!",
    doneActivities: "films added to your profile",
    doneReviews: "reviews imported",
    doneWatchlist: "titles added to your watchlist",
    doneSkipped: "were already on your profile (skipped)",
    backProfile: "View my profile",
    importAnother: "Import another file",
    onlyMovies: "Letterboxd is movies only — TV shows are not imported.",
    errorParse: "We couldn't read the file. Is it the Letterboxd .zip?",
    errorGeneric: "Something went wrong. Try again.",
    ratingNote: "0–5 star ratings are converted to Peekr's 0–10 scale.",
  },
  pt: {
    title: "Imports",
    subtitle: "Traga seu histórico de outros apps para o Peekr.",
    lbName: "Letterboxd",
    lbDesc: "Importe seus filmes assistidos, notas e críticas.",
    nfName: "Netflix",
    nfDesc: "Importe seu histórico de reprodução.",
    soon: "Em breve",
    howTitle: "Como exportar seu Letterboxd",
    step1: "Acesse letterboxd.com pela web (não o app).",
    step2: "Vá em Settings → Data → Export your data.",
    step3: "Um arquivo .zip é baixado. Envie-o abaixo.",
    drop: "Arraste seu .zip do Letterboxd aqui ou clique para escolher",
    parsing: "Lendo o arquivo…",
    resolving: "Procurando os filmes na nossa base…",
    importing: "Importando…",
    foundWatched: "filmes assistidos",
    foundReviews: "críticas",
    foundWatchlist: "na watchlist",
    matched: "encontrados",
    needsReview: "para revisar",
    notFound: "não encontrados",
    includeLow: "Incluir os duvidosos (podem não ser o filme certo)",
    confirm: "Importar para meu perfil",
    cancel: "Escolher outro arquivo",
    loginNeeded: "Você precisa entrar para importar.",
    login: "Entrar",
    doneTitle: "Pronto!",
    doneActivities: "filmes adicionados ao seu perfil",
    doneReviews: "críticas importadas",
    doneWatchlist: "títulos adicionados à sua watchlist",
    doneSkipped: "já estavam no seu perfil (ignorados)",
    backProfile: "Ver meu perfil",
    importAnother: "Importar outro arquivo",
    onlyMovies: "Letterboxd é só filmes — séries não são importadas.",
    errorParse: "Não conseguimos ler o arquivo. É o .zip do Letterboxd?",
    errorGeneric: "Algo deu errado. Tente de novo.",
    ratingNote: "Notas de 0–5 estrelas são convertidas para a escala 0–10 do Peekr.",
  },
};

// ─────────────────────────────────────────────────────────────────────────
// CSV parser (RFC4180-ish: handles quotes, embedded commas/newlines, "")
// ─────────────────────────────────────────────────────────────────────────
function parseCSV(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  const s = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else field += c;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }

  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1)
    .filter((r) => r.some((v) => v.trim() !== ""))
    .map((r) => {
      const obj: Record<string, string> = {};
      header.forEach((h, idx) => { obj[h] = (r[idx] ?? "").trim(); });
      return obj;
    });
}

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────
type WatchedFilm = {
  key: string;
  title: string;
  year: number | null;
  rating: number | null;   // already ×2 (0–10)
  watchedAt: string | null; // ISO
  review: string | null;
  rewatch: boolean;
};
type WatchlistFilm = { key: string; title: string; year: number | null };
type Match = {
  id: string;
  tmdb_id: number | null;
  matched_title: string | null;
  poster_path: string | null;
  release_year: number | null;
  confidence: "high" | "medium" | "low" | "none";
};

function filmKey(title: string, year: string | number | null) {
  return `${title.toLowerCase().trim()}__${year ?? ""}`;
}
function toIso(d: string | undefined): string | null {
  if (!d) return null;
  const t = Date.parse(d);
  return isNaN(t) ? null : new Date(t).toISOString();
}
function yearNum(y: string | undefined): number | null {
  const n = Number(y);
  return Number.isFinite(n) && n > 1800 ? n : null;
}

export default function ImportsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: rawLang } = use(params);
  const lang: Lang = rawLang === "en" ? "en" : rawLang === "pt" ? "pt" : "es";
  const t = I18N[lang];

  type Step = "idle" | "parsing" | "resolving" | "preview" | "importing" | "done";
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [needLogin, setNeedLogin] = useState(false);

  const [watched, setWatched] = useState<WatchedFilm[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistFilm[]>([]);
  const [matches, setMatches] = useState<Record<string, Match>>({});
  const [includeLow, setIncludeLow] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ activities: number; reviews: number; watchlist: number; skipped: number } | null>(null);

  const reviewsCount = useMemo(() => watched.filter((w) => w.review).length, [watched]);

  // ── Parse the uploaded zip ──────────────────────────────────────────────
  const onFile = useCallback(async (file: File) => {
    setError(null);
    setStep("parsing");
    try {
      const zip = await JSZip.loadAsync(file);
      const read = async (name: string): Promise<Record<string, string>[]> => {
        // Files can sit at the zip root; match case-insensitively by suffix.
        const entry = Object.keys(zip.files).find(
          (k) => k.toLowerCase().endsWith(name) && !k.toLowerCase().includes("deleted/")
        );
        if (!entry) return [];
        return parseCSV(await zip.files[entry].async("string"));
      };

      const [watchedRows, ratings, diary, reviews, wlRows] = await Promise.all([
        read("watched.csv"),
        read("ratings.csv"),
        read("diary.csv"),
        read("reviews.csv"),
        read("watchlist.csv"),
      ]);

      // Merge everything that implies "watched" into one row per film.
      const map = new Map<string, WatchedFilm>();
      const ensure = (title: string, yearRaw: string): WatchedFilm => {
        const year = yearNum(yearRaw);
        const key = filmKey(title, year);
        let f = map.get(key);
        if (!f) {
          f = { key, title, year, rating: null, watchedAt: null, review: null, rewatch: false };
          map.set(key, f);
        }
        return f;
      };

      for (const r of watchedRows) {
        const f = ensure(r["Name"], r["Year"]);
        f.watchedAt = f.watchedAt || toIso(r["Date"]);
      }
      for (const r of ratings) {
        const f = ensure(r["Name"], r["Year"]);
        const star = parseFloat(r["Rating"]);
        if (Number.isFinite(star)) f.rating = Math.round(star * 2 * 10) / 10; // 0–5 → 0–10
        f.watchedAt = f.watchedAt || toIso(r["Date"]);
      }
      for (const r of diary) {
        const f = ensure(r["Name"], r["Year"]);
        const star = parseFloat(r["Rating"]);
        if (Number.isFinite(star) && f.rating == null) f.rating = Math.round(star * 2 * 10) / 10;
        f.watchedAt = toIso(r["Watched Date"]) || f.watchedAt || toIso(r["Date"]);
        if ((r["Rewatch"] || "").toLowerCase() === "yes") f.rewatch = true;
      }
      for (const r of reviews) {
        const f = ensure(r["Name"], r["Year"]);
        const star = parseFloat(r["Rating"]);
        if (Number.isFinite(star) && f.rating == null) f.rating = Math.round(star * 2 * 10) / 10;
        if (r["Review"]) f.review = r["Review"];
        f.watchedAt = toIso(r["Watched Date"]) || f.watchedAt || toIso(r["Date"]);
        if ((r["Rewatch"] || "").toLowerCase() === "yes") f.rewatch = true;
      }

      const watchedList = Array.from(map.values());

      // Watchlist (only films not already watched).
      const wl: WatchlistFilm[] = [];
      const seen = new Set(watchedList.map((w) => w.key));
      for (const r of wlRows) {
        const year = yearNum(r["Year"]);
        const key = filmKey(r["Name"], year);
        if (seen.has(key)) continue;
        seen.add(key);
        wl.push({ key, title: r["Name"], year });
      }

      if (watchedList.length === 0 && wl.length === 0) {
        setError(t.errorParse);
        setStep("idle");
        return;
      }

      setWatched(watchedList);
      setWatchlist(wl);

      // Resolve to TMDB ids.
      setStep("resolving");
      const films = [
        ...watchedList.map((w) => ({ id: w.key, title: w.title, year: w.year })),
        ...wl.map((w) => ({ id: w.key, title: w.title, year: w.year })),
      ];
      const res = await fetch("/api/import/letterboxd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ films, lang }),
      });
      const json = await res.json();
      const m: Record<string, Match> = {};
      for (const match of (json.matches ?? []) as Match[]) m[match.id] = match;
      setMatches(m);
      setStep("preview");
    } catch (e) {
      console.error("[imports] parse error", e);
      setError(t.errorParse);
      setStep("idle");
    }
  }, [lang, t]);

  // ── Counts for the preview ──────────────────────────────────────────────
  const counts = useMemo(() => {
    const isIncluded = (m?: Match) =>
      m && m.tmdb_id != null && (m.confidence === "high" || m.confidence === "medium" || (includeLow && m.confidence === "low"));
    const w = watched.filter((f) => isIncluded(matches[f.key]));
    const wl = watchlist.filter((f) => isIncluded(matches[f.key]));
    const notFound = [...watched, ...watchlist].filter((f) => {
      const m = matches[f.key];
      return !m || m.tmdb_id == null || m.confidence === "none";
    }).length;
    const lowCount = [...watched, ...watchlist].filter((f) => matches[f.key]?.confidence === "low").length;
    return { watched: w, watchlist: wl, reviews: w.filter((f) => f.review).length, notFound, lowCount };
  }, [watched, watchlist, matches, includeLow]);

  // ── Commit to the DB (authenticated client, RLS-safe) ───────────────────
  const doImport = useCallback(async () => {
    setError(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user?.id;
    if (!uid) { setNeedLogin(true); return; }

    setStep("importing");
    setProgress(0);
    try {
      // Existing data → never overwrite the user's Peekr history.
      const [actsRes, wlRes, comRes] = await Promise.all([
        supabase.from("user_title_activities").select("tmdb_id").eq("user_id", uid),
        supabase.from("watchlist").select("tmdb_id").eq("user_id", uid),
        supabase.from("comments").select("tmdb_id").eq("user_id", uid).is("parent_id", null),
      ]);
      const haveAct = new Set((actsRes.data ?? []).map((r: any) => r.tmdb_id));
      const haveWl = new Set((wlRes.data ?? []).map((r: any) => r.tmdb_id));
      const haveCom = new Set((comRes.data ?? []).map((r: any) => r.tmdb_id));

      const include = (m?: Match) =>
        !!m && m.tmdb_id != null && (m.confidence === "high" || m.confidence === "medium" || (includeLow && m.confidence === "low"));

      // Build de-duped activity + review + watchlist rows.
      const actRows: any[] = [];
      const reviewRows: any[] = [];
      const seenAct = new Set<number>();
      let skipped = 0;

      for (const f of watched) {
        const m = matches[f.key];
        if (!include(m)) continue;
        const tmdb = m!.tmdb_id!;
        if (seenAct.has(tmdb)) continue;
        seenAct.add(tmdb);
        if (haveAct.has(tmdb)) { skipped++; continue; }
        actRows.push({
          user_id: uid,
          tmdb_id: tmdb,
          title: m!.matched_title || f.title,
          media_type: "movie",
          poster_path: m!.poster_path,
          rating: f.rating,
          watched_at: f.watchedAt || new Date().toISOString(),
          release_year: m!.release_year ?? f.year,
          is_rewatch: f.rewatch,
          platform: "letterboxd",
        });
        if (f.review && !haveCom.has(tmdb)) {
          reviewRows.push({ tmdb_id: tmdb, user_id: uid, comment: f.review });
        }
      }

      const wlRows2: any[] = [];
      const seenWl = new Set<number>();
      for (const f of watchlist) {
        const m = matches[f.key];
        if (!include(m)) continue;
        const tmdb = m!.tmdb_id!;
        if (seenWl.has(tmdb) || haveWl.has(tmdb) || seenAct.has(tmdb)) continue;
        seenWl.add(tmdb);
        wlRows2.push({
          user_id: uid,
          tmdb_id: tmdb,
          media_type: "movie",
          title: m!.matched_title || f.title,
          poster_path: m!.poster_path,
        });
      }

      // Chunked inserts so big libraries don't hit payload limits.
      const chunk = <T,>(arr: T[], n: number) =>
        Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
      const total = actRows.length + reviewRows.length + wlRows2.length || 1;
      let done = 0;
      const bump = (n: number) => { done += n; setProgress(Math.round((done / total) * 100)); };

      for (const c of chunk(actRows, 200)) {
        const { error } = await supabase.from("user_title_activities").insert(c);
        if (error) throw error;
        bump(c.length);
      }
      for (const c of chunk(reviewRows, 200)) {
        const { error } = await supabase.from("comments").insert(c);
        if (error) throw error;
        bump(c.length);
      }
      for (const c of chunk(wlRows2, 200)) {
        const { error } = await supabase.from("watchlist").insert(c);
        if (error) throw error;
        bump(c.length);
      }

      setResult({ activities: actRows.length, reviews: reviewRows.length, watchlist: wlRows2.length, skipped });
      setStep("done");
    } catch (e) {
      console.error("[imports] commit error", e);
      setError(t.errorGeneric);
      setStep("preview");
    }
  }, [watched, watchlist, matches, includeLow, t]);

  const reset = () => {
    setStep("idle"); setWatched([]); setWatchlist([]); setMatches({});
    setResult(null); setError(null); setIncludeLow(false); setProgress(0);
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "32px 20px 80px" }}>
      <h1 style={{ fontSize: 30, fontWeight: 800, margin: "0 0 4px" }}>{t.title}</h1>
      <p style={{ color: "#666", margin: "0 0 28px" }}>{t.subtitle}</p>

      {error && (
        <div style={{ background: "#fde8f1", color: "#9b0050", padding: "12px 16px", borderRadius: 12, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* Source cards */}
      {step === "idle" && (
        <>
          <div style={{ display: "grid", gap: 14 }}>
            {/* Letterboxd */}
            <label
              htmlFor="lb-file"
              style={{ ...cardStyle, cursor: "pointer", borderColor: BRAND }}
            >
              <div style={iconBox("#202830")}>Lb</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{t.lbName}</div>
                <div style={{ color: "#666", fontSize: 14 }}>{t.lbDesc}</div>
              </div>
              <div style={{ color: BRAND, fontWeight: 700 }}>+</div>
            </label>
            <input
              id="lb-file"
              type="file"
              accept=".zip"
              style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.currentTarget.value = ""; }}
            />

            {/* Netflix (placeholder) */}
            <div style={{ ...cardStyle, opacity: 0.6 }}>
              <div style={iconBox("#E50914")}>N</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{t.nfName}</div>
                <div style={{ color: "#666", fontSize: 14 }}>{t.nfDesc}</div>
              </div>
              <span style={{ fontSize: 12, color: "#999", border: "1px solid #ddd", borderRadius: 999, padding: "3px 10px" }}>
                {t.soon}
              </span>
            </div>
          </div>

          {/* Letterboxd instructions */}
          <div style={{ marginTop: 28, background: "#faf7f9", borderRadius: 14, padding: "18px 20px" }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>{t.howTitle}</div>
            <ol style={{ margin: 0, paddingLeft: 18, color: "#444", lineHeight: 1.7 }}>
              <li>{t.step1}</li>
              <li>{t.step2}</li>
              <li>{t.step3}</li>
            </ol>
            <p style={{ color: "#888", fontSize: 13, marginTop: 12 }}>{t.onlyMovies}</p>
            <p style={{ color: "#888", fontSize: 13, margin: 0 }}>{t.ratingNote}</p>
          </div>
        </>
      )}

      {(step === "parsing" || step === "resolving" || step === "importing") && (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <div className="lb-spin" style={spinner} />
          <p style={{ color: "#666", marginTop: 18 }}>
            {step === "parsing" ? t.parsing : step === "resolving" ? t.resolving : `${t.importing} ${progress}%`}
          </p>
          <style>{`.lb-spin{animation:lbspin 0.8s linear infinite}@keyframes lbspin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {step === "preview" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 18 }}>
            <Stat n={counts.watched.length} label={t.foundWatched} />
            <Stat n={counts.reviews} label={t.foundReviews} />
            <Stat n={counts.watchlist.length} label={t.foundWatchlist} />
          </div>

          <div style={{ fontSize: 14, color: "#555", marginBottom: 14 }}>
            <span style={{ color: "#1a8a3c", fontWeight: 700 }}>
              {counts.watched.length + counts.watchlist.length} {t.matched}
            </span>
            {counts.lowCount > 0 && <> · {counts.lowCount} {t.needsReview}</>}
            {counts.notFound > 0 && <> · {counts.notFound} {t.notFound}</>}
          </div>

          {counts.lowCount > 0 && (
            <label style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 20, fontSize: 14, color: "#444" }}>
              <input type="checkbox" checked={includeLow} onChange={(e) => setIncludeLow(e.target.checked)} />
              {t.includeLow}
            </label>
          )}

          {needLogin && (
            <div style={{ background: "#fff6e5", borderRadius: 12, padding: "12px 16px", marginBottom: 16 }}>
              {t.loginNeeded}{" "}
              <Link href={`/${lang}/login`} style={{ color: BRAND, fontWeight: 700 }}>{t.login}</Link>
            </div>
          )}

          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={doImport} style={primaryBtn}>{t.confirm}</button>
            <button onClick={reset} style={ghostBtn}>{t.cancel}</button>
          </div>
        </div>
      )}

      {step === "done" && result && (
        <div style={{ textAlign: "center", padding: "30px 0" }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🎉</div>
          <h2 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 18px" }}>{t.doneTitle}</h2>
          <div style={{ display: "inline-grid", gap: 8, textAlign: "left", marginBottom: 24 }}>
            <Done n={result.activities} label={t.doneActivities} />
            <Done n={result.reviews} label={t.doneReviews} />
            <Done n={result.watchlist} label={t.doneWatchlist} />
            {result.skipped > 0 && <Done n={result.skipped} label={t.doneSkipped} muted />}
          </div>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <Link href={`/${lang}`} style={{ ...primaryBtn, textDecoration: "none" }}>{t.backProfile}</Link>
            <button onClick={reset} style={ghostBtn}>{t.importAnother}</button>
          </div>
        </div>
      )}
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Small presentational helpers
// ─────────────────────────────────────────────────────────────────────────
function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div style={{ background: "#faf7f9", borderRadius: 12, padding: "16px 12px", textAlign: "center" }}>
      <div style={{ fontSize: 26, fontWeight: 800, color: BRAND }}>{n}</div>
      <div style={{ fontSize: 12, color: "#666" }}>{label}</div>
    </div>
  );
}
function Done({ n, label, muted }: { n: number; label: string; muted?: boolean }) {
  return (
    <div style={{ color: muted ? "#999" : "#222" }}>
      <strong style={{ color: muted ? "#999" : BRAND }}>{n}</strong> {label}
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 14,
  border: "1.5px solid #e6e6e6", borderRadius: 16, padding: "16px 18px",
};
const iconBox = (bg: string): React.CSSProperties => ({
  width: 44, height: 44, borderRadius: 12, background: bg, color: "#fff",
  display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 16,
});
const spinner: React.CSSProperties = {
  width: 38, height: 38, borderRadius: "50%",
  border: `3px solid #eee`, borderTopColor: BRAND, margin: "0 auto",
};
const primaryBtn: React.CSSProperties = {
  background: BRAND, color: "#fff", border: "none", borderRadius: 999,
  padding: "12px 22px", fontWeight: 700, fontSize: 15, cursor: "pointer",
};
const ghostBtn: React.CSSProperties = {
  background: "transparent", color: "#444", border: "1.5px solid #ddd", borderRadius: 999,
  padding: "12px 22px", fontWeight: 600, fontSize: 15, cursor: "pointer",
};
