import type { MetadataRoute } from "next";

const SITE = "https://www.peekr.app";

// Public, crawl-worthy content (titles, actors, lists, buzz, profiles).
const ALLOW = [
  "/",
  "/api/og",
  "/*/title/",
  "/*/actor/",
  "/*/lists/",
  "/*/buzz/",
  "/*/peeklist/",
  "/*/u/",
];

// Private / auth / heavy paths — never crawl.
const DISALLOW = [
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
];

// AI assistants: allow them to read PUBLIC content so Peekr can be learned as
// an entity and cited as a source (ChatGPT, Claude, Gemini, Perplexity, Meta).
// Includes both training crawlers and on-demand user-fetch agents.
const AI_BOTS = [
  "GPTBot",            // OpenAI training
  "OAI-SearchBot",     // ChatGPT search/citations
  "ChatGPT-User",      // ChatGPT on-demand fetch (user asked to read a URL)
  "ClaudeBot",         // Anthropic training
  "anthropic-ai",      // Anthropic
  "Claude-Web",        // Claude on-demand fetch
  "CCBot",             // Common Crawl (feeds many models)
  "Google-Extended",   // Gemini / Vertex grounding
  "PerplexityBot",     // Perplexity index
  "Perplexity-User",   // Perplexity on-demand fetch
  "meta-externalagent",// Meta AI
  "Applebot-Extended", // Apple Intelligence
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // ── AI assistants — allow public content (was: blocked) ──────────────
      {
        userAgent: AI_BOTS,
        allow: ALLOW,
        disallow: DISALLOW,
      },
      // ── Aggressive SEO scrapers / bad bots — block to reduce DB load ──────
      { userAgent: "AhrefsBot", disallow: ["/"] },
      { userAgent: "SemrushBot", disallow: ["/"] },
      { userAgent: "DotBot", disallow: ["/"] },
      { userAgent: "MJ12bot", disallow: ["/"] },
      { userAgent: "PetalBot", disallow: ["/"] },
      { userAgent: "Bytespider", disallow: ["/"] },
      // ── Search engines — throttle on heavy paths ─────────────────────────
      { userAgent: "Googlebot", allow: ["/"], crawlDelay: 2 },
      { userAgent: "bingbot", allow: ["/"], crawlDelay: 2 },
      // ── Everyone else ────────────────────────────────────────────────────
      {
        userAgent: "*",
        allow: ALLOW,
        disallow: DISALLOW,
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
  };
}
