/**
 * Serves the IndexNow verification key at /indexnow-key.txt
 *
 * IndexNow verifies domain ownership by fetching this URL — the content
 * must be exactly the same key value that we send in API submissions.
 * We store the key in the INDEXNOW_KEY env var so it can be rotated
 * without a code change.
 */

export const dynamic = "force-static";
export const revalidate = 3600;

export function GET() {
  const key = process.env.INDEXNOW_KEY?.trim();

  if (!key) {
    return new Response("IndexNow key not configured", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  return new Response(key, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, must-revalidate",
    },
  });
}
