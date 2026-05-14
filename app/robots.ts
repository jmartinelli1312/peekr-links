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
      // Aggressive crawlers — block to reduce DB load
      {
        userAgent: "AhrefsBot",
        disallow: ["/"],
      },
      {
        userAgent: "SemrushBot",
        disallow: ["/"],
      },
      {
        userAgent: "DotBot",
        disallow: ["/"],
      },
      {
        userAgent: "MJ12bot",
        disallow: ["/"],
      },
      {
        userAgent: "PetalBot",
        disallow: ["/"],
      },
      {
        userAgent: "Bytespider",
        disallow: ["/"],
      },
      // Throttle Google/Bing on heavy paths via crawl-delay
      {
        userAgent: "Googlebot",
        allow: ["/"],
        crawlDelay: 2,
      },
      {
        userAgent: "bingbot",
        allow: ["/"],
        crawlDelay: 2,
      },
      {
        userAgent: "*",
        allow: [
          "/",
          "/api/og",
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
