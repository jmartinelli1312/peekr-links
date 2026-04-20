import { NextRequest, NextResponse } from "next/server";
import sitemap from "@/app/sitemap";
import { submitUrlsToIndexNow } from "@/lib/indexnow";

/**
 * POST /api/indexnow/submit-sitemap
 * Headers:
 *   Authorization: Bearer <INDEXNOW_API_SECRET>
 *
 * One-shot endpoint that pulls every URL from the sitemap and submits
 * them to IndexNow in batches of 10,000. Use this once after configuring
 * IndexNow to seed Bing/Yandex/etc with the full site inventory.
 *
 * Subsequent updates should use the /api/indexnow endpoint to submit
 * only changed URLs.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.INDEXNOW_API_SECRET;

  if (!secret) {
    return NextResponse.json(
      { ok: false, message: "INDEXNOW_API_SECRET is not configured" },
      { status: 503 }
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    if (urls.length === 0) {
      return NextResponse.json(
        { ok: false, message: "Sitemap is empty" },
        { status: 500 }
      );
    }

    // Submit in batches of 10,000 (IndexNow spec limit).
    const BATCH_SIZE = 10_000;
    const results = [];
    for (let i = 0; i < urls.length; i += BATCH_SIZE) {
      const batch = urls.slice(i, i + BATCH_SIZE);
      const result = await submitUrlsToIndexNow(batch);
      results.push(result);
    }

    const totalSubmitted = results.reduce((acc, r) => acc + r.submitted, 0);
    const allOk = results.every((r) => r.ok);

    return NextResponse.json({
      ok: allOk,
      totalSubmitted,
      batches: results,
      sitemapUrls: urls.length,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        message: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
