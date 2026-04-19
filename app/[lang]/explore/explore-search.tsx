"use client";

import { useState, useCallback } from "react";
import Link from "next/link";

type Lang = "en" | "es" | "pt";
type TabKey = "titles" | "people" | "users";

const POSTER = "https://image.tmdb.org/t/p/w342";
const PERSON = "https://image.tmdb.org/t/p/w185";

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

interface ExploreSearchProps {
  lang: Lang;
  t: {
    searchPlaceholder: string;
    clear: string;
    search: string;
    titles: string;
    people: string;
    users: string;
    searchResults: string;
    noResults: string;
  };
}

export default function ExploreSearch({ lang, t }: ExploreSearchProps) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<TabKey>("titles");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const doSearch = useCallback(
    async (q: string, currentTab: TabKey) => {
      if (!q.trim()) return;
      setLoading(true);
      setSearched(true);
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(q.trim())}&tab=${currentTab}&lang=${lang}`
        );
        const data = await res.json();
        setResults(data.results ?? []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [lang]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doSearch(query, tab);
  };

  const switchTab = (newTab: TabKey) => {
    setTab(newTab);
    if (query.trim()) {
      doSearch(query, newTab);
    }
  };

  const clearSearch = () => {
    setQuery("");
    setResults([]);
    setSearched(false);
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="search-form">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.searchPlaceholder}
          className="search-input"
        />

        {searched ? (
          <button type="button" onClick={clearSearch} className="btn-secondary">
            {t.clear}
          </button>
        ) : null}

        <button type="submit" className="btn-primary">
          {t.search}
        </button>
      </form>

      {searched ? (
        <div className="bubble-row">
          <button
            type="button"
            className={`bubble ${tab === "titles" ? "active" : ""}`}
            onClick={() => switchTab("titles")}
          >
            {t.titles}
          </button>
          <button
            type="button"
            className={`bubble ${tab === "people" ? "active" : ""}`}
            onClick={() => switchTab("people")}
          >
            {t.people}
          </button>
          <button
            type="button"
            className={`bubble ${tab === "users" ? "active" : ""}`}
            onClick={() => switchTab("users")}
          >
            {t.users}
          </button>
        </div>
      ) : null}

      {searched ? (
        <section style={{ marginTop: 24 }}>
          <h2 className="section-title">
            {t.searchResults} &ldquo;{query}&rdquo;
          </h2>

          {loading ? (
            <div className="empty-state">...</div>
          ) : results.length === 0 ? (
            <div className="empty-state">{t.noResults}</div>
          ) : tab === "titles" ? (
            <div className="search-grid">
              {results.map((item: any) => {
                const title = item.title || item.name || "Untitled";
                const type = item.media_type === "tv" ? "tv" : "movie";
                return (
                  <Link
                    key={`${type}-${item.id}`}
                    href={`/${lang}/title/${type}/${item.id}-${slugify(title)}`}
                    className="poster-card search-card"
                  >
                    {item.poster_path ? (
                      <img
                        src={`${POSTER}${item.poster_path}`}
                        alt={title}
                        className="poster-image"
                      />
                    ) : (
                      <div className="poster-fallback" />
                    )}
                    <div className="poster-meta">
                      <div className="poster-title">{title}</div>
                      <div className="poster-year">
                        {(item.release_date || item.first_air_date || "").slice(0, 4)}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : tab === "people" ? (
            <div className="search-grid people-grid">
              {results.map((p: any) => (
                <Link
                  key={p.id}
                  href={`/${lang}/actor/${p.id}-${slugify(p.name || "person")}`}
                  className="people-search-card"
                >
                  {p.profile_path ? (
                    <img
                      src={`${PERSON}${p.profile_path}`}
                      alt={p.name}
                      className="people-search-image"
                    />
                  ) : (
                    <div className="people-search-fallback" />
                  )}
                  <div className="people-search-name">{p.name}</div>
                  {p.known_for_department ? (
                    <div className="people-search-sub">{p.known_for_department}</div>
                  ) : null}
                </Link>
              ))}
            </div>
          ) : (
            <div className="users-grid">
              {results.map((u: any) => (
                <Link
                  key={u.id}
                  href={`/${lang}/u/${u.username}`}
                  className="user-card"
                >
                  {u.avatar_url ? (
                    <img src={u.avatar_url} alt={u.username} className="user-avatar" />
                  ) : (
                    <div className="user-avatar-fallback" />
                  )}
                  <div>
                    <div className="user-name">{u.display_name || u.username}</div>
                    <div className="user-username">@{u.username}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </>
  );
}
