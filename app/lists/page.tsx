export const dynamic = "force-dynamic";

import Link from "next/link";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";

const TMDB_KEY = process.env.TMDB_API_KEY!;
const TMDB_BASE = "https://api.themoviedb.org/3";
const BACKDROP = "https://image.tmdb.org/t/p/w780";
const BRAND = "#FA0082";

type Lang = "en" | "es" | "pt";

type PeeklistItem = {
  id: string | number;
  title?: string | null;
  cover_url?: string | null;
  visibility?: string | null;
  created_by?: string | null;
};

type EditorialCollection = {
  slug: string;
  title_en: string;
  title_es: string;
  title_pt: string;
  description_en?: string | null;
  description_es?: string | null;
  description_pt?: string | null;
  cover_url?: string | null;
  category?: string | null;
  is_published: boolean;
  sort_order: number;
};

type EditorialCollectionItem = {
  tmdb_id: number;
  media_type: string;
  position: number;
};

function normalizeLang(value?: string | null): Lang {
  const raw = (value || "en").toLowerCase();
  if (raw.startsWith("es")) return "es";
  if (raw.startsWith("pt")) return "pt";
  return "en";
}

function tmdbLanguage(lang: Lang) {
  if (lang === "es") return "es-ES";
  if (lang === "pt") return "pt-BR";
  return "en-US";
}

function dedupePeeklists(items: PeeklistItem[]) {
  const seen = new Set<string>();
  const out: PeeklistItem[] = [];

  for (const item of items) {
    const key = String(item.id);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out;
}

function localizedCollectionTitle(item: EditorialCollection, lang: Lang) {
  if (lang === "es") return item.title_es || item.title_en || item.title_pt;
  if (lang === "pt") return item.title_pt || item.title_en || item.title_es;
  return item.title_en || item.title_es || item.title_pt;
}

async function fetchBackdropForCollection(
  slug: string,
  lang: Lang
): Promise<string | null> {
  const { data: firstItem } = await supabase
    .from("editorial_collection_items")
    .select("tmdb_id,media_type,position")
    .eq("collection_slug", slug)
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!firstItem?.tmdb_id) return null;

  try {
    const type = firstItem.media_type === "tv" ? "tv" : "movie";
    const apiLang = tmdbLanguage(lang);

    const res = await fetch(
      `${TMDB_BASE}/${type}/${firstItem.tmdb_id}?api_key=${TMDB_KEY}&language=${apiLang}`,
      { next: { revalidate: 3600 } }
    );

    if (!res.ok) return null;

    const json = await res.json();
    return json.backdrop_path ? `${BACKDROP}${json.backdrop_path}` : null;
  } catch {
    return null;
  }
}

async function collectionToPeeklistItem(
  item: EditorialCollection,
  lang: Lang
): Promise<PeeklistItem> {
  const fallbackCover = item.cover_url
    ? item.cover_url
    : await fetchBackdropForCollection(item.slug, lang);

  return {
    id: item.slug,
    title: localizedCollectionTitle(item, lang),
    cover_url: fallbackCover ?? null,
  };
}

async function getUserCreatedPeeklists() {
  const { data } = await supabase
    .from("peeklists")
    .select("id,title,cover_url,visibility,created_by")
    .eq("visibility", "public")
    .order("id", { ascending: false })
    .limit(20);

  return dedupePeeklists((data as PeeklistItem[] | null) ?? []);
}

async function getEditorialCollectionsByCategory(
  category: string,
  lang: Lang,
  limit = 12
) {
  const { data } = await supabase
    .from("editorial_collections")
    .select(
      "slug,title_en,title_es,title_pt,description_en,description_es,description_pt,cover_url,category,is_published,sort_order"
    )
    .eq("is_published", true)
    .eq("category", category)
    .order("sort_order", { ascending: true })
    .limit(limit);

  const rows = (data as EditorialCollection[] | null) ?? [];
  return await Promise.all(rows.map((item) => collectionToPeeklistItem(item, lang)));
}

function SectionHeader({
  title,
  text,
}: {
  title: string;
  text?: string;
}) {
  return (
    <div className="section-header">
      <h2>{title}</h2>
      {text ? <p>{text}</p> : null}
    </div>
  );
}

function PeeklistsRow({
  items,
  hrefPrefix = "/peeklist",
}: {
  items: PeeklistItem[];
  hrefPrefix?: string;
}) {
  return (
    <div className="peeklists-row">
      {items.map((pl) => (
        <Link
          key={String(pl.id)}
          href={`${hrefPrefix}/${pl.id}`}
          className="peeklist-card"
        >
          {pl.cover_url ? (
            <img
              src={pl.cover_url}
              alt={pl.title || "Peeklist"}
              className="peeklist-cover"
            />
          ) : (
            <div className="peeklist-fallback" />
          )}

          <div className="peeklist-meta">
            <div className="peeklist-title">{pl.title || "Peeklist"}</div>
          </div>
        </Link>
      ))}
    </div>
  );
}

export async function generateMetadata() {
  return {
    title: "Peeklists | Peekr",
    description:
      "Discover Peeklists created by users and editorial collections across movies and series on Peekr.",
    alternates: {
      canonical: "https://www.peekr.app/lists",
    },
    openGraph: {
      title: "Peeklists | Peekr",
      description:
        "Discover Peeklists created by users and editorial collections across movies and series on Peekr.",
      url: "https://www.peekr.app/lists",
      siteName: "Peekr",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Peeklists | Peekr",
      description:
        "Discover Peeklists created by users and editorial collections across movies and series on Peekr.",
    },
  };
}

export default async function ListsPage() {
  const cookieStore = await cookies();
  const lang = normalizeLang(cookieStore.get("lang")?.value);

  const t = {
    en: {
      title: "Peeklists",
      subtitle:
        "Discover curated collections created by the community and editorial collections built for discovery.",
      usersTitle: "Created by users",
      usersText: "Public Peeklists created by the Peekr community.",
      awardsTitle: "Award winners",
      awardsText:
        "Collections built around Oscar winners and other award-season discoveries.",
      editorialTitle: "Editorial collections",
      editorialText:
        "Curated categories and search-friendly collections to power discovery across the web.",
      regionalTitle: "Regional picks",
      regionalText:
        "Collections tailored to local taste and regional discovery.",
    },
    es: {
      title: "Peeklists",
      subtitle:
        "Descubre colecciones curadas creadas por la comunidad y colecciones editoriales pensadas para discovery.",
      usersTitle: "Creadas por usuarios",
      usersText: "Peeklists públicas creadas por la comunidad de Peekr.",
      awardsTitle: "Ganadores de premios",
      awardsText:
        "Colecciones armadas alrededor de los ganadores del Oscar y otros premios.",
      editorialTitle: "Colecciones editoriales",
      editorialText:
        "Categorías curadas y colecciones pensadas para potenciar discovery en la web.",
      regionalTitle: "Selecciones regionales",
      regionalText:
        "Colecciones adaptadas al gusto local y al discovery regional.",
    },
    pt: {
      title: "Peeklists",
      subtitle:
        "Descubra coleções curadas criadas pela comunidade e coleções editoriais pensadas para discovery.",
      usersTitle: "Criadas por usuários",
      usersText: "Peeklists públicas criadas pela comunidade do Peekr.",
      awardsTitle: "Vencedores de prêmios",
      awardsText:
        "Coleções construídas em torno dos vencedores do Oscar e de outras premiações.",
      editorialTitle: "Coleções editoriais",
      editorialText:
        "Categorias curadas e coleções pensadas para impulsionar discovery na web.",
      regionalTitle: "Seleções regionais",
      regionalText:
        "Coleções adaptadas ao gosto local e à descoberta regional.",
    },
  }[lang];

  const [userPeeklists, awardCollections, editorialCollections, regionalCollections] =
    await Promise.all([
      getUserCreatedPeeklists(),
      getEditorialCollectionsByCategory("awards", lang, 12),
      getEditorialCollectionsByCategory("genre", lang, 12),
      getEditorialCollectionsByCategory("regional", lang, 12),
    ]);

  return (
    <>
      <style>{`
        .lists-page {
          display: flex;
          flex-direction: column;
          gap: 56px;
        }

        .hero h1 {
          margin: 0;
          font-size: clamp(44px, 10vw, 72px);
          line-height: 0.98;
          letter-spacing: -0.05em;
          font-weight: 900;
          color: white;
        }

        .hero p {
          margin: 18px 0 0 0;
          max-width: 820px;
          color: rgba(255,255,255,0.74);
          font-size: 17px;
          line-height: 1.75;
        }

        .section-header {
          margin-bottom: 18px;
        }

        .section-header h2 {
          margin: 0;
          font-size: clamp(30px, 7vw, 38px);
          line-height: 1.02;
          color: white;
          font-weight: 900;
          letter-spacing: -0.03em;
        }

        .section-header p {
          margin: 10px 0 0 0;
          color: rgba(255,255,255,0.70);
          font-size: 15px;
          line-height: 1.7;
          max-width: 840px;
        }

        .peeklists-row {
          display: flex;
          gap: 14px;
          overflow-x: auto;
          padding-bottom: 8px;
          -webkit-overflow-scrolling: touch;
          scroll-snap-type: x proximity;
        }

        .peeklist-card {
          width: 260px;
          min-width: 260px;
          text-decoration: none;
          color: white;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 18px;
          overflow: hidden;
          scroll-snap-align: start;
        }

        .peeklist-cover,
        .peeklist-fallback {
          width: 100%;
          height: 150px;
          object-fit: cover;
          display: block;
          background: linear-gradient(135deg, ${BRAND}, rgba(255,255,255,0.08));
        }

        .peeklist-meta {
          padding: 14px;
        }

        .peeklist-title {
          font-size: 14px;
          font-weight: 700;
          line-height: 1.45;
          color: rgba(255,255,255,0.96);
        }

        @media (min-width: 900px) {
          .lists-page {
            gap: 72px;
          }

          .peeklist-card {
            width: 300px;
            min-width: 300px;
          }

          .peeklist-cover,
          .peeklist-fallback {
            height: 170px;
          }
        }
      `}</style>

      <div className="lists-page">
        <section className="hero">
          <h1>{t.title}</h1>
          <p>{t.subtitle}</p>
        </section>

        <section>
          <SectionHeader title={t.usersTitle} text={t.usersText} />
          <PeeklistsRow items={userPeeklists} />
        </section>

        {awardCollections.length > 0 ? (
          <section>
            <SectionHeader title={t.awardsTitle} text={t.awardsText} />
            <PeeklistsRow items={awardCollections} hrefPrefix="/lists" />
          </section>
        ) : null}

        {editorialCollections.length > 0 ? (
          <section>
            <SectionHeader title={t.editorialTitle} text={t.editorialText} />
            <PeeklistsRow items={editorialCollections} hrefPrefix="/lists" />
          </section>
        ) : null}

        {regionalCollections.length > 0 ? (
          <section>
            <SectionHeader title={t.regionalTitle} text={t.regionalText} />
            <PeeklistsRow items={regionalCollections} hrefPrefix="/lists" />
          </section>
        ) : null}
      </div>
    </>
  );
}
