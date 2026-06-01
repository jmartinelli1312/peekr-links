import { NextRequest } from "next/server";

// Proxies a TMDB image and forces a browser download via Content-Disposition.
// Going through our own origin avoids the cross-origin restriction that makes
// <a download> on image.tmdb.org open the file instead of downloading it.

// TMDB file paths look like "/abc123XYZ.jpg" (also .png / .svg for logos).
const ALLOWED_PATH = /^\/[A-Za-z0-9._-]+\.(jpg|jpeg|png|svg|webp)$/;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const path = searchParams.get("path") || "";
  const name = searchParams.get("name") || "peekr-image";

  if (!ALLOWED_PATH.test(path)) {
    return new Response("Invalid image path", { status: 400 });
  }

  const upstream = await fetch(`https://image.tmdb.org/t/p/original${path}`, {
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
