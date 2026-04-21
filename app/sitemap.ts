export const revalidate = 3600;

import type { MetadataRoute } from "next";
import { supabase } from "@/lib/supabase";

const SITE = "https://www.peekr.app";
const LANGS = ["es", "en", "pt"] as const;

const MAX_EDITORIAL_COLLECTIONS = 500;
const MAX_BUZZ_ARTICLES = 500;
const MAX_TITLE_URLS = 2000;
const MAX_ACTOR_URLS = 1000;

type EditorialCollectionRow = {
  slug: string;
  updated_at?: string | null;
  is_published?: boolean | null;
  item_count?: number | null;
};

type BuzzArticleRow = {
  slug: string;
  published_at?: string | null;
  updated_at?: string | null;
  is_published?: boolean | null;
  language?: string | null;
};

type TitleRow = {
  tmdb_id: number;
  media_type?: string | null;
  title?: string | null;
  updated_at?: string | null;
};

type ActorRow = {
  person_id: number;
  name?: string | null;
  updated_at?: string | null;
};

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function safeDate(value?: string | null) {
  return value ? new Date(value) : new Date();
}

function isUsefulSlug(value?: string | null) {
  const slug = slugify(value || "");
  return slug.length >= 2;
}

// Single sitemap at /sitemap.xml that contains ALL URLs. Next.js 15
// has trouble exposing both a root /sitemap.xml index AND children via
// generateSitemaps() in combination with our [lang] catch-all middleware.
// A single flat sitemap is under the 50k URL cap so this is safe.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [staticAndEditorial, titles, actors] = await Promise.all([
    buildStaticAndEditorialSitemap(),
    buildTitlesSitemap(),
    buildActorsSitemap(),
  ]);
  return [...staticAndEditorial, ...titles, ...actors];
}

async function buildStaticAndEditorialSitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticUrls: MetadataRoute.Sitemap = [];
  for (const lang of LANGS) {
    staticUrls.push(
      {
        url: `${SITE}/${lang}`,
        lastModified: now,
        changeFrequency: "daily",
        priority: 0.95,
      },
      {
        url: `${SITE}/${lang}/lists`,
        lastModified: now,
        changeFrequency: "daily",
        priority: 0.9,
      },
      {
        url: `${SITE}/${lang}/buzz`,
        lastModified: now,
        changeFrequency: "daily",
        priority: 0.85,
      },
      {
        url: `${SITE}/${lang}/explore`,
        lastModified: now,
        changeFrequency: "daily",
        priority: 0.8,
      }
    );
  }

  const [editorialRes, buzzRes] = await Promise.all([
    supabase
      .from("editorial_collections")
      .select("slug,updated_at,is_published,item_count")
      .eq("is_published", true)
      .gt("item_count", 0)
      .order("updated_at", { ascending: false })
      .limit(MAX_EDITORIAL_COLLECTIONS),

    supabase
      .from("peekrbuzz_articles")
      .select("slug,published_at,updated_at,is_published,language")
      .eq("is_published", true)
      .order("published_at", { ascending: false })
      .limit(MAX_BUZZ_ARTICLES),
  ]);

  const editorialCollections =
    (editorialRes.data as EditorialCollectionRow[] | null) ?? [];
  const buzzArticles = (buzzRes.data as BuzzArticleRow[] | null) ?? [];

  const listUrls: MetadataRoute.Sitemap = editorialCollections
    .filter((item) => item.slug && item.slug.trim().length > 0)
    .flatMap((item) =>
      LANGS.map((lang) => ({
        url: `${SITE}/${lang}/lists/${item.slug}`,
        lastModified: safeDate(item.updated_at),
        changeFrequency: "weekly" as const,
        priority: 0.8,
      }))
    );

  // Each buzz article is now language-scoped via the `language` column,
  // so we emit it at its own language URL only. Legacy articles without
  // a language default to every LANG (they render the same content at
  // /es/buzz, /en/buzz, /pt/buzz until migrated).
  const buzzUrls: MetadataRoute.Sitemap = buzzArticles
    .filter((item) => item.slug && item.slug.trim().length > 0)
    .flatMap((item) => {
      const langs: readonly string[] = item.language
        ? [item.language]
        : LANGS;
      return langs.map((lang) => ({
        url: `${SITE}/${lang}/buzz/${item.slug}`,
        lastModified: safeDate(item.updated_at || item.published_at),
        changeFrequency: "weekly" as const,
        priority: 0.75,
      }));
    });

  return [...staticUrls, ...listUrls, ...buzzUrls];
}

async function buildTitlesSitemap(): Promise<MetadataRoute.Sitemap> {
  const titlesRes = await supabase
    .from("titles_cache")
    .select("tmdb_id,media_type,title,updated_at")
    .not("tmdb_id", "is", null)
    .not("title", "is", null)
    .order("updated_at", { ascending: false })
    .limit(MAX_TITLE_URLS);

  const titles = (titlesRes.data as TitleRow[] | null) ?? [];

  return titles
    .filter((item) => item.tmdb_id && isUsefulSlug(item.title))
    .flatMap((item) => {
      const type = item.media_type === "tv" ? "tv" : "movie";
      const slug = slugify(item.title || "title");

      return LANGS.map((lang) => ({
        url: `${SITE}/${lang}/title/${type}/${item.tmdb_id}-${slug}`,
        lastModified: safeDate(item.updated_at),
        changeFrequency: "weekly" as const,
        priority: 0.7,
      }));
    });
}

async function buildActorsSitemap(): Promise<MetadataRoute.Sitemap> {
  const actorsRes = await supabase
    .from("people_cache")
    .select("person_id,name,updated_at")
    .not("person_id", "is", null)
    .not("name", "is", null)
    .order("updated_at", { ascending: false })
    .limit(MAX_ACTOR_URLS);

  const actors = (actorsRes.data as ActorRow[] | null) ?? [];

  return actors
    .filter((item) => item.person_id && isUsefulSlug(item.name))
    .flatMap((item) => {
      const slug = slugify(item.name || "person");

      return LANGS.map((lang) => ({
        url: `${SITE}/${lang}/actor/${item.person_id}-${slug}`,
        lastModified: safeDate(item.updated_at),
        changeFrequency: "monthly" as const,
        priority: 0.6,
      }));
    });
}

