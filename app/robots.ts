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
        userAgent: "meta-externalagent",
        disallow: ["/"],
      },
      {
        userAgent: "*",
        allow: [
          "/",
          "/*/title/",
          "/*/actor/",
          "/*/lists/",
          "/*/buzz/",
          "/*/peeklist/",
          "/*/u/",
        ],
        disallow: [
          "/api/",
          "/admin",
          "/admin/",
          "/login",
          "/signup",
          "/forgot-password",
          "/reset-password",
          "/settings",
          "/notifications",
          "/messages",
          "/activity",
          "/activity/",
          "/*/explore?*",
          "/*?tab=*",
        ],
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
  };
}
