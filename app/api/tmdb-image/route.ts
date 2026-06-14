import { NextRequest } from "next/server";

// Proxies a TMDB image and forces a browser download via Content-Disposition.
// Going through our own origin avoids the cross-origin restriction that makes
// <a download> on image.tmdb.org open the file instead of downloading it.

// TMDB file paths look like "/abc123XYZ.jpg" (also .png / .svg for logos).
const ALLOWED_PATH = /^\/[A-Za-z0-9._-]+\.(jpg|jpeg|png|svg|webp)$/;

// Allowed TMDB size buckets. We default to w1280 instead of `original`:
// `original` files are 2–8 MB each and stream through this function (counting
// as Fast Origin + Fast Data Transfer on Vercel — a real cost driver once the
// download galleries shipped). w1280 is still high quality for a download but
// 5–10x smaller. Callers can opt back into full size with `?size=original`.
const ALLOWED_SIZES = new Set([
  "w300", "w500", "w780", "w1280", "original",
]);

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const path = searchParams.get("path") || "";
  const name = searchParams.get("name") || "peekr-image";
  const sizeParam = searchParams.get("size") || "w1280";
  const size = ALLOWED_SIZES.has(sizeParam) ? sizeParam : "w1280";

  if (!ALLOWED_PATH.test(path)) {
    return new Response("Invalid image path", { status: 400 });
  }

  const upstream = await fetch(`https://image.tmdb.org/t/p/${size}${path}`, {
    next: { revalidate: 604800 }, // 7d — TMDB images are immutable by path
  });

  if (!upstream.ok || !upstream.body) {
    return new Response("Image not found", { status: 404 });
  }

  const ext = path.split(".").pop() || "jpg";
  const safeName =
    name.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) ||
    "peekr-image";

  const headers = new Headers();
  headers.set(
    "Content-Type",
    upstream.headers.get("content-type") || "image/jpeg"
  );
  headers.set(
    "Content-Disposition",
    `attachment; filename="${safeName}.${ext}"`
  );
  headers.set("Cache-Control", "public, max-age=31536000, immutable");

  return new Response(upstream.body, { status: 200, headers });
}
