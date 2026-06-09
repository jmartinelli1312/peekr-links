"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import JSZip from "jszip";
import { supabase } from "@/lib/supabase";

const BRAND = "#FA0082";
type Lang = "es" | "en" | "pt";

// ─────────────────────────────────────────────────────────────────────────
// Netflix title parsing (mirrors the validated prototype)
// ─────────────────────────────────────────────────────────────────────────
const MARK = /:\s+(Season\s+\d+|Episode|Part\s+\d+|Chapter\s+\d+|Volume\s+\d+|Limited Series)/;

function norm(s: string) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Minimal CSV row splitter for "Title","Date" (Title may contain commas).
function parseCsvRows(text: string): { title: string; date: string }[] {
  const out: { title: string; date: string }[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    if (i === 0 && /title/i.test(line) && /date/i.test(line)) continue; // header
    const m = line.match(/^"(.*?)",\s*"?([^"]*)"?\s*$/);
    if (m) out.push({ title: m[1], date: m[2] });
  }
  return out;
}

function toIso(d: string): string | null {
  // Netflix dates are M/D/YY (e.g. 5/9/26).
  const m = d.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) {
    const t = Date.parse(d);
    return isNaN(t) ? null : new Date(t).toISOString();
  }
  let [, mo, da, yr] = m;
  let y = Number(yr);
  if (y < 100) y += 2000;
  const dt = new Date(Date.UTC(y, Number(mo) - 1, Number(da)));
  return isNaN(dt.getTime()) ? null : dt.toISOString();
}

type ParsedTitle = {
  key: string;
  type: "tv" | "movie" | "ambiguous";
  name: string;
  fullName: string;
  netflixTitle: string;   // what we show
  seasons: number[];
  watchedAt: string | null;
};

function collapse(rows: { title: string; date: string }[]): ParsedTitle[] {
  type G = {
    firstSeg: string;
    full: string;
    rowCount: number;
    marker: boolean;
    hasColon: boolean;
    seasons: Set<number>;
    distinctFull: Set<string>;
    latest: string | null;
  };
  const groups = new Map<string, G>();
  for (const { title, date } of rows) {
    const hasColon = title.includes(": ");
    const firstSeg = hasColon ? title.split(": ")[0].trim() : title.trim();
    const seasonM = title.match(/:\s+Season\s+(\d+)/);
    const hasMarker = MARK.test(title);
    const k = norm(firstSeg);
    const g =
      groups.get(k) ||
      ({ firstSeg, full: title, rowCount: 0, marker: false, hasColon, seasons: new Set(), distinctFull: new Set(), latest: null } as G);
    g.rowCount++;
    g.full = title;
    if (hasMarker) g.marker = true;
    if (seasonM) g.seasons.add(Number(seasonM[1]));
    g.distinctFull.add(title);
    const iso = toIso(date);
    if (iso && (!g.latest || iso > g.latest)) g.latest = iso;
    groups.set(k, g);
  }

  const out: ParsedTitle[] = [];
  for (const g of groups.values()) {
    // series only when there's an Episode/Season marker OR multiple DISTINCT
    // episode strings (a movie watched twice repeats the same string).
    const isSeries = g.marker || g.distinctFull.size > 1;
    let type: ParsedTitle["type"];
    if (isSeries) type = "tv";
    else if (!g.hasColon) type = "movie";
    else type = "ambiguous";
    out.push({
      key: norm(g.firstSeg) + "|" + type,
      type,
      name: g.firstSeg,
      fullName: g.full,
      netflixTitle: g.firstSeg,
      seasons: [...g.seasons].sort((a, b) => a - b),
      watchedAt: g.latest,
    });
  }
  return out;
}

// Best-effort thumbs from a full-export Ratings.csv (Title -> 'up' | 'down').
function parseRatings(text: string): Map<string, "up" | "down"> {
  const map = new Map<string, "up" | "down">();
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return map;
  const header = lines[0].toLowerCase();
  const cols = header.split(",");
  const titleIdx = cols.findIndex((c) => /title/.test(c));
  const ratingIdx = cols.findIndex((c) => /thumb|rating|type/.test(c));
  if (titleIdx === -1 || ratingIdx === -1) return map;
  for (const line of lines.slice(1)) {
    const cells = line.match(/("(?:[^"]|"")*"|[^,]*)/g)?.map((c) => c.replace(/^"|"$/g, "")) ?? [];
    const title = cells[titleIdx];
    const val = (cells[ratingIdx] || "").toLowerCase();
    if (!title) continue;
    if (/up|1|like|love/.test(val)) map.set(norm(title.split(":")[0]), "up");
    else if (/down|2|dislike/.test(val)) map.set(norm(title.split(":")[0]), "down");
  }
  return map;
}

// ─────────────────────────────────────────────────────────────────────────
type Match = {
  key: string;
  tmdb_id: number | null;
  media_type: "tv" | "movie" | null;
  matched_title: string | null;
  poster_path: string | null;
  release_year: number | null;
  tmdb_rating: number | null;
  confidence: "high" | "medium" | "none";
};
type Row = ParsedTitle & {
  match?: Match;
  thumb?: "up" | "down";
  peekrRating: string; // editable 0-10
  peekrReview: string;
  include: boolean;
};

const I18N: Record<Lang, Record<string, string>> = {
  es: {
    title: "Importar de Netflix",
    back: "← Imports",
    step1: "Entrá a netflix.com/viewingactivity (desde la web).",
    step2: "Tocá \"Descargar todo\" — baja un CSV al instante.",
    step3: "Subí ese CSV acá (o el .zip del export completo, que incluye tus 👍/👎).",
    openNetflix: "Abrir Netflix",
    drop: "Subí tu CSV o .zip de Netflix",
    parsing: "Leyendo el archivo…",
    resolving: "Buscando los títulos en TMDB…",
    importing: "Importando…",
    onlyMovies: "Las series se agrupan por show; los episodios se colapsan.",
    skippedExisting: "títulos ya rateados en Peekr no se procesaron (tu data no se toca).",
    matched: "listos para importar",
    review: "para revisar (match dudoso)",
    notFound: "no encontrados",
    colTitle: "Título Netflix",
    colThumb: "👍/👎",
    colMatch: "Match TMDB",
    colRating: "Tu calificación (0-10)",
    colReview: "Tu reseña",
    ratingHint: "Precargado con la nota de TMDB — subila, bajala o dejala.",
    seasonAbbr: "T",
    mediaTv: "serie",
    mediaMovie: "película",
    openTitle: "Abrir en Peekr",
    markAll: "Marcar todos",
    unmarkAll: "Desmarcar todos",
    importBtn: "Importar a mi perfil",
    cancel: "Elegir otro archivo",
    done: "¡Listo!",
    doneAdded: "títulos agregados a tu perfil",
    doneReviews: "reseñas",
    backProfile: "Ver mi perfil",
    again: "Importar otro",
    gateTitle: "Imports es para creadores",
    gateBody: "Por ahora disponible solo para cuentas de creador. Más adelante será parte de Peekr Premium.",
    login: "Iniciar sesión",
    errorParse: "No pudimos leer el archivo. ¿Es el CSV/zip de Netflix?",
    errorGeneric: "Algo salió mal. Probá de nuevo.",
    noRating: "sin nota",
  },
  en: {
    title: "Import from Netflix",
    back: "← Imports",
    step1: "Go to netflix.com/viewingactivity (on the web).",
    step2: "Click \"Download all\" — a CSV downloads instantly.",
    step3: "Upload that CSV here (or the full-export .zip, which includes your 👍/👎).",
    openNetflix: "Open Netflix",
    drop: "Upload your Netflix CSV or .zip",
    parsing: "Reading the file…",
    resolving: "Matching titles on TMDB…",
    importing: "Importing…",
    onlyMovies: "Series are grouped by show; episodes are collapsed.",
    skippedExisting: "titles already rated in Peekr were not processed (your data is untouched).",
    matched: "ready to import",
    review: "to review (uncertain match)",
    notFound: "not found",
    colTitle: "Netflix title",
    colThumb: "👍/👎",
    colMatch: "TMDB match",
    colRating: "Your rating (0-10)",
    colReview: "Your review",
    ratingHint: "Pre-filled with the TMDB score — raise it, lower it, or leave it.",
    seasonAbbr: "S",
    mediaTv: "series",
    mediaMovie: "movie",
    openTitle: "Open on Peekr",
    markAll: "Mark all",
    unmarkAll: "Unmark all",
    importBtn: "Import to my profile",
    cancel: "Choose another file",
    done: "Done!",
    doneAdded: "titles added to your profile",
    doneReviews: "reviews",
    backProfile: "View my profile",
    again: "Import another",
    gateTitle: "Imports is for creators",
    gateBody: "Available only for creator accounts for now. It will become part of Peekr Premium later.",
    login: "Sign in",
    errorParse: "We couldn't read the file. Is it the Netflix CSV/zip?",
    errorGeneric: "Something went wrong. Try again.",
    noRating: "no rating",
  },
  pt: {
    title: "Importar do Netflix",
    back: "← Imports",
    step1: "Acesse netflix.com/viewingactivity (na web).",
    step2: "Clique em \"Baixar tudo\" — um CSV baixa na hora.",
    step3: "Envie esse CSV aqui (ou o .zip do export completo, com seus 👍/👎).",
    openNetflix: "Abrir Netflix",
    drop: "Envie seu CSV ou .zip do Netflix",
    parsing: "Lendo o arquivo…",
    resolving: "Procurando os títulos no TMDB…",
    importing: "Importando…",
    onlyMovies: "As séries são agrupadas por programa; episódios são colapsados.",
    skippedExisting: "títulos já avaliados no Peekr não foram processados (seus dados não são tocados).",
    matched: "prontos para importar",
    review: "para revisar (match incerto)",
    notFound: "não encontrados",
    colTitle: "Título Netflix",
    colThumb: "👍/👎",
    colMatch: "Match TMDB",
    colRating: "Sua nota (0-10)",
    colReview: "Sua crítica",
    ratingHint: "Pré-preenchido com a nota do TMDB — suba, baixe ou deixe.",
    seasonAbbr: "T",
    mediaTv: "série",
    mediaMovie: "filme",
    openTitle: "Abrir no Peekr",
    markAll: "Marcar todos",
    unmarkAll: "Desmarcar todos",
    importBtn: "Importar para meu perfil",
    cancel: "Escolher outro arquivo",
    done: "Pronto!",
    doneAdded: "títulos adicionados ao seu perfil",
    doneReviews: "críticas",
    backProfile: "Ver meu perfil",
    again: "Importar outro",
    gateTitle: "Imports é para criadores",
    gateBody: "Disponível apenas para contas de criador por enquanto. Em breve fará parte do Peekr Premium.",
    login: "Entrar",
    errorParse: "Não conseguimos ler o arquivo. É o CSV/zip do Netflix?",
    errorGeneric: "Algo deu errado. Tente de novo.",
    noRating: "sem nota",
  },
};

export default function NetflixImportPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: rawLang } = use(params);
  const lang: Lang = rawLang === "en" ? "en" : rawLang === "pt" ? "pt" : "es";
  const t = I18N[lang];

  const [access, setAccess] = useState<"checking" | "ok" | "denied" | "anon">("checking");
  type Step = "idle" | "parsing" | "resolving" | "preview" | "importing" | "done";
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);

  const [rows, setRows] = useState<Row[]>([]);
  const [skippedExisting, setSkippedExisting] = useState(0);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ added: number; reviews: number } | null>(null);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      const uid = s.session?.user?.id;
      if (!uid) { setAccess("anon"); return; }
      const { data } = await supabase.from("profiles").select("account_type,creator_status").eq("id", uid).maybeSingle();
      setAccess(data?.account_type === "creator" && data?.creator_status === "approved" ? "ok" : "denied");
    })().catch(() => setAccess("denied"));
  }, []);

  const onFile = useCallback(async (file: File) => {
    setError(null);
    setStep("parsing");
    try {
      let viewingText = "";
      let thumbs = new Map<string, "up" | "down">();

      if (file.name.toLowerCase().endsWith(".zip")) {
        const zip = await JSZip.loadAsync(file);
        // viewing history CSV: any CSV whose header has Title (+ Date)
        for (const name of Object.keys(zip.files)) {
          const low = name.toLowerCase();
          if (!low.endsWith(".csv")) continue;
          const content = await zip.files[name].async("string");
          const head = content.split(/\r?\n/)[0]?.toLowerCase() ?? "";
          if (/title/.test(head) && /date/.test(head) && !viewingText) viewingText = content;
          if (/title/.test(head) && /(thumb|rating)/.test(head)) thumbs = parseRatings(content);
        }
      } else {
        viewingText = await file.text();
      }

      const parsedRows = parseCsvRows(viewingText);
      if (parsedRows.length === 0) { setError(t.errorParse); setStep("idle"); return; }

      let titles = collapse(parsedRows);

      // Skip what's already in Peekr — fetch the viewer's existing tmdb_ids.
      const { data: s } = await supabase.auth.getSession();
      const uid = s.session?.user?.id!;
      const { data: existing } = await supabase.from("user_title_activities").select("tmdb_id").eq("user_id", uid);
      const have = new Set((existing ?? []).map((r: any) => r.tmdb_id));

      // Resolve in chunks.
      setStep("resolving");
      const CHUNK = 100;
      const byKey = new Map<string, Match>();
      for (let i = 0; i < titles.length; i += CHUNK) {
        const slice = titles.slice(i, i + CHUNK).map((x) => ({
          key: x.key, type: x.type, name: x.name, fullName: x.fullName, seasons: x.seasons,
        }));
        const res = await fetch("/api/import/netflix", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ titles: slice }),
        });
        const json = await res.json();
        for (const m of (json.matches ?? []) as Match[]) byKey.set(m.key, m);
        setProgress(Math.round(((i + CHUNK) / titles.length) * 100));
      }

      // Build rows; drop titles already in Peekr (count them).
      let skipped = 0;
      const built: Row[] = [];
      const seenTmdb = new Set<number>();
      for (const ti of titles) {
        const m = byKey.get(ti.key);
        const tmdb = m?.tmdb_id ?? null;
        if (tmdb && have.has(tmdb)) { skipped++; continue; }
        if (tmdb && seenTmdb.has(tmdb)) continue;
        if (tmdb) seenTmdb.add(tmdb);
        const th = thumbs.get(norm(ti.name));
        // Default the Peekr rating to TMDB's score; if TMDB has no rating, use
        // 7.5 as a sensible default. The user can adjust/clear it either way.
        const defaultRating = m?.tmdb_rating != null ? String(m.tmdb_rating) : "7.5";
        built.push({
          ...ti, match: m, thumb: th,
          peekrRating: defaultRating,
          peekrReview: "",
          include: m?.confidence === "high",
        });
      }
      setSkippedExisting(skipped);
      setRows(built);
      setStep("preview");
    } catch (e) {
      console.error("[netflix-import] parse error", e);
      setError(t.errorParse);
      setStep("idle");
    }
  }, [t]);

  const buckets = useMemo(() => {
    const high = rows.filter((r) => r.match?.confidence === "high");
    const medium = rows.filter((r) => r.match?.confidence === "medium");
    const none = rows.filter((r) => !r.match?.tmdb_id);
    return { high, medium, none };
  }, [rows]);

  const setRow = (key: string, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const markAll = (val: boolean) =>
    setRows((prev) => prev.map((r) => (r.match?.confidence === "high" ? { ...r, include: val } : r)));

  const doImport = useCallback(async () => {
    setError(null);
    const { data: s } = await supabase.auth.getSession();
    const uid = s.session?.user?.id;
    if (!uid) { setAccess("anon"); return; }
    setStep("importing");
    setProgress(0);
    try {
      const chosen = rows.filter((r) => r.include && r.match?.tmdb_id);
      const acts: any[] = [];
      const reviews: any[] = [];
      const seen = new Set<number>();
      for (const r of chosen) {
        const tmdb = r.match!.tmdb_id!;
        if (seen.has(tmdb)) continue;
        seen.add(tmdb);
        const ratingNum = r.peekrRating.trim() === "" ? null : Math.max(0, Math.min(10, Number(r.peekrRating)));
        acts.push({
          user_id: uid, tmdb_id: tmdb,
          title: r.match!.matched_title || r.netflixTitle,
          media_type: r.match!.media_type || "movie",
          poster_path: r.match!.poster_path,
          rating: Number.isFinite(ratingNum as number) ? ratingNum : null,
          watched_at: r.watchedAt || new Date().toISOString(),
          release_year: r.match!.release_year,
          platform: "netflix",
        });
        if (r.peekrReview.trim()) reviews.push({ tmdb_id: tmdb, user_id: uid, comment: r.peekrReview.trim() });
      }

      const chunk = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
      const total = acts.length + reviews.length || 1;
      let done = 0;
      for (const c of chunk(acts, 200)) {
        const { error } = await supabase.from("user_title_activities").insert(c);
        if (error) throw error;
        done += c.length; setProgress(Math.round((done / total) * 100));
      }
      for (const c of chunk(reviews, 200)) {
        const { error } = await supabase.from("comments").insert(c);
        if (error) throw error;
        done += c.length; setProgress(Math.round((done / total) * 100));
      }
      setResult({ added: acts.length, reviews: reviews.length });
      setStep("done");
    } catch (e) {
      console.error("[netflix-import] commit error", e);
      setError(t.errorGeneric);
      setStep("preview");
    }
  }, [rows, t]);

  const reset = () => { setStep("idle"); setRows([]); setSkippedExisting(0); setResult(null); setError(null); setProgress(0); };

  // ── Gate ──
  if (access !== "ok") {
    return (
      <main style={{ maxWidth: 560, margin: "0 auto", padding: "48px 20px", textAlign: "center", color: "rgba(255,255,255,0.88)" }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#fff" }}>{t.title}</h1>
        {access === "checking" ? <p style={{ color: "rgba(255,255,255,0.6)", marginTop: 20 }}>…</p> : (
          <div style={{ marginTop: 24, background: "rgba(255,255,255,0.06)", borderRadius: 16, padding: 26 }}>
            <div style={{ fontSize: 38 }}>🎬</div>
            <h2 style={{ fontSize: 20, fontWeight: 800 }}>{t.gateTitle}</h2>
            <p style={{ color: "rgba(255,255,255,0.7)", lineHeight: 1.6 }}>{t.gateBody}</p>
            {access === "anon"
              ? <Link href={`/${lang}/login`} style={primaryBtn}>{t.login}</Link>
              : <Link href={`/${lang}`} style={ghostBtn}>OK</Link>}
          </div>
        )}
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "28px 18px 80px", color: "rgba(255,255,255,0.88)" }}>
      <Link href={`/${lang}/imports`} style={{ color: "#9a9a9a", fontSize: 14, textDecoration: "none" }}>{t.back}</Link>
      <h1 style={{ fontSize: 28, fontWeight: 800, margin: "6px 0 18px", color: "#fff" }}>{t.title}</h1>

      {error && <div style={{ background: "#fde8f1", color: "#9b0050", padding: "12px 16px", borderRadius: 12, marginBottom: 18 }}>{error}</div>}

      {step === "idle" && (
        <>
          <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 14, padding: "18px 20px", marginBottom: 18 }}>
            <ol style={{ margin: 0, paddingLeft: 18, color: "rgba(255,255,255,0.8)", lineHeight: 1.8 }}>
              <li>{t.step1}</li><li>{t.step2}</li><li>{t.step3}</li>
            </ol>
            <a href="https://www.netflix.com/viewingactivity" target="_blank" rel="noreferrer"
               style={{ ...primaryBtn, display: "inline-block", textDecoration: "none", marginTop: 12 }}>
              {t.openNetflix}
            </a>
          </div>
          <label htmlFor="nf-file" style={{ display: "block", border: `1.5px dashed ${BRAND}`, borderRadius: 16, padding: "34px 18px", textAlign: "center", cursor: "pointer", color: "rgba(255,255,255,0.75)" }}>
            {t.drop}
          </label>
          <input id="nf-file" type="file" accept=".csv,.zip" style={{ display: "none" }}
                 onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.currentTarget.value = ""; }} />
          <p style={{ color: "#aaa", fontSize: 13, marginTop: 12 }}>{t.onlyMovies}</p>
        </>
      )}

      {(step === "parsing" || step === "resolving" || step === "importing") && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "rgba(255,255,255,0.75)" }}>
          {step === "parsing" ? t.parsing : step === "resolving" ? `${t.resolving} ${progress}%` : `${t.importing} ${progress}%`}
        </div>
      )}

      {step === "preview" && (
        <div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14, fontSize: 14 }}>
            <span><strong style={{ color: "#34d058" }}>{buckets.high.length}</strong> {t.matched}</span>
            {buckets.medium.length > 0 && <span>· {buckets.medium.length} {t.review}</span>}
            {buckets.none.length > 0 && <span>· {buckets.none.length} {t.notFound}</span>}
          </div>
          {skippedExisting > 0 && (
            <div style={{ background: "#fff6e5", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 14, color: "#7a5b00" }}>
              {skippedExisting} {t.skippedExisting}
            </div>
          )}

          <div style={{ display: "flex", gap: 16, marginBottom: 8 }}>
            <button type="button" onClick={() => markAll(true)} style={linkBtn}>{t.markAll}</button>
            <button type="button" onClick={() => markAll(false)} style={linkBtn}>{t.unmarkAll}</button>
          </div>

          <div style={{ border: "1px solid #e3e3e3", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
            <div style={{ ...trStyle, background: "#f5f5f5", fontWeight: 700, fontSize: 12, color: "#555" }}>
              <div style={{ width: 28, textAlign: "center" }}>
                <input
                  type="checkbox"
                  checked={buckets.high.length > 0 && buckets.high.every((r) => r.include)}
                  onChange={(e) => markAll(e.target.checked)}
                />
              </div>
              <div style={{ flex: 2 }}>{t.colTitle}</div>
              <div style={{ width: 40, textAlign: "center" }}>{t.colThumb}</div>
              <div style={{ flex: 2 }}>{t.colMatch}</div>
              <div style={{ width: 100 }}>{t.colRating}</div>
              <div style={{ flex: 2 }}>{t.colReview}</div>
            </div>
            <div style={{ maxHeight: 460, overflowY: "auto", background: "#fff" }}>
              {buckets.high.map((r) => (
                <div key={r.key} style={{ ...trStyle, opacity: r.include ? 1 : 0.45 }}>
                  <div style={{ width: 28, textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={r.include}
                      onChange={(e) => setRow(r.key, { include: e.target.checked })}
                    />
                  </div>
                  <div style={{ flex: 2, fontSize: 13 }}>
                    <a
                      href={`/${lang}/title/${r.match?.media_type}/${r.match?.tmdb_id}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "#1a1a1a", fontWeight: 600, textDecoration: "underline" }}
                      title={t.openTitle}
                    >
                      {r.netflixTitle}
                    </a>
                    {r.seasons.length > 0 && <span style={{ color: "#999" }}> · {t.seasonAbbr}{r.seasons.join(",")}</span>}
                  </div>
                  <div style={{ width: 40, textAlign: "center" }}>{r.thumb === "up" ? "👍" : r.thumb === "down" ? "👎" : ""}</div>
                  <div style={{ flex: 2, fontSize: 13, color: "#333" }}>
                    {r.match?.matched_title}
                    <span style={{ color: "#999", fontSize: 11 }}> ({r.match?.media_type === "tv" ? t.mediaTv : t.mediaMovie})</span>
                  </div>
                  <div style={{ width: 100 }}>
                    <input type="number" min={0} max={10} step={0.5} value={r.peekrRating}
                           placeholder={t.noRating}
                           onChange={(e) => setRow(r.key, { peekrRating: e.target.value })}
                           style={inputStyle} />
                  </div>
                  <div style={{ flex: 2 }}>
                    <input type="text" value={r.peekrReview}
                           onChange={(e) => setRow(r.key, { peekrReview: e.target.value })}
                           style={inputStyle} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <p style={{ color: "#888", fontSize: 12, marginTop: 8 }}>{t.ratingHint}</p>

          <div style={{ display: "flex", gap: 12, marginTop: 18 }}>
            <button onClick={doImport} style={primaryBtn} disabled={buckets.high.length === 0}>{t.importBtn} ({buckets.high.filter(r => r.include).length})</button>
            <button onClick={reset} style={ghostBtn}>{t.cancel}</button>
          </div>
        </div>
      )}

      {step === "done" && result && (
        <div style={{ textAlign: "center", padding: "30px 0" }}>
          <div style={{ fontSize: 40 }}>🎉</div>
          <h2 style={{ fontSize: 24, fontWeight: 800 }}>{t.done}</h2>
          <p style={{ margin: "10px 0 20px" }}>
            <strong style={{ color: BRAND }}>{result.added}</strong> {t.doneAdded}
            {result.reviews > 0 && <> · <strong style={{ color: BRAND }}>{result.reviews}</strong> {t.doneReviews}</>}
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <Link href={`/${lang}`} style={{ ...primaryBtn, textDecoration: "none" }}>{t.backProfile}</Link>
            <button onClick={reset} style={ghostBtn}>{t.again}</button>
          </div>
        </div>
      )}
    </main>
  );
}

const trStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderBottom: "1px solid #f1f1f1", background: "#fff",
};
const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", border: "1px solid #ddd", borderRadius: 8, padding: "6px 8px", fontSize: 13,
  background: "#fff", color: "#111",
};
const primaryBtn: React.CSSProperties = {
  background: BRAND, color: "#fff", border: "none", borderRadius: 999, padding: "11px 20px", fontWeight: 700, fontSize: 15, cursor: "pointer",
};
const ghostBtn: React.CSSProperties = {
  background: "transparent", color: "rgba(255,255,255,0.85)", border: "1.5px solid rgba(255,255,255,0.25)", borderRadius: 999, padding: "11px 20px", fontWeight: 600, fontSize: 15, cursor: "pointer", textDecoration: "none",
};
const linkBtn: React.CSSProperties = {
  background: "transparent", border: "none", color: BRAND, fontWeight: 700, fontSize: 13, cursor: "pointer", padding: 0,
};
