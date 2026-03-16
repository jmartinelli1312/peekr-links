export const dynamic = "force-dynamic";

import Link from "next/link";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";

const BRAND = "#FA0082";

type Lang = "en" | "es" | "pt";

type PeeklistItem = {
  id: string | number;
  title?: string | null;
  cover_url?: string | null;
  visibility?: string | null;
  created_by?: string | null;
};

function normalizeLang(value?: string | null): Lang {
  const raw = (value || "en").toLowerCase();
  if (raw.startsWith("es")) return "es";
  if (raw.startsWith("pt")) return "pt";
  return "en";
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

async function getUserCreatedPeeklists() {
  const { data } = await supabase
    .from("peeklists")
    .select("id,title,cover_url,visibility,created_by")
    .order("id", { ascending: false })
    .limit(20);

  return dedupePeeklists((data as PeeklistItem[] | null) ?? []);
}

async function getSeoPeeklists() {
  return [
    {
      id: "seo-1",
      title: "Best Psychological Thrillers",
      cover_url: null,
    },
    {
      id: "seo-2",
      title: "Top Sci-Fi Movies of All Time",
      cover_url: null,
    },
    {
      id: "seo-3",
      title: "Best TV Shows to Binge",
      cover_url: null,
    },
    {
      id: "seo-4",
      title: "Best Heist Movies",
      cover_url: null,
    },
    {
      id: "seo-5",
      title: "Best Mind-Bending Endings",
      cover_url: null,
    },
    {
      id: "seo-6",
      title: "Best Horror Movies for Beginners",
      cover_url: null,
    },
  ] as PeeklistItem[];
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
        "Discover curated collections created by the community and future editorial lists built for discovery and SEO.",
      usersTitle: "Created by users",
      usersText:
        "Public Peeklists created by the Peekr community.",
      editorialTitle: "Editorial & SEO collections",
      editorialText:
        "Curated categories and search-friendly collections to power discovery across the web.",
    },
    es: {
      title: "Peeklists",
      subtitle:
        "Descubre colecciones curadas creadas por la comunidad y futuras listas editoriales pensadas para discovery y SEO.",
      usersTitle: "Creadas por usuarios",
      usersText:
        "Peeklists públicas creadas por la comunidad de Peekr.",
      editorialTitle: "Colecciones editoriales y SEO",
      editorialText:
        "Categorías curadas y colecciones pensadas para potenciar discovery en la web.",
    },
    pt: {
      title: "Peeklists",
      subtitle:
        "Descubra coleções curadas criadas pela comunidade e futuras listas editoriais pensadas para discovery e SEO.",
      usersTitle: "Criadas por usuários",
      usersText:
        "Peeklists públicas criadas pela comunidade do Peekr.",
      editorialTitle: "Coleções editoriais e SEO",
      editorialText:
        "Categorias curadas e coleções pensadas para impulsionar discovery na web.",
    },
  }[lang];

  const [userPeeklists, seoPeeklists] = await Promise.all([
    getUserCreatedPeeklists(),
    getSeoPeeklists(),
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

        <section>
          <SectionHeader title={t.editorialTitle} text={t.editorialText} />
          <PeeklistsRow items={seoPeeklists} hrefPrefix="/lists" />
        </section>
      </div>
    </>
  );
}
