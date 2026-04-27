// Proxy route para slides del Buzz → TikTok.
// TikTok exige:
//   1. Imágenes desde un dominio verificado (www.peekr.app está verificado).
//   2. Formato JPEG o WebP (no acepta PNG).
//
// Este route proxea desde Supabase Storage y convierte PNG → JPEG on-the-fly.
//
// GET /api/buzz-slide/{draft_id}/{filename}

import sharp from "sharp";

const SUPABASE_STORAGE =
  "https://glorjiffzccygrhtvnyc.supabase.co/storage/v1/object/public/buzz-slides";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const filePath = path.join("/");

  const upstream = `${SUPABASE_STORAGE}/${filePath}`;

  let res: Response;
  try {
    res = await fetch(upstream, { next: { revalidate: 31536000 } });
  } catch {
    return new Response("upstream fetch failed", { status: 502 });
  }

  if (!res.ok) {
    return new Response("not found", { status: 404 });
  }

  const buffer = Buffer.from(await res.arrayBuffer());

  // Convertir a JPEG (TikTok no acepta PNG).
  let jpeg: Buffer;
  try {
    jpeg = await sharp(buffer).jpeg({ quality: 92 }).toBuffer();
  } catch {
    // Si sharp falla, devolvemos la imagen original (fallback).
    return new Response(buffer, {
      headers: {
        "Content-Type": res.headers.get("content-type") ?? "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }

  return new Response(jpeg, {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
