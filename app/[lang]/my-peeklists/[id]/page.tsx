"use client";

import { useEffect, useState, useCallback, useRef, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import BackButton from "@/components/BackButton";

const BRAND = "#FA0082";
const POSTER = "https://image.tmdb.org/t/p/w185";

type Lang = "es" | "en" | "pt";

const I18N: Record<Lang, {
  loading: string;
  back: string;
  notAvailable: string;
  notOwner: string;
  backToMine: string;
  top5Banner: string;
  details: string;
  titleField: string;
  descriptionField: string;
  publicLabel: string;
  privateLabel: string;
  top5Hint: string;
  saveChanges: string;
  saving: string;
  saved: string;
  changesSaved: string;
  titleEmpty: string;
  itemsHeader: (n: number) => string;
  noItems: string;
  movie: string;
  tv: string;
  remove: string;
  addTitle: string;
  searchPlaceholder: string;
  searching: string;
  noResults: string;
  addBtn: string;
  alreadyAdded: string;
  top5Full: string;
  myTop5Title: string;
}> = {
  es: {
    loading: "Cargando…",
    back: "Volver",
    notAvailable: "Peeklist no disponible.",
    notOwner: "No sos el dueño de esta peeklist.",
    backToMine: "← Mis peeklists",
    top5Banner: "Lista Top 5 — título bloqueado, máximo 5 títulos",
    details: "Detalles",
    titleField: "Título",
    descriptionField: "Descripción",
    publicLabel: "Pública",
    privateLabel: "Privada",
    top5Hint: "Los títulos del Top 5 se gestionan automáticamente.",
    saveChanges: "Guardar cambios",
    saving: "Guardando…",
    saved: "Guardado ✓",
    changesSaved: "Cambios guardados.",
    titleEmpty: "El título no puede estar vacío",
    itemsHeader: (n: number) => `Títulos (${n})`,
    noItems: "Todavía no hay títulos. Agregá uno abajo.",
    movie: "Película",
    tv: "Serie",
    remove: "Quitar",
    addTitle: "Agregar un título",
    searchPlaceholder: "Buscar películas o series…",
    searching: "Buscando…",
    noResults: "Sin resultados.",
    addBtn: "+ Agregar",
    alreadyAdded: "Agregada",
    top5Full: "Tu Top 5 está completo. Quitá un título antes de agregar otro.",
    myTop5Title: "Mi top 5",
  },
  en: {
    loading: "Loading…",
    back: "Back",
    notAvailable: "Peeklist not available.",
    notOwner: "You don't own this peeklist.",
    backToMine: "← My peeklists",
    top5Banner: "Top 5 list — title locked, max 5 items",
    details: "Details",
    titleField: "Title",
    descriptionField: "Description",
    publicLabel: "Public",
    privateLabel: "Private",
    top5Hint: "Top 5 titles are managed automatically.",
    saveChanges: "Save changes",
    saving: "Saving…",
    saved: "Saved ✓",
    changesSaved: "Changes saved.",
    titleEmpty: "Title can't be empty",
    itemsHeader: (n: number) => `Items (${n})`,
    noItems: "No items yet. Add some below.",
    movie: "Movie",
    tv: "TV",
    remove: "Remove",
    addTitle: "Add a title",
    searchPlaceholder: "Search movies or shows…",
    searching: "Searching…",
    noResults: "No results.",
    addBtn: "+ Add",
    alreadyAdded: "Added",
    top5Full: "Top 5 list is full. Remove an item before adding another.",
    myTop5Title: "My top 5",
  },
  pt: {
    loading: "Carregando…",
    back: "Voltar",
    notAvailable: "Peeklist indisponível.",
    notOwner: "Você não é o dono desta peeklist.",
    backToMine: "← Minhas peeklists",
    top5Banner: "Lista Top 5 — título bloqueado, máximo de 5 títulos",
    details: "Detalhes",
    titleField: "Título",
    descriptionField: "Descrição",
    publicLabel: "Pública",
    privateLabel: "Privada",
    top5Hint: "Os títulos do Top 5 são gerenciados automaticamente.",
    saveChanges: "Salvar alterações",
    saving: "Salvando…",
    saved: "Salvo ✓",
    changesSaved: "Alterações salvas.",
    titleEmpty: "O título não pode estar vazio",
    itemsHeader: (n: number) => `Títulos (${n})`,
    noItems: "Ainda não há títulos. Adicione um abaixo.",
    movie: "Filme",
    tv: "Série",
    remove: "Remover",
    addTitle: "Adicionar um título",
    searchPlaceholder: "Buscar filmes ou séries…",
    searching: "Buscando…",
    noResults: "Sem resultados.",
    addBtn: "+ Adicionar",
    alreadyAdded: "Adicionado",
    top5Full: "Seu Top 5 está cheio. Remova um título antes de adicionar outro.",
    myTop5Title: "Meu top 5",
  },
};

type Peeklist = {
  id: string;
  title: string | null;
  description: string | null;
  visibility: string | null;
  list_type: string | null;
  created_by: string;
};

type PeeklistItem = {
  id: string;
  tmdb_id: number;
  media_type: string;
  position: number | null;
  title: string | null;
  poster_path: string | null;
};

type TmdbResult = {
  id: number;
  media_type?: string;
  title?: string;
  name?: string;
  poster_path?: string | null;
  release_date?: string;
  first_air_date?: string;
};

export default function MyPeeklistEditorPage({
  params,
}: {
  params: Promise<{ id: string; lang: string }>;
}) {
  const router = useRouter();
  const { id, lang: rawLang } = use(params);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [peeklist, setPeeklist] = useState<Peeklist | null>(null);
  const [items, setItems] = useState<PeeklistItem[]>([]);
  // Language comes from the URL segment (/es/my-peeklists/...,
  // /pt/my-peeklists/...). This way the user's choice in the header
  // bar persists into the editor without any extra storage.
  const lang: Lang = rawLang.startsWith("en")
    ? "en"
    : rawLang.startsWith("pt")
      ? "pt"
      : "es";
  const t = I18N[lang];

  // Metadata edit state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [savingMeta, setSavingMeta] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  // Search state
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<TmdbResult[]>([]);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadAll = useCallback(async (uid: string) => {
    setError(null);
    const [pRes, iRes] = await Promise.all([
      supabase
        .from("peeklists")
        .select(
          "id, title, description, visibility, list_type, created_by"
        )
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("peeklist_items")
        .select("id, tmdb_id, media_type, position, title, poster_path")
        .eq("peeklist_id", id)
        .order("position", { ascending: true }),
    ]);

    if (pRes.error || !pRes.data) {
      setError(pRes.error?.message || "Peeklist not found");
      return;
    }

    const pl = pRes.data as Peeklist;
    if (pl.created_by !== uid) {
      setError("You don't own this peeklist.");
      setPeeklist(null);
      return;
    }

    setPeeklist(pl);
    setTitle(pl.title || "");
    setDescription(pl.description || "");
    setVisibility(pl.visibility === "private" ? "private" : "public");

    // peeklist_items.title / .poster_path can be NULL for rows inserted by
    // the mobile app (which historically only persisted tmdb_id+media_type).
    // Hydrate the missing values from titles_cache in a single round-trip
    // so the editor doesn't show "TMDB 12345" for legacy rows.
    const itemsLoaded = (iRes.data ?? []) as PeeklistItem[];
    const missingIds = itemsLoaded
      .filter((it) => !it.title || !it.poster_path)
      .map((it) => it.tmdb_id);

    if (missingIds.length > 0) {
      const { data: cacheRows } = await supabase
        .from("titles_cache")
        .select(
          "tmdb_id, media_type, title_es, title_en, title_pt, poster_path"
        )
        .in("tmdb_id", missingIds);

      // Key by `${tmdb_id}-${media_type}` because a few TMDB IDs collide
      // across movie/tv namespaces.
      const byKey = new Map<
        string,
        {
          title_es: string | null;
          title_en: string | null;
          title_pt: string | null;
          poster_path: string | null;
        }
      >();
      for (const c of (cacheRows ?? []) as Array<{
        tmdb_id: number;
        media_type: string;
        title_es: string | null;
        title_en: string | null;
        title_pt: string | null;
        poster_path: string | null;
      }>) {
        byKey.set(`${c.tmdb_id}-${c.media_type}`, c);
      }

      for (const it of itemsLoaded) {
        const c = byKey.get(`${it.tmdb_id}-${it.media_type}`);
        if (!c) continue;
        if (!it.title) {
          it.title =
            c.title_es || c.title_en || c.title_pt || null;
        }
        if (!it.poster_path) {
          it.poster_path = c.poster_path || null;
        }
      }
    }

    setItems(itemsLoaded);
  }, [id]);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      setUserId(user.id);
      await loadAll(user.id);
      setLoading(false);
    })();
  }, [router, loadAll]);

  // Debounced TMDB search.
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    const q = query.trim();
    if (!q) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounce.current = setTimeout(async () => {
      try {
        const r = await fetch(
          `/api/search?tab=titles&lang=${lang}&q=${encodeURIComponent(q)}`
        );
        const j = await r.json();
        const items: TmdbResult[] = (j.results ?? []).filter(
          (x: TmdbResult) =>
            x.media_type === "movie" || x.media_type === "tv"
        );
        setResults(items.slice(0, 8));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 280);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query, lang]);

  async function saveMetadata() {
    if (!peeklist) return;
    setSavingMeta(true);
    setError(null);
    try {
      const newTitle = title.trim();
      if (!newTitle) {
        setError(t.titleEmpty);
        return;
      }
      const { error: e } = await supabase
        .from("peeklists")
        .update({
          title: newTitle,
          description: description.trim() || null,
          visibility,
        })
        .eq("id", peeklist.id);
      if (e) throw e;
      setPeeklist((prev) =>
        prev
          ? {
              ...prev,
              title: newTitle,
              description: description.trim() || null,
              visibility,
            }
          : prev
      );
      // Flash a "Saved ✓" confirmation for 2.5s so the user has unambiguous
      // feedback the change persisted. Previously the button just spun and
      // went back to "Save changes" with no visible signal of success.
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingMeta(false);
    }
  }

  async function addItem(r: TmdbResult) {
    if (!peeklist) return;
    setError(null);

    // Skip if already in the list (compare tmdb_id+media_type).
    if (
      items.some(
        (it) => it.tmdb_id === r.id && it.media_type === r.media_type
      )
    ) {
      return;
    }

    const nextPos =
      items.length === 0
        ? 1
        : (items.reduce(
            (m, it) => Math.max(m, it.position ?? 0),
            0
          ) || 0) + 1;

    const { data, error: e } = await supabase
      .from("peeklist_items")
      .insert({
        peeklist_id: peeklist.id,
        tmdb_id: r.id,
        media_type: r.media_type ?? "movie",
        title: r.title ?? r.name ?? null,
        poster_path: r.poster_path ?? null,
        position: nextPos,
      })
      .select("id, tmdb_id, media_type, position, title, poster_path")
      .single();

    if (e) {
      setError(e.message);
      return;
    }
    setItems((prev) => [...prev, data as PeeklistItem]);
    setQuery("");
    setResults([]);
  }

  async function removeItem(itemId: string) {
    setError(null);
    const { error: e } = await supabase
      .from("peeklist_items")
      .delete()
      .eq("id", itemId);
    if (e) {
      setError(e.message);
      return;
    }
    setItems((prev) => prev.filter((it) => it.id !== itemId));
  }

  if (loading) return <Center>{t.loading}</Center>;
  if (!peeklist) {
    return (
      <Center>
        <div style={{ textAlign: "center" }}>
          <p>{error || t.notAvailable}</p>
          <Link href={`/${lang}/my-peeklists`} style={{ color: BRAND }}>
            {t.backToMine}
          </Link>
        </div>
      </Center>
    );
  }

  const isTop5 = peeklist.list_type === "top5";

  return (
    <main className="page">
      <div className="container">
        <BackButton
          label={t.back}
          fallbackHref={`/${lang}/my-peeklists`}
          className="back"
        />

        {/* Top 5 lists always render with the canonical "My top 5" copy,
            same as the public viewer and the mobile app. */}
        <h1>{isTop5 ? t.myTop5Title : peeklist.title || "Untitled"}</h1>
        {isTop5 && <div className="badge">{t.top5Banner}</div>}

        {error && <div className="error">{error}</div>}

        {/* Metadata editor */}
        <section className="card">
          <h2>{t.details}</h2>
          <label className="lbl">
            {t.titleField}
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              disabled={isTop5}
            />
            {isTop5 && <span className="hint">{t.top5Hint}</span>}
          </label>
          <label className="lbl">
            {t.descriptionField}
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={500}
            />
          </label>
          {!isTop5 && (
            <div className="visrow">
              <label>
                <input
                  type="radio"
                  name="vis"
                  checked={visibility === "public"}
                  onChange={() => setVisibility("public")}
                />
                <span>{t.publicLabel}</span>
              </label>
              <label>
                <input
                  type="radio"
                  name="vis"
                  checked={visibility === "private"}
                  onChange={() => setVisibility("private")}
                />
                <span>{t.privateLabel}</span>
              </label>
            </div>
          )}
          <div className="saverow">
            <button onClick={saveMetadata} disabled={savingMeta}>
              {savingMeta
                ? t.saving
                : savedFlash
                  ? t.saved
                  : t.saveChanges}
            </button>
            {savedFlash && <span className="savedMsg">{t.changesSaved}</span>}
          </div>
        </section>

        {/* Items list */}
        <section className="card">
          <h2>{t.itemsHeader(items.length)}</h2>
          {items.length === 0 && <p className="empty">{t.noItems}</p>}
          <ul className="items">
            {items.map((it) => (
              <li key={it.id} className="item">
                <div
                  className="poster"
                  style={
                    it.poster_path
                      ? {
                          backgroundImage: `url(${POSTER}${it.poster_path})`,
                        }
                      : undefined
                  }
                >
                  {!it.poster_path && <span>🎬</span>}
                </div>
                <div className="meta">
                  <div className="t">
                    {it.title || `TMDB ${it.tmdb_id}`}
                  </div>
                  <div className="muted">
                    {it.media_type === "tv" ? t.tv : t.movie}
                    {it.position ? ` · #${it.position}` : ""}
                  </div>
                </div>
                <button
                  className="del"
                  onClick={() => removeItem(it.id)}
                  title={t.remove}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* TMDB search to add new items */}
        {!isTop5 || items.length < 5 ? (
          <section className="card">
            <h2>{t.addTitle}</h2>
            <input
              type="text"
              placeholder={t.searchPlaceholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="search"
            />
            {searching && <p className="muted">{t.searching}</p>}
            {!searching && results.length > 0 && (
              <ul className="results">
                {results.map((r) => {
                  const isTv = r.media_type === "tv";
                  const year = (
                    isTv ? r.first_air_date : r.release_date
                  )?.slice(0, 4);
                  const already = items.some(
                    (it) =>
                      it.tmdb_id === r.id && it.media_type === r.media_type
                  );
                  return (
                    <li key={`${r.media_type}-${r.id}`} className="result">
                      <div
                        className="poster sm"
                        style={
                          r.poster_path
                            ? {
                                backgroundImage: `url(${POSTER}${r.poster_path})`,
                              }
                            : undefined
                        }
                      >
                        {!r.poster_path && <span>🎬</span>}
                      </div>
                      <div className="meta">
                        <div className="t">
                          {r.title || r.name}
                          {year ? (
                            <span className="year">({year})</span>
                          ) : null}
                        </div>
                        <div className="muted">{isTv ? t.tv : t.movie}</div>
                      </div>
                      {already ? (
                        <span className="added">{t.alreadyAdded}</span>
                      ) : (
                        <button onClick={() => addItem(r)} className="add">
                          {t.addBtn}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {!searching && query.trim() && results.length === 0 && (
              <p className="empty">{t.noResults}</p>
            )}
          </section>
        ) : (
          <section className="card">
            <p className="muted">{t.top5Full}</p>
          </section>
        )}
      </div>

      <style jsx>{`
        .page {
          min-height: 100vh;
          background: #08080d;
          color: #fff;
          padding: 24px 16px 96px;
        }
        .container {
          max-width: 760px;
          margin: 0 auto;
        }
        .back {
          color: ${BRAND};
          text-decoration: none;
          font-size: 13px;
          font-weight: 700;
          display: inline-block;
          margin-bottom: 14px;
          background: transparent;
          border: 0;
          padding: 0;
          cursor: pointer;
          font-family: inherit;
        }
        .back:hover {
          opacity: 0.85;
        }
        .saverow {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .savedMsg {
          color: #4ade80;
          font-size: 13px;
          font-weight: 600;
        }
        h1 {
          font-size: 26px;
          font-weight: 900;
          margin: 0 0 6px;
        }
        h2 {
          font-size: 15px;
          font-weight: 700;
          margin: 0 0 12px;
          color: #fff;
        }
        .badge {
          display: inline-block;
          padding: 4px 10px;
          background: ${BRAND}25;
          border: 1px solid ${BRAND}60;
          color: ${BRAND};
          font-size: 12px;
          font-weight: 700;
          border-radius: 999px;
          margin-bottom: 16px;
        }
        .error {
          background: #4a0820;
          border: 1px solid #ff4080;
          color: #ffd0e0;
          padding: 10px 12px;
          border-radius: 8px;
          margin: 12px 0;
          font-size: 13px;
        }
        .card {
          background: #11121a;
          border: 1px solid #ffffff14;
          border-radius: 14px;
          padding: 16px;
          margin-top: 16px;
        }
        .lbl {
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 12px;
          color: #fffa;
          font-weight: 600;
          margin-bottom: 12px;
        }
        .hint {
          color: #fff5;
          font-size: 11px;
          margin-top: 2px;
        }
        input[type="text"],
        textarea,
        .search {
          background: #0a0a10;
          border: 1px solid #ffffff22;
          border-radius: 8px;
          color: #fff;
          padding: 10px 12px;
          font-size: 14px;
          font-family: inherit;
          resize: vertical;
          width: 100%;
          box-sizing: border-box;
        }
        input[type="text"]:focus,
        textarea:focus,
        .search:focus {
          outline: none;
          border-color: ${BRAND};
        }
        input[type="text"]:disabled,
        textarea:disabled {
          opacity: 0.5;
        }
        .visrow {
          display: flex;
          gap: 16px;
          margin-bottom: 12px;
        }
        .visrow label {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          color: #fff;
          cursor: pointer;
        }
        button {
          background: ${BRAND};
          color: #fff;
          border: 0;
          border-radius: 10px;
          padding: 9px 16px;
          font-weight: 800;
          cursor: pointer;
          font-size: 13px;
        }
        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .items,
        .results {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .item,
        .result {
          display: flex;
          align-items: center;
          gap: 10px;
          background: #0d0e15;
          border: 1px solid #ffffff10;
          border-radius: 10px;
          padding: 8px;
        }
        .poster {
          width: 44px;
          height: 64px;
          border-radius: 6px;
          background: #ffffff10 center/cover no-repeat;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
        }
        .poster.sm {
          width: 40px;
          height: 58px;
        }
        .meta {
          flex: 1;
          min-width: 0;
        }
        .t {
          font-weight: 700;
          color: #fff;
          font-size: 14px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .year {
          color: #fff6;
          font-weight: 500;
          margin-left: 6px;
          font-size: 12px;
        }
        .muted {
          color: #fff6;
          font-size: 11px;
          margin-top: 2px;
        }
        .empty {
          color: #fff6;
          font-size: 13px;
          margin: 0;
        }
        .add {
          padding: 6px 10px;
          font-size: 12px;
        }
        .added {
          color: #fff6;
          font-size: 12px;
          padding: 6px 10px;
        }
        .del {
          background: transparent;
          color: #ff6080;
          border: 1px solid #ff608030;
          width: 28px;
          height: 28px;
          padding: 0;
          border-radius: 6px;
          font-size: 12px;
          flex-shrink: 0;
        }
        .del:hover {
          background: #ff608020;
        }
      `}</style>
    </main>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#08080d",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 14,
        padding: 20,
      }}
    >
      {children}
    </div>
  );
}
