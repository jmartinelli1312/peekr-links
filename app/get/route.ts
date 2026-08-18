import { NextRequest, NextResponse } from "next/server";

// Smart install link: detects device OS, logs an attribution click, and
// redirects to the correct store.
//
//   peekr.app/get                              → organic web download (source=web)
//   peekr.app/get?s=creator:cineytvfans        → per-creator attribution
//   peekr.app/get?s=ig_bio&c=launch            → channel/campaign attribution
//   peekr.app/get?utm_source=ig_bio&utm_campaign=launch → legacy UTM (still works)
//
// Attribution (free, no MMP): a short-lived token is logged to `install_clicks`.
//   • Android → token travels in the Play Store referrer (read in-app via the
//     Install Referrer API).
//   • iOS → an interstitial copies the token to the clipboard; the app reads it
//     on first launch. Best-effort (Apple has no install referrer).
// The app calls claim_acquisition(token) once after signup to resolve the source.
const IOS_URL = "https://apps.apple.com/app/id6756285989";
// `pli=1` (Play Identity Login) opens Play with the signed-in account so the
// install flow doesn't bounce through a login.
const ANDROID_URL =
  "https://play.google.com/store/apps/details?id=com.peekr.peekr&pli=1";
const FALLBACK_URL = "https://peekr.app";

export const runtime = "edge";

// Best-effort click log via the Supabase REST API with the service-role key.
// Never throws — attribution must never block an install.
async function logClick(row: {
  token: string;
  source: string;
  campaign: string;
  platform: string;
  raw: unknown;
}): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  try {
    await fetch(`${url}/rest/v1/install_clicks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        Authorization: `Bearer ${key}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify(row),
    });
  } catch {
    // swallow — best-effort
  }
}

function resolveSource(sp: URLSearchParams): { source: string; campaign: string } {
  const source = sp.get("s") || sp.get("utm_source") || "web";
  const campaign = sp.get("c") || sp.get("utm_campaign") || "";
  return { source, campaign };
}

export async function GET(req: NextRequest) {
  const ua = req.headers.get("user-agent") ?? "";
  const sp = req.nextUrl.searchParams;
  const { source, campaign } = resolveSource(sp);

  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);

  // Desktop / unknown → just the website (nothing to install, skip logging).
  if (!isIOS && !isAndroid) {
    return NextResponse.redirect(FALLBACK_URL, { status: 302 });
  }

  const token = crypto.randomUUID();
  const raw = {
    s: sp.get("s"),
    c: sp.get("c"),
    utm_source: sp.get("utm_source"),
    utm_medium: sp.get("utm_medium"),
    utm_campaign: sp.get("utm_campaign"),
    fbclid: sp.get("fbclid"),
    ref: req.headers.get("referer"),
    ua,
  };

  await logClick({
    token,
    source,
    campaign,
    platform: isIOS ? "ios" : "android",
    raw,
  });

  // ── Android ──────────────────────────────────────────────────
  // Token + UTM ride in the Play referrer; the app reads it on first launch.
  if (isAndroid) {
    const referrer = [
      `peekr_token=${token}`,
      `utm_source=${encodeURIComponent(source)}`,
      campaign ? `utm_campaign=${encodeURIComponent(campaign)}` : "",
    ]
      .filter(Boolean)
      .join("&");
    const androidUrl = `${ANDROID_URL}&referrer=${encodeURIComponent(referrer)}`;
    return NextResponse.redirect(androidUrl, { status: 302 });
  }

  // ── iOS ──────────────────────────────────────────────────────
  // Interstitial copies the token to the clipboard, then opens the App Store.
  // Auto-copy on load (best-effort) + guaranteed copy on the button tap (the
  // tap provides the user gesture Safari needs), then a 1.2s auto-redirect.
  const clip = `peekr-attr:${token}`;
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Peekr</title>
<style>
  html,body{margin:0;height:100%}
  .w{min-height:100vh;display:grid;place-items:center;background:#0B0B0F;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
  .c{text-align:center;padding:24px}
  .l{font-size:36px;font-weight:900;letter-spacing:-.04em;color:#FA0082;margin-bottom:18px}
  .s{width:32px;height:32px;border:3px solid rgba(255,255,255,.1);border-top-color:#FA0082;border-radius:50%;animation:sp .7s linear infinite;margin:0 auto 16px}
  @keyframes sp{to{transform:rotate(360deg)}}
  .b{display:inline-block;margin-top:14px;padding:12px 22px;background:#FA0082;color:#fff;border-radius:999px;font-weight:700;text-decoration:none}
  .t{font-size:14px;color:rgba(255,255,255,.55);line-height:1.6}
</style></head>
<body><div class="w"><div class="c">
  <div class="l">Peekr</div><div class="s"></div>
  <p class="t">Abriendo App Store…</p>
  <a class="b" id="go" href="${IOS_URL}">Abrir App Store</a>
</div></div>
<script>
  (function(){
    var clip=${JSON.stringify(clip)},store=${JSON.stringify(IOS_URL)};
    function copy(){try{return navigator.clipboard.writeText(clip)}catch(e){return Promise.reject(e)}}
    copy().catch(function(){});
    document.getElementById('go').addEventListener('click',function(e){
      e.preventDefault();copy().catch(function(){}).finally(function(){location.href=store});
    });
    setTimeout(function(){location.href=store},1200);
  })();
</script></body></html>`;
  return new NextResponse(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
