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

// AI bots split into two tiers based on COST vs VALUE (ver análisis de costos
// de Vercel, jun 2026). Permitir TODOS los bots de IA los dejó crawlear el
// sitemap completo (~4.5k URLs) en loop y ~3x'eó el costo de Vercel sin upside
// de adquisición, porque el grueso de ese tráfico eran crawlers de training.
//
// TIER 1 — TRAINING crawlers (BLOQUEADOS): recorren TODO el sitemap repetido
// para entrenar modelos base. El beneficio (que el modelo "sepa" de Peekr) es
// indirecto y llega meses después en el próximo training. Costo alto y
// constante hoy; no traen usuarios. → disallow total.
const AI_TRAINING_BOTS = [
  "GPTBot",             // OpenAI training
  "ClaudeBot",          // Anthropic training
  "anthropic-ai",       // Anthropic (UA de training legacy)
  "CCBot",              // Common Crawl (alimenta muchos modelos)
  "Google-Extended",    // Gemini / Vertex grounding (training)
  "meta-externalagent", // Meta AI training
  "Applebot-Extended",  // Apple Intelligence training
];

// TIER 2 — CITATION / on-demand fetch (PERMITIDOS): traen una URL puntual
// cuando un usuario real te está por citar AHORA, o construyen el índice de
// búsqueda que produce esas citas. Esto SÍ trae tráfico de alta intención y
// cuesta poco (solo páginas relevantes). Throttled con crawlDelay y limitados
// a contenido de alto valor (sin /u/ — los perfiles no aportan a citas).
const AI_CITATION_BOTS = [
  "OAI-SearchBot",   // índice de búsqueda de ChatGPT (citas)
  "ChatGPT-User",    // fetch on-demand de ChatGPT (el usuario pidió leer la URL)
  "Claude-Web",      // fetch on-demand de Claude
  "PerplexityBot",   // índice de búsqueda de Perplexity (citas)
  "Perplexity-User", // fetch on-demand de Perplexity
];

// Contenido de alto valor para citas (sin /*/u/ ni /api/og).
const AI_CITATION_ALLOW = [
  "/",
  "/*/title/",
  "/*/actor/",
  "/*/lists/",
  "/*/buzz/",
  "/*/peeklist/",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // ── AI TRAINING crawlers — blocked (puro costo, sin tráfico) ──────────
      {
        userAgent: AI_TRAINING_BOTS,
        disallow: ["/"],
      },
      // ── AI CITATION / on-demand bots — allowed, throttled, alto valor ─────
      {
        userAgent: AI_CITATION_BOTS,
        allow: AI_CITATION_ALLOW,
        disallow: DISALLOW,
        crawlDelay: 10,
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
