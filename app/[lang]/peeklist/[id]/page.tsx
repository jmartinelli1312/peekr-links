export const revalidate = 604800; // 7 days — peeklists rarely change

import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";

const TMDB_KEY = process.env.TMDB_API_KEY!;
const TMDB_BASE = "https://api.themoviedb.org/3";
const BRAND = "#FA0082";
const POSTER = "https://image.tmdb.org/t/p/w342";
const SITE = "https://www.peekr.app";

type Lang = "en" | "es" | "pt";

type PageProps = {
  params: Promise<{ lang: string; id: string }>;
};

type PeeklistRow = {
  id: string | number;
  title?: string | null;
  cover_url?: string | null;
  visibility?: string | null;
  created_by?: string | null;
  description?: string | null;
};

type ProfileRow = {
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
};

type PeeklistItemRow = {
  tmdb_id: number;
  title?: string | null;
  poster_path?: string | null;
  media_type?: string | null;
  position?: number | null;
};

function normalizeLang(value?: string | null): Lang {
  const raw = (value || "en").toLowerCase();
  if (raw.startsWith("es")) return "es";
  if (raw.startsWith("pt")) return "pt";
  return "en";
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function titleHref(item: {
  tmdb_id: number;
  media_type?: string | null;
  title?: string | null;
}) {
  const type = item.media_type === "tv" ? "tv" : "movie";
  const rawTitle = item.title || "title";
  return `/title/${type}/${item.tmdb_id}-${slugify(rawTitle)}`;
}

async function getPeeklist(id: string) {
  try {
    const { data } = await supabase
      .from("peeklists")
      .select("id,title,cover_url,visibility,created_by,description")
      .eq("id", id)
      .maybeSingle();

    return (data as PeeklistRow | null) ?? null;
  } catch {
    return null;
  }
}

async function getCreator(userId?: string | null) {
  if (!userId) return null;

  try {
    const { data } = await supabase
      .from("profiles")
      .select("username,display_name,avatar_url")
      .eq("id", userId)
      .maybeSingle();

    return (data as ProfileRow | null) ?? null;
  } catch {
    return null;
  }
}

async function getPeeklistItems(id: string, lang: Lang) {
  try {
    const { data } = await supabase
      .from("peeklist_items")
      .select("tmdb_id,title,poster_path,media_type,position")
      .eq("peeklist_id", id)
      .order("position", { ascending: true });

    const items = ((data as PeeklistItemRow[] | null) ?? []).filter(
      (item) => !!item.tmdb_id
    );

    const apiLang =
      lang === "es" ? "es-ES" : lang === "pt" ? "pt-BR" : "en-US";

    const hydrated = await Promise.all(
      items.map(async (item) => {
        if (item.title && item.title.trim().length > 0) {
          return item;
        }

        try {
          const type = item.media_type === "tv" ? "tv" : "movie";

          const res = await fetch(
            `${TMDB_BASE}/${type}/${item.tmdb_id}?api_key=${TMDB_KEY}&language=${apiLang}`,
            { next: { revalidate: 3600 } }
          );

          if (!res.ok) return item;

          const json = await res.json();

          return {
            ...item,
            title: json.title || json.name || item.title || "Untitled",
            poster_path: item.poster_path || json.poster_path || null,
          };
        } catch {
          return {
            ...item,
            title: item.title || "Untitled",
          };
        }
      })
    );

    return hydrated;
  } catch {
    return [];
  }
}

function getStrings(lang: Lang) {
  return {
    en: {
      creator: "Creator",
      items: "Titles",
      openInApp: "Open in app",
      empty: "This Peeklist has no titles yet.",
      backToLists: "Back to Peeklists",
      untitled: "Untitled Peeklist",
      noDescription:
        "A curated Peeklist built to discover movies and series on Peekr.",
      public: "Public",
      private: "Private",
    },
    es: {
      creator: "Creador",
      items: "Títulos",
      openInApp: "Abrir en app",
      empty: "Esta Peeklist todavía no tiene títulos.",
      backToLists: "Volver a Peeklists",
      untitled: "Peeklist sin título",
      noDescription:
        "Una Peeklist curada para descubrir películas y series en Peekr.",
      public: "Pública",
      private: "Privada",
    },
    pt: {
      creator: "Criador",
      items: "Títulos",
      openInApp: "Abrir no app",
      empty: "Esta Peeklist ainda não tem títulos.",
      backToLists: "Voltar para Peeklists",
      untitled: "Peeklist sem título",
      noDescription:
        "Uma Peeklist curada para descobrir filmes e séries no Peekr.",
      public: "Pública",
      private: "Privada",
    },
  }[lang];
}

export async function generateMetadata({ params }: PageProps) {
  const { lang: rawLang, id } = await params;
  const lang = normalizeLang(rawLang);
  const t = getStrings(lang);

  const peeklist = await getPeeklist(id);

  if (!peeklist) {
    return {
      title: "Peeklist | Peekr",
      description: "Discover curated lists on Peekr.",
      robots: { index: false, follow: true },
      alternates: {
        canonical: `${SITE}/${lang}/peeklist/${id}`,
      },
    };
  }

  const title = peeklist.title || t.untitled;
  const description = peeklist.description || t.noDescription;

  return {
    title: `${title} | Peekr`,
    description,
    // User-generated lists are typically thin content — noindex to avoid
    // diluting crawl budget and hurting site-wide quality signals.
    // Still allow link following so Peekr titles/actors inside get discovered.
    robots: { index: false, follow: true },
    alternates: {
      canonical: `${SITE}/${lang}/peeklist/${id}`,
    },
    openGraph: {
      title: `${title} | Peekr`,
      description,
      url: `${SITE}/${lang}/peeklist/${id}`,
      siteName: "Peekr",
      type: "website",
      images: peeklist.cover_url ? [{ url: peeklist.cover_url }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | Peekr`,
      description,
    },
  };
}

export default async function PeeklistDetailPage({ params }: PageProps) {
  const { lang: rawLang, id } = await params;
  const lang = normalizeLang(rawLang);
  const t = getStrings(lang);

  const peeklist = await getPeeklist(id);
  if (!peeklist) notFound();

 const [creator, items] = await Promise.all([
  getCreator(peeklist.created_by),
  getPeeklistItems(id, lang),
]);

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: peeklist.title || t.untitled,
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `${SITE}${titleHref(item)}`,
      name: item.title || "Title",
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />

      <style>{`
        .peeklist-page {
          display: flex;
          flex-direction: column;
          gap: 34px;
        }

        .peeklist-back {
          display: inline-flex;
          width: fit-content;
          color: rgba(255,255,255,0.72);
          text-decoration: none;
          font-size: 14px;
          font-weight: 700;
        }

        .peeklist-hero {
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
          align-items: start;
        }

        .peeklist-cover-wrap {
          width: 100%;
          max-width: 520px;
        }

        .peeklist-cover,
        .peeklist-cover-fallback {
          width: 100%;
          aspect-ratio: 16 / 9;
          border-radius: 24px;
          object-fit: cover;
          display: block;
          background: linear-gradient(135deg, ${BRAND}, rgba(255,255,255,0.08));
          border: 1px solid rgba(255,255,255,0.08);
        }

        .peeklist-copy h1 {
          margin: 0;
          font-size: clamp(40px, 9vw, 68px);
          line-height: 0.98;
          letter-spacing: -0.05em;
          font-weight: 900;
          color: white;
        }

        .peeklist-copy p {
          margin: 16px 0 0 0;
          max-width: 760px;
          color: rgba(255,255,255,0.74);
          font-size: 17px;
          line-height: 1.75;
        }

        .peeklist-meta {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 18px;
        }

        .meta-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 10px 14px;
          border-radius: 999px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          color: white;
          font-size: 14px;
          font-weight: 700;
        }

        .creator-row {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-top: 18px;
        }

        .creator-avatar,
        .creator-avatar-fallback {
          width: 40px;
          height: 40px;
          border-radius: 999px;
          object-fit: cover;
          background: rgba(255,255,255,0.08);
          display: block;
        }

        .creator-text {
          color: rgba(255,255,255,0.74);
          font-size: 14px;
          line-height: 1.5;
        }

        .creator-text a {
          color: white;
          text-decoration: none;
          font-weight: 700;
        }

        .hero-actions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 22px;
        }

        .btn-primary {
          text-decoration: none;
          border-radius: 16px;
          padding: 14px 18px;
          font-weight: 800;
          font-size: 15px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: ${BRAND};
          color: white;
        }

        .section h2 {
          margin: 0 0 18px 0;
          font-size: clamp(30px, 7vw, 38px);
          line-height: 1.02;
          color: white;
          font-weight: 900;
          letter-spacing: -0.03em;
        }

        .titles-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .title-card {
          text-decoration: none;
          color: white;
        }

        .title-poster,
        .title-poster-fallback {
          width: 100%;
          aspect-ratio: 2 / 3;
          border-radius: 16px;
          object-fit: cover;
          display: block;
          background: rgba(255,255,255,0.08);
        }

        .title-meta {
          margin-top: 10px;
        }

        .title-name {
          font-size: 14px;
          font-weight: 700;
          line-height: 1.4;
          color: rgba(255,255,255,0.96);
        }

        .title-sub {
          margin-top: 4px;
          font-size: 12px;
          color: rgba(255,255,255,0.56);
        }

        .empty-state {
          min-height: 220px;
          display: grid;
          place-items: center;
          color: rgba(255,255,255,0.56);
          text-align: center;
        }

        @media (min-width: 900px) {
          .peeklist-hero {
            grid-template-columns: 460px 1fr;
            gap: 30px;
          }

          .titles-grid {
            grid-template-columns: repeat(5, minmax(0, 1fr));
            gap: 18px;
          }
        }
      `}</style>

      <div className="peeklist-page">
        <Link href="/lists" className="peeklist-back">
          ← {t.backToLists}
        </Link>

        <section className="peeklist-hero">
          <div className="peeklist-cover-wrap">
            {peeklist.cover_url ? (
              <img
                src={peeklist.cover_url}
                alt={peeklist.title || t.untitled}
                className="peeklist-cover"
              />
            ) : (
              <div className="peeklist-cover-fallback" />
            )}
          </div>

          <div className="peeklist-copy">
            <h1>{peeklist.title || t.untitled}</h1>

            <p>{peeklist.description || t.noDescription}</p>

            <div className="peeklist-meta">
              <div className="meta-pill">
                {items.length} {t.items}
              </div>
              <div className="meta-pill">
                {peeklist.visibility === "private" ? t.private : t.public}
              </div>
            </div>

            {creator?.username ? (
              <div className="creator-row">
                {creator.avatar_url ? (
                  <img
                    src={creator.avatar_url}
                    alt={creator.username}
                    className="creator-avatar"
                  />
                ) : (
                  <div className="creator-avatar-fallback" />
                )}

                <div className="creator-text">
                  {t.creator}:{" "}
                  <Link href={`/u/${creator.username}`}>
                    {creator.display_name || `@${creator.username}`}
                  </Link>
                </div>
              </div>
            ) : null}

            <div className="hero-actions">
              <Link href="/download-app" className="btn-primary">
                {t.openInApp}
              </Link>
            </div>
          </div>
        </section>

        <section className="section">
          <h2>{t.items}</h2>

          {items.length === 0 ? (
            <div className="empty-state">{t.empty}</div>
          ) : (
            <div className="titles-grid">
              {items.map((item, index) => (
                <Link
                  key={`${item.tmdb_id}-${index}`}
                  href={titleHref(item)}
                  className="title-card"
                >
                  {item.poster_path ? (
                    <img
                      src={`${POSTER}${item.poster_path}`}
                      alt={item.title || "title"}
                      className="title-poster"
                    />
                  ) : (
                    <div className="title-poster-fallback" />
                  )}

                  <div className="title-meta">
                    <div className="title-name">{item.title || "Untitled"}</div>
                    <div className="title-sub">
                      {item.media_type === "tv" ? "TV" : "Movie"}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
