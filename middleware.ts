import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SUPPORTED_LANGS = new Set(["es", "en", "pt"]);
const DEFAULT_LANG = "es";
const CANONICAL_HOST = "www.peekr.app";

// Paths that must NOT be treated as usernames
const RESERVED_SEGMENTS = new Set([
  "es", "en", "pt",
  "about", "admin", "go", "lang", "login", "privacy", "signup",
  "support", "terms", "test", "test-supabase", "lists", "buzz",
  "contact", "download-app", "explore", "title", "actor",
  "activity", "peeklist", "user", "u", "api", "sitemap.xml",
  "robots.txt", "apple-app-site-association", ".well-known", "sneak-peek",
]);

function hasLangPrefix(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  return segments.length > 0 && SUPPORTED_LANGS.has(segments[0]);
}

function getPreferredLang(request: NextRequest) {
  const acceptLanguage =
    request.headers.get("accept-language")?.toLowerCase() || "";

  if (acceptLanguage.includes("pt")) return "pt";
  if (acceptLanguage.includes("en")) return "en";
  return "es";
}

function isBypassedPath(pathname: string) {
  return (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/.well-known") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/sitemap.xml") ||
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

  // 1) Forzar dominio canónico: https://www.peekr.app
  if (host !== CANONICAL_HOST) {
    const url = request.nextUrl.clone();
    url.protocol = "https:";
    url.host = CANONICAL_HOST;
    return NextResponse.redirect(url, 308);
  }

  // 2) Normalizar /index.html -> /
  if (pathname === "/index.html") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url, 308);
  }

  // 3) Si ya viene con idioma, dejar pasar
  //    Excepción: /xx/login y /xx/signup viven en la raíz, redirigir
  //    Excepción: /xx/user/username → redirect to /xx/u/username (old route)
  if (hasLangPrefix(pathname)) {
    const segments = pathname.split("/").filter(Boolean);
    if (segments.length === 2 && (segments[1] === "login" || segments[1] === "signup")) {
      const url = request.nextUrl.clone();
      url.pathname = `/${segments[1]}`;
      return NextResponse.redirect(url, 308);
    }
    if (segments.length === 3 && segments[1] === "user") {
      const url = request.nextUrl.clone();
      url.pathname = `/${segments[0]}/u/${segments[2]}`;
      return NextResponse.redirect(url, 308);
    }
    return NextResponse.next();
  }

  // 4) Clean username URLs: /jmartinelli → serve /es/u/jmartinelli internally
  //    (browser keeps peekr.app/jmartinelli in the address bar)
  const segments = pathname.split("/").filter(Boolean);
  if (
    segments.length === 1 &&
    !RESERVED_SEGMENTS.has(segments[0]) &&
    /^[a-zA-Z0-9_.-]+$/.test(segments[0])
  ) {
    const lang = getPreferredLang(request) || DEFAULT_LANG;
    const url = request.nextUrl.clone();
    url.pathname = `/${lang}/u/${segments[0]}`;
    return NextResponse.rewrite(url);
  }

  // 5) Rutas que viven dentro de [lang] y necesitan prefijo de idioma
  const shouldRedirect =
    pathname === "/" ||
    pathname.startsWith("/actor/") ||
    pathname.startsWith("/title/") ||
    pathname.startsWith("/lists/") ||
    pathname.startsWith("/buzz/") ||
    pathname.startsWith("/explore") ||
    pathname.startsWith("/activity") ||
    pathname.startsWith("/download-app") ||
    pathname.startsWith("/peeklist/");

  if (!shouldRedirect) {
    return NextResponse.next();
  }

  const lang = getPreferredLang(request) || DEFAULT_LANG;
  const url = request.nextUrl.clone();
  url.pathname = `/${lang}${pathname}`;

  const query = searchParams.toString();
  url.search = query ? `?${query}` : "";

  return NextResponse.redirect(url, 301);
}

export const config = {
  matcher: [
    "/",
    "/index.html",
    "/actor/:path*",
    "/title/:path*",
    "/lists/:path*",
    "/buzz/:path*",
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
