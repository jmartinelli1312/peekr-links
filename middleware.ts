import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SUPPORTED_LANGS = new Set(["es", "en", "pt"]);
const DEFAULT_LANG = "es";
const CANONICAL_HOST = "www.peekr.app";

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
  if (hasLangPrefix(pathname)) {
    return NextResponse.next();
  }

  // 4) Solo redirigir a idioma en rutas públicas definidas
  const shouldRedirect =
    pathname === "/" ||
    pathname.startsWith("/actor/") ||
    pathname.startsWith("/title/") ||
    pathname.startsWith("/lists/") ||
    pathname.startsWith("/buzz/");

  if (!shouldRedirect) {
    return NextResponse.next();
  }

  const lang = getPreferredLang(request) || DEFAULT_LANG;
  const url = request.nextUrl.clone();
  url.pathname = `/${lang}${pathname}`;

  const query = searchParams.toString();
  url.search = query ? `?${query}` : "";

  return NextResponse.redirect(url, 307);
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
