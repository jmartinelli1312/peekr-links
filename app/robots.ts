import type { MetadataRoute } from "next";

const SITE = "https://www.peekr.app";

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
          "/es",
          "/en",
          "/pt",
          "/es/title/",
          "/en/title/",
          "/pt/title/",
          "/es/actor/",
          "/en/actor/",
          "/pt/actor/",
          "/es/lists",
          "/en/lists",
          "/pt/lists",
          "/es/lists/",
          "/en/lists/",
          "/pt/lists/",
          "/es/buzz",
          "/en/buzz",
          "/pt/buzz",
          "/es/buzz/",
          "/en/buzz/",
          "/pt/buzz/",
        ],
        disallow: [
          "/admin",
          "/admin/",
          "/activity",
          "/activity/",
          "/api/",
          "/login",
          "/signup",
          "/forgot-password",
          "/reset-password",
          "/settings",
          "/notifications",
          "/messages",
          "/download-app",
          "/user/",
          "/peeklist/",
        ],
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
  };
}
