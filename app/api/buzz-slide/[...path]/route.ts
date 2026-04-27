// Proxy route para slides del Buzz → TikTok.
// TikTok exige que las imágenes vengan de un dominio verificado.
// www.peekr.app está verificado; supabase.co no lo está.
//
// GET /api/buzz-slide/{draft_id}/{filename}
//   → proxea desde Supabase Storage (buzz-slides bucket)

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

  const contentType = res.headers.get("content-type") ?? "image/png";
  const body = await res.arrayBuffer();

  return new Response(body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
