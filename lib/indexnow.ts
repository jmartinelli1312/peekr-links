/**
 * IndexNow integration — pings Bing, Yandex, Seznam, Naver, and Yep
 * simultaneously via the shared api.indexnow.org endpoint.
 *
 * Spec: https://www.indexnow.org/documentation
 *
 * Env vars required:
 *   INDEXNOW_KEY         — 8-128 char alphanumeric key (also served at
 *                          /indexnow-key.txt for domain verification)
 *   INDEXNOW_API_SECRET  — shared secret protecting the /api/indexnow
 *                          endpoint so only trusted callers can trigger
 *                          submissions
 */

const SITE = "https://www.peekr.app";
const HOST = "www.peekr.app";
const INDEXNOW_ENDPOINT = "https://api.indexnow.org/IndexNow";
const KEY_LOCATION = `${SITE}/indexnow-key.txt`;

// IndexNow limits requests to 10,000 URLs per submission.
const MAX_URLS_PER_REQUEST = 10_000;

export type IndexNowResult = {
  ok: boolean;
  status: number;
  submitted: number;
  message: string;
};

function getKey(): string | null {
  const key = process.env.INDEXNOW_KEY?.trim();
  return key && key.length >= 8 ? key : null;
}

/**
 * Submit one or more URLs to IndexNow.
 * Safe to call from API routes, server actions, and scheduled jobs.
 * Returns a result object — never throws, so callers can fire-and-forget.
 */
export async function submitUrlsToIndexNow(
  urls: string[]
): Promise<IndexNowResult> {
  const key = getKey();
  if (!key) {
    return {
      ok: false,
      status: 0,
      submitted: 0,
      message: "INDEXNOW_KEY is not configured",
    };
  }

  const unique = Array.from(
    new Set(
      urls
        .map((u) => u.trim())
        .filter((u) => u.startsWith(`${SITE}/`) || u === SITE)
    )
  );

  if (unique.length === 0) {
    return {
      ok: false,
      status: 0,
      submitted: 0,
      message: "No valid URLs to submit",
    };
  }

  const batch = unique.slice(0, MAX_URLS_PER_REQUEST);

  try {
    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        host: HOST,
        key,
        keyLocation: KEY_LOCATION,
        urlList: batch,
      }),
    });

    // IndexNow returns 200 (success), 202 (accepted, will verify),
    // 400 (bad request), 403 (key mismatch), 422 (URLs not matching host),
    // 429 (rate limited).
    return {
      ok: res.ok,
      status: res.status,
      submitted: batch.length,
      message: res.ok
        ? `Submitted ${batch.length} URLs`
        : `IndexNow returned ${res.status}`,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      submitted: 0,
      message: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
