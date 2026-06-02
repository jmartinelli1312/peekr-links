import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SUPPORTED_LANGS = new Set(["es", "en", "pt"]);
const DEFAULT_LANG = "es";
const CANONICAL_HOST = "www.peekr.app";

// Paths that must NOT be treated as usernames
const RESERVED_SEGMENTS = new Set([
  "es", "en", "pt",
  "about", "admin", "get", "go", "lang", "login", "privacy", "signup",
  "support", "terms", "test", "test-supabase", "lists", "buzz",
  "contact", "download-app", "explore", "title", "actor",
  "activity", "peeklist", "user", "u", "api", "sitemap.xml",
  "robots.txt", "apple-app-site-association", ".well-known", "sneak-peek",
  // Authenticated creator-side routes added in the F1+ web migration.
  // Without these, the username-rewrite below would interpret
  // "/my-peeklists" as a vanity username and serve /u/[username],
  // which then shows "User not found".
  "my-peeklists", "my-watchlist", "dashboard",
  // Password recovery flow — same reason: keep them out of the vanity
  // username rewrite so /forgot-password and /reset-password resolve
  // to the actual pages instead of /u/forgot-password.
  "forgot-password", "reset-password",
  // Branded newsletter previews live under /newsletter/<edition-slug>
  // (e.g. /newsletter/may-2026). Multi-segment paths bypass the username
  // rewrite already, but reserving the top-level keeps future single-
  // segment links (like /newsletter as an index) safe too.
  "newsletter",
]);

function hasLangPrefix(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  return segments.length > 0 && SUPPORTED_LANGS.has(segments[0]);
}

function getPreferredLang(request: NextRequest): string {
  const raw = request.headers.get("accept-language") || "";
  // Parse only the highest-priority language token (first entry before any
  // comma or semicolon). Using .includes() on the full string was wrong:
  // "es-419,es;q=0.9,en-US;q=0.8" would incorrectly match "en".
  const primary = raw.split(",")[0].split(";")[0].trim().toLowerCase();
  if (primary.startsWith("pt")) return "pt";
  if (primary.startsWith("en")) return "en";
  return "es";
}

function isBypassedPath(pathname: string) {
  return (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/.well-known") ||
    pathname.startsWith("/favicon.ico") ||
    pathname === "/sitemap.xml" ||
    pathname.startsWith("/sitemap/") ||
    pathname.startsWith("/robots.txt") ||
    /\.(png|jpg|jpeg|webp|gif|svg|ico|css|js|map|txt|xml)$/i.test(pathname)
  );
}

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const host = request.headers.get("host") || "";

  if (isBypassedPath(pathname)) {
    return NextResponse.next();
  }

  // ─────────────────────────────────────────────────────────────
  // Defensive: Supabase Auth password-recovery links arrive with a
  // ?code= or ?type=recovery query param on whatever URL the project's
  // Site URL points to. If that landing URL doesn't have a handler the
  // user gets stuck on the home page with no way to set a new password.
  // Bounce them to /reset-password preserving the query string so the
  // SDK can finish the exchange there.
  //
  // The same handling is also covered properly by adding
  // https://www.peekr.app/reset-password to the project's Redirect URLs
  // allowlist — this middleware is just a safety net.
  // ─────────────────────────────────────────────────────────────
  const looksLikeRecoveryLanding =
    (searchParams.has("code") || searchParams.get("type") === "recovery") &&
    pathname !== "/reset-password" &&
    pathname !== "/forgot-password" &&
    pathname !== "/login" &&
    !pathname.startsWith("/api") &&
    !pathname.startsWith("/_next");
  if (looksLikeRecoveryLanding) {
    const url = request.nextUrl.clone();
    url.pathname = "/reset-password";
    // searchParams (code/type/etc.) are preserved by clone.
    return NextResponse.redirect(url, 302);
  }

  // ─────────────────────────────────────────────────────────────
  // Calculamos la URL final ANTES de redireccionar, para poder
  // combinar host + lang + index.html en UN solo 308. Antes esto
  // generaba redirect chains de 2 hops que GSC marcaba como
  // "Redirect error".
  // ─────────────────────────────────────────────────────────────

  let finalPath = pathname;

  // 1) Normalizar /index.html → /
  if (finalPath === "/index.html") {
    finalPath = "/";
  }

  // 2) Inyectar idioma si el path lo necesita y no lo tiene
  const needsLang = !hasLangPrefix(finalPath);
  const lang = getPreferredLang(request) || DEFAULT_LANG;

  if (needsLang) {
    const shouldRedirectForLang =
      finalPath === "/" ||
      finalPath.startsWith("/lists/") ||
      finalPath.startsWith("/buzz/") ||
      finalPath.startsWith("/explore") ||
      finalPath.startsWith("/activity") ||
      finalPath.startsWith("/download-app") ||
      finalPath === "/my-peeklists" ||
      finalPath.startsWith("/my-peeklists/") ||
      finalPath === "/dashboard" ||
      finalPath.startsWith("/dashboard/");

    if (shouldRedirectForLang) {
      finalPath = `/${lang}${finalPath}`;
    }
  }

  // 3) Si el host o el path cambiaron, hacer UN ÚNICO redirect 308
  const needsHostFix = host !== CANONICAL_HOST;
  const needsPathFix = finalPath !== pathname;

  if (needsHostFix || needsPathFix) {
    const url = request.nextUrl.clone();
    url.protocol = "https:";
    url.host = CANONICAL_HOST;
    url.pathname = finalPath;
    return NextResponse.redirect(url, 308);
  }

  // 4) Si ya viene con idioma, dejar pasar
  //    (las excepciones /xx/login, /xx/signup y /xx/user/ se manejan en next.config.ts redirects)
  if (hasLangPrefix(pathname)) {
    return NextResponse.next();
  }

  // 5) Clean username URLs: /jmartinelli → serve /es/u/jmartinelli internally
  //    (browser keeps peekr.app/jmartinelli in the address bar)
  const segments = pathname.split("/").filter(Boolean);
  if (
    segments.length === 1 &&
    !RESERVED_SEGMENTS.has(segments[0]) &&
    /^[a-zA-Z0-9_.-]+$/.test(segments[0])
  ) {
    const url = request.nextUrl.clone();
    url.pathname = `/${lang}/u/${segments[0]}`;
    return NextResponse.rewrite(url);
  }

  // 6) Rutas que viven dentro de [lang] y necesitan rewrite (no redirect)
  //    para preservar el URL original en cards de social/OG crawlers
  const shouldRewrite =
    pathname.startsWith("/title/") ||
    pathname.startsWith("/actor/") ||
    pathname.startsWith("/peeklist/");

  if (shouldRewrite) {
    const url = request.nextUrl.clone();
    url.pathname = `/${lang}${pathname}`;
    const query = searchParams.toString();
    url.search = query ? `?${query}` : "";
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Only match routes that actually need middleware processing:
     * - / and /index.html (root redirect)
     * - Unprefixed content routes (need lang injection)
     * - Vanity usernames (single segment, no lang prefix)
     * Skip: _next, api, static files, AND already-prefixed /es/, /en/, /pt/ routes
     */
    "/((?!api|_next|favicon\\.ico|robots\\.txt|sitemap\\.xml|sitemap/|\\.|es/|en/|pt/).*)",
  ],
};
