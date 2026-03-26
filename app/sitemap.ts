import type { MetadataRoute } from "next";
import { supabase } from "@/lib/supabase";

const SITE = "https://www.peekr.app";
const LANGS = ["es", "en", "pt"] as const;

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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

 const staticUrls: MetadataRoute.Sitemap = [
  ...LANGS.flatMap((lang) => [
    {
      url: `${SITE}/${lang}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.95,
    },
    {
      url: `${SITE}/${lang}/lists`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.9,
    },
    {
      url: `${SITE}/${lang}/buzz`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.85,
    },
  ]),
];

  const [
    editorialCollectionsRes,
    buzzArticlesRes,
    titlesRes,
    actorsRes,
  ] = await Promise.all([
    supabase
      .from("editorial_collections")
      .select("slug,updated_at,is_published,item_count")
      .eq("is_published", true)
      .gt("item_count", 0)
      .limit(5000),

    supabase
      .from("peekrbuzz_articles")
      .select("slug,published_at,updated_at,is_published")
      .eq("is_published", true)
      .limit(5000),

    supabase
      .from("titles_cache")
      .select("tmdb_id,media_type,title,updated_at")
      .not("tmdb_id", "is", null)
      .limit(5000),

    supabase
      .from("people_cache")
      .select("person_id,name,updated_at")
      .not("person_id", "is", null)
      .limit(5000),
  ]);

  const editorialCollections =
    (editorialCollectionsRes.data as EditorialCollectionRow[] | null) ?? [];
  const buzzArticles =
    (buzzArticlesRes.data as BuzzArticleRow[] | null) ?? [];
  const titles =
    (titlesRes.data as TitleRow[] | null) ?? [];
  const actors =
    (actorsRes.data as ActorRow[] | null) ?? [];

  const listUrls: MetadataRoute.Sitemap = editorialCollections.flatMap((item) =>
    LANGS.map((lang) => ({
      url: `${SITE}/${lang}/lists/${item.slug}`,
      lastModified: safeDate(item.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }))
  );

  const buzzUrls: MetadataRoute.Sitemap = buzzArticles.flatMap((item) =>
    LANGS.map((lang) => ({
      url: `${SITE}/${lang}/buzz/${item.slug}`,
      lastModified: safeDate(item.updated_at || item.published_at),
      changeFrequency: "weekly" as const,
      priority: 0.75,
    }))
  );

  const titleUrls: MetadataRoute.Sitemap = titles
    .filter((item) => item.tmdb_id && item.title)
    .flatMap((item) => {
      const type = item.media_type === "tv" ? "tv" : "movie";
      const slug = slugify(item.title || "title");

      return LANGS.map((lang) => ({
        url: `${SITE}/${lang}/title/${type}/${item.tmdb_id}-${slug}`,
        lastModified: safeDate(item.updated_at),
        changeFrequency: "weekly" as const,
        priority: 0.8,
      }));
    });

  const actorUrls: MetadataRoute.Sitemap = actors
    .filter((item) => item.person_id && item.name)
    .flatMap((item) => {
      const slug = slugify(item.name || "person");

      return LANGS.map((lang) => ({
        url: `${SITE}/${lang}/actor/${item.person_id}-${slug}`,
        lastModified: safeDate(item.updated_at),
        changeFrequency: "weekly" as const,
        priority: 0.75,
      }));
    });

  return [
    ...staticUrls,
    ...listUrls,
    ...buzzUrls,
    ...titleUrls,
    ...actorUrls,
  ];
}
