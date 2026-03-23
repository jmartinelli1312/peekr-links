import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "GPTBot",
        disallow: ["/"],
      },
      {
        userAgent: "CCBot",
        disallow: ["/"],
      },
      {
        userAgent: "anthropic-ai",
        disallow: ["/"],
      },
      {
        userAgent: "ClaudeBot",
        disallow: ["/"],
      },
      {
        userAgent: "Google-Extended",
        disallow: ["/"],
      },
      {
        userAgent: "meta-externalagent",
        disallow: ["/"],
      },
      {
        userAgent: "*",
        allow: ["/"],
        disallow: [
          "/api/",
          "/admin",
          "/activity",
          "/login",
          "/signup",
          "/forgot-password",
          "/reset-password",
          "/settings",
          "/notifications",
          "/messages",
        ],
      },
    ],
    sitemap: `${process.env.NEXT_PUBLIC_SITE_URL || "https://www.peekr.app"}/sitemap.xml`,
  };
}
