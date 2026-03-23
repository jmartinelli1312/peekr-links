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
        allow: [
          "/",
          "/title/",
          "/actor/",
          "/lists/",
          "/buzz/",
        ],
        disallow: [
          "/api/",
          "/_next/",
          "/login",
          "/signup",
          "/forgot-password",
          "/reset-password",
          "/settings",
          "/notifications",
          "/messages",
          "/activity",
          "/search",
        ],
      },
    ],
    sitemap: "https://www.peekr.app/sitemap.xml",
  };
}
