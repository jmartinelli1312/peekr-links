// Proxy that fetches a newsletter edition HTML preview from the
// Supabase Edge Function and serves it back from our own domain.
//
// Why a proxy:
//   Supabase Edge Functions always set
//     content-security-policy: default-src 'none'; sandbox
//   on their responses, which forces browsers to refuse to render the
//   HTML (no images, no styles, no execution). That's there to stop
//   abuse of edge functions as static-HTML hosting. Our own /api route
//   doesn't have that constraint, so we re-emit the HTML with a clean
//   text/html content type and the browser renders normally.
//
// Endpoint: GET /api/newsletter-preview/[id]?lang=es|pt
// Public — read-only, no DB mutation, edition_id is the entropy.

import { NextRequest, NextResponse } from "next/server";

const SB_FUNCTIONS_URL =
  "https://glorjiffzccygrhtvnyc.supabase.co/functions/v1/newsletter_sender";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const editionId = Number(id);
  if (!Number.isFinite(editionId) || editionId <= 0) {
    return new NextResponse("Invalid edition id", { status: 400 });
  }
  const lang = (req.nextUrl.searchParams.get("lang") === "pt") ? "pt" : "es";

  const upstream = await fetch(
    `${SB_FUNCTIONS_URL}?action=preview&edition_id=${editionId}&lang=${lang}`,
    { cache: "no-store" },
  );
  if (!upstream.ok) {
    const text = await upstream.text();
    return new NextResponse(
      `Upstream error ${upstream.status}: ${text.slice(0, 500)}`,
      { status: 502 },
    );
  }
  const html = await upstream.text();

  // Re-emit with clean headers — the upstream CSP/sandbox is dropped here.
  return new NextResponse(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
