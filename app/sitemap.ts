import type { MetadataRoute } from "next";

const SITE = "https://www.peekr.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    {
      url: `${SITE}/`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },

    {
      url: `${SITE}/es`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.95,
    },
    {
      url: `${SITE}/en`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.95,
    },
    {
      url: `${SITE}/pt`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.95,
    },

    {
      url: `${SITE}/es/buzz`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.85,
    },
    {
      url: `${SITE}/en/buzz`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.85,
    },
    {
      url: `${SITE}/pt/buzz`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.85,
    },

    {
      url: `${SITE}/es/lists`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE}/en/lists`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE}/pt/lists`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
  ];
}
