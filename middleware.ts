import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SUPPORTED_LANGS = new Set(["es", "en", "pt"]);
const DEFAULT_LANG = "es";

function hasLangPrefix(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  return segments.length > 0 && SUPPORTED_LANGS.has(segments[0]);
}

function getPreferredLang(request: NextRequest) {
  const acceptLanguage = request.headers.get("accept-language")?.toLowerCase() || "";

  if (acceptLanguage.includes("pt")) return "pt";
  if (acceptLanguage.includes("en")) return "en";
  return "es";
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // No tocar archivos internos, APIs o assets
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/sitemap.xml") ||
    pathname.startsWith("/robots.txt") ||
    pathname.match(/\.(png|jpg|jpeg|webp|gif|svg|ico|css|js|map|txt|xml)$/)
  ) {
    return NextResponse.next();
  }

  // Si ya viene con idioma, dejar pasar
  if (hasLangPrefix(pathname)) {
    return NextResponse.next();
  }

  // Rutas públicas que quieres internacionalizar ya mismo
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
  url.search = search;

  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/",
    "/actor/:path*",
    "/title/:path*",
    "/lists/:path*",
    "/buzz/:path*",
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
