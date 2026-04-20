import { NextRequest, NextResponse } from "next/server";
import { submitUrlsToIndexNow } from "@/lib/indexnow";

/**
 * POST /api/indexnow
 * Headers:
 *   Authorization: Bearer <INDEXNOW_API_SECRET>
 * Body:
 *   { "urls": ["https://www.peekr.app/es/title/movie/...", ...] }
 *
 * Call this whenever content changes — new editorial list, new buzz
 * article, title metadata updated — to notify Bing/Yandex/Seznam/etc
 * via IndexNow.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.INDEXNOW_API_SECRET;

  if (!secret) {
    return NextResponse.json(
      { ok: false, message: "INDEXNOW_API_SECRET is not configured" },
      { status: 503 }
    );
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized" },
      { status: 401 }
    );
  }

  let urls: string[] = [];
  try {
    const body = await request.json();
    if (Array.isArray(body?.urls)) {
      urls = body.urls.filter((u: unknown): u is string => typeof u === "string");
    } else if (typeof body?.url === "string") {
      urls = [body.url];
    }
  } catch {
    return NextResponse.json(
      { ok: false, message: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (urls.length === 0) {
    return NextResponse.json(
      { ok: false, message: "No URLs provided" },
      { status: 400 }
    );
  }

  const result = await submitUrlsToIndexNow(urls);

  return NextResponse.json(result, {
    status: result.ok ? 200 : 500,
  });
}
