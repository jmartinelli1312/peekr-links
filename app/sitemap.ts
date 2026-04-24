export const revalidate = 3600;

import type { MetadataRoute } from "next";
import { supabase } from "@/lib/supabase";

const SITE = "https://www.peekr.app";
const LANGS = ["es", "en", "pt"] as const;
type Lang = (typeof LANGS)[number];

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
  topic_key?: string | null;
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

// Helper: construye el objeto de alternates por idioma cuando el slug es
// idéntico en las 3 variantes (caso típico: páginas de título, actor,
// homes, editorial collections). Genera `<xhtml:link rel="alternate">` en
// el sitemap que Google usa para matchear traducciones.
function sameSlugAlternates(pathBuilder: (lang: Lang) => string) {
  const languages: Record<string, string> = {};
  for (const lang of LANGS) {
    languages[lang] = `${SITE}${pathBuilder(lang)}`;
  }
  languages["x-default"] = `${SITE}${pathBuilder("es")}`;
  return { languages };
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
  // Home + secciones principales por idioma. Cada URL declara sus
  // hermanas en los otros idiomas como hreflang alternates.
  const staticPaths: Array<{ path: (lang: Lang) => string; priority: number }> = [
    { path: (l) => `/${l}`, priority: 0.95 },
    { path: (l) => `/${l}/lists`, priority: 0.9 },
    { path: (l) => `/${l}/buzz`, priority: 0.85 },
    { path: (l) => `/${l}/explore`, priority: 0.8 },
  ];
  for (const lang of LANGS) {
    for (const entry of staticPaths) {
      staticUrls.push({
        url: `${SITE}${entry.path(lang)}`,
        lastModified: now,
        changeFrequency: "daily",
        priority: entry.priority,
        alternates: sameSlugAlternates(entry.path),
      });
    }
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
      .select("slug,published_at,updated_at,is_published,language,topic_key")
      .eq("is_published", true)
      .order("published_at", { ascending: false })
      .limit(MAX_BUZZ_ARTICLES),
  ]);

  const editorialCollections =
    (editorialRes.data as EditorialCollectionRow[] | null) ?? [];
  const buzzArticles = (buzzRes.data as BuzzArticleRow[] | null) ?? [];

  // Editorial collections: slug idéntico en los 3 idiomas.
  const listUrls: MetadataRoute.Sitemap = editorialCollections
    .filter((item) => item.slug && item.slug.trim().length > 0)
    .flatMap((item) =>
      LANGS.map((lang) => ({
        url: `${SITE}/${lang}/lists/${item.slug}`,
        lastModified: safeDate(item.updated_at),
        changeFrequency: "weekly" as const,
        priority: 0.8,
        alternates: sameSlugAlternates(
          (l) => `/${l}/lists/${item.slug}`,
        ),
      })),
    );

  // Buzz articles: slug distinto por idioma (ej. "que-ver-despues-de-X"
  // vs "what-to-watch-after-X"). Agrupamos por topic_key para emitir
  // hreflang cruzado apuntando al slug correcto de cada idioma.
  const buzzUrls: MetadataRoute.Sitemap = buildBuzzSitemapEntries(buzzArticles);

  return [...staticUrls, ...listUrls, ...buzzUrls];
}

function buildBuzzSitemapEntries(articles: BuzzArticleRow[]): MetadataRoute.Sitemap {
  const grouped = new Map<string, BuzzArticleRow[]>();
  const noTopic: BuzzArticleRow[] = [];

  for (const article of articles) {
    if (!article.slug || article.slug.trim().length === 0) continue;
    if (article.topic_key) {
      const existing = grouped.get(article.topic_key);
      if (existing) existing.push(article);
      else grouped.set(article.topic_key, [article]);
    } else {
      noTopic.push(article);
    }
  }

  const out: MetadataRoute.Sitemap = [];

  for (const group of grouped.values()) {
    // Resolver el slug canónico por idioma (con fallback al primer hermano si
    // todavía no existe la variante de ese idioma).
    const slugByLang = new Map<Lang, string>();
    for (const article of group) {
      const lang = (article.language || "").toLowerCase();
      if ((LANGS as readonly string[]).includes(lang)) {
        slugByLang.set(lang as Lang, article.slug);
      }
    }
    const fallbackSlug = group[0].slug;

    const languages: Record<string, string> = {};
    for (const lang of LANGS) {
      const slug = slugByLang.get(lang) ?? fallbackSlug;
      languages[lang] = `${SITE}/${lang}/buzz/${slug}`;
    }
    languages["x-default"] = `${SITE}/es/buzz/${slugByLang.get("es") ?? fallbackSlug}`;

    // Emitimos una URL por artículo realmente publicado (sin duplicar idiomas
    // que aún no existen). Todos comparten el mismo bloque de alternates.
    for (const article of group) {
      const lang = (article.language || "").toLowerCase();
      if (!(LANGS as readonly string[]).includes(lang)) continue;
      out.push({
        url: `${SITE}/${lang}/buzz/${article.slug}`,
        lastModified: safeDate(article.updated_at || article.published_at),
        changeFrequency: "weekly",
        priority: 0.75,
        alternates: { languages },
      });
    }
  }

  // Artículos legacy sin topic_key: asumimos que el mismo slug sirve en los
  // 3 idiomas (es el comportamiento previo de este código).
  for (const article of noTopic) {
    for (const lang of LANGS) {
      out.push({
        url: `${SITE}/${lang}/buzz/${article.slug}`,
        lastModified: safeDate(article.updated_at || article.published_at),
        changeFrequency: "weekly",
        priority: 0.75,
        alternates: sameSlugAlternates((l) => `/${l}/buzz/${article.slug}`),
      });
    }
  }

  return out;
}

async function buildTitlesSitemap(): Promise<MetadataRoute.Sitemap> {
  // Política de indexación: el sitemap solo incluye títulos con al menos
  // 1 rating real de Peekr. Los que tienen 0 ratings emiten `noindex`
  // en su metadata (ver app/[lang]/title/[type]/[id]/page.tsx). Esto
  // evita que Google clasifique el sitio como "thin content" al ver
  // miles de páginas con datos copiados de TMDB sin engagement propio.
  // A medida que la comunidad crece, más títulos pasan a ser indexables.
  const [titlesRes, ratingsRes] = await Promise.all([
    supabase
      .from("titles_cache")
      .select("tmdb_id,media_type,title,updated_at")
      .not("tmdb_id", "is", null)
      .not("title", "is", null)
      .order("updated_at", { ascending: false })
      .limit(MAX_TITLE_URLS),

    // Set de tmdb_ids con ratings reales. La tabla `ratings` no distingue
    // media_type (solo guarda tmdb_id); en la práctica los IDs no colisionan
    // entre movies y tv series, así que filtrar solo por tmdb_id es seguro.
    supabase
      .from("ratings")
      .select("tmdb_id")
      .not("tmdb_id", "is", null),
  ]);

  const titles = (titlesRes.data as TitleRow[] | null) ?? [];
  const ratedIds =
    (ratingsRes.data as { tmdb_id: number }[] | null) ?? [];

  const eligibleIds = new Set<number>();
  for (const r of ratedIds) {
    eligibleIds.add(r.tmdb_id);
  }

  return titles
    .filter((item) => {
      if (!item.tmdb_id || !isUsefulSlug(item.title)) return false;
      return eligibleIds.has(item.tmdb_id);
    })
    .flatMap((item) => {
      const type = item.media_type === "tv" ? "tv" : "movie";
      const slug = slugify(item.title || "title");
      const buildPath = (l: Lang) =>
        `/${l}/title/${type}/${item.tmdb_id}-${slug}`;

      return LANGS.map((lang) => ({
        url: `${SITE}${buildPath(lang)}`,
        lastModified: safeDate(item.updated_at),
        changeFrequency: "weekly" as const,
        priority: 0.7,
        alternates: sameSlugAlternates(buildPath),
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
      const buildPath = (l: Lang) => `/${l}/actor/${item.person_id}-${slug}`;

      return LANGS.map((lang) => ({
        url: `${SITE}${buildPath(lang)}`,
        lastModified: safeDate(item.updated_at),
        changeFrequency: "monthly" as const,
        priority: 0.6,
        alternates: sameSlugAlternates(buildPath),
      }));
    });
}
