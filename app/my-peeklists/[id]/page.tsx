"use client";

import { useEffect, useState, useCallback, useRef, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const BRAND = "#FA0082";
const POSTER = "https://image.tmdb.org/t/p/w185";

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
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id } = use(params);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [peeklist, setPeeklist] = useState<Peeklist | null>(null);
  const [items, setItems] = useState<PeeklistItem[]>([]);

  // Metadata edit state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [savingMeta, setSavingMeta] = useState(false);

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
    setItems((iRes.data ?? []) as PeeklistItem[]);
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
          `/api/search?tab=titles&lang=es&q=${encodeURIComponent(q)}`
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
  }, [query]);

  async function saveMetadata() {
    if (!peeklist) return;
    setSavingMeta(true);
    setError(null);
    try {
      const t = title.trim();
      if (!t) {
        setError("Title can't be empty");
        return;
      }
      const { error: e } = await supabase
        .from("peeklists")
        .update({
          title: t,
          description: description.trim() || null,
          visibility,
        })
        .eq("id", peeklist.id);
      if (e) throw e;
      setPeeklist((prev) =>
        prev
          ? {
              ...prev,
              title: t,
              description: description.trim() || null,
              visibility,
            }
          : prev
      );
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

  if (loading) return <Center>Loading…</Center>;
  if (!peeklist) {
    return (
      <Center>
        <div style={{ textAlign: "center" }}>
          <p>{error || "Peeklist not available."}</p>
          <Link href="/my-peeklists" style={{ color: BRAND }}>
            ← Back to my peeklists
          </Link>
        </div>
      </Center>
    );
  }

  const isTop5 = peeklist.list_type === "top5";

  return (
    <main className="page">
      <div className="container">
        <Link href="/my-peeklists" className="back">
          ← My peeklists
        </Link>

        <h1>{peeklist.title || "Untitled"}</h1>
        {isTop5 && (
          <div className="badge">Top 5 list — title locked, max 5 items</div>
        )}

        {error && <div className="error">{error}</div>}

        {/* Metadata editor */}
        <section className="card">
          <h2>Details</h2>
          <label className="lbl">
            Title
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              disabled={isTop5}
            />
            {isTop5 && (
              <span className="hint">
                Top 5 titles are managed automatically.
              </span>
            )}
          </label>
          <label className="lbl">
            Description
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
                <span>Public</span>
              </label>
              <label>
                <input
                  type="radio"
                  name="vis"
                  checked={visibility === "private"}
                  onChange={() => setVisibility("private")}
                />
                <span>Private</span>
              </label>
            </div>
          )}
          <button onClick={saveMetadata} disabled={savingMeta}>
            {savingMeta ? "Saving…" : "Save changes"}
          </button>
        </section>

        {/* Items list */}
        <section className="card">
          <h2>Items ({items.length})</h2>
          {items.length === 0 && (
            <p className="empty">No items yet. Add some below.</p>
          )}
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
                    {it.media_type === "tv" ? "TV" : "Movie"}
                    {it.position ? ` · #${it.position}` : ""}
                  </div>
                </div>
                <button
                  className="del"
                  onClick={() => removeItem(it.id)}
                  title="Remove"
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
            <h2>Add a title</h2>
            <input
              type="text"
              placeholder="Search movies or shows…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="search"
            />
            {searching && <p className="muted">Searching…</p>}
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
                        <div className="muted">{isTv ? "TV" : "Movie"}</div>
                      </div>
                      {already ? (
                        <span className="added">Added</span>
                      ) : (
                        <button onClick={() => addItem(r)} className="add">
                          + Add
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {!searching && query.trim() && results.length === 0 && (
              <p className="empty">No results.</p>
            )}
          </section>
        ) : (
          <section className="card">
            <p className="muted">
              Top 5 list is full. Remove an item before adding another.
            </p>
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
