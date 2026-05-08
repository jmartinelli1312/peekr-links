import { NextRequest, NextResponse } from "next/server";

// Smart link: detects device OS and redirects to the correct store.
// Used for Facebook/Instagram ads, QR codes, bio links, etc.
//
// peekr.app/get            → auto-detect
// peekr.app/get?utm_source=ig_bio&utm_campaign=launch  → UTM params pass through
const IOS_URL =
  "https://apps.apple.com/app/id6756285989";
const ANDROID_URL =
  "https://play.google.com/store/apps/details?id=com.peekr.peekr";
const FALLBACK_URL = "https://peekr.app";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const ua = req.headers.get("user-agent") ?? "";

  // Pass UTM / campaign params to the store URLs where possible.
  // App Store ignores extra query params; Play Store supports referrer.
  const { searchParams } = req.nextUrl;
  const utmSource = searchParams.get("utm_source") ?? "";
  const utmCampaign = searchParams.get("utm_campaign") ?? "";
  const utmMedium = searchParams.get("utm_medium") ?? "";

  // ── iOS detection ────────────────────────────────────────────
  // Covers iPhone, iPad, iPod and Facebook/Instagram in-app browser on iOS
  if (/iPhone|iPad|iPod/i.test(ua)) {
    return NextResponse.redirect(IOS_URL, { status: 302 });
  }

  // ── Android detection ────────────────────────────────────────
  if (/Android/i.test(ua)) {
    // Play Store supports the referrer param for install attribution
    const referrerParts: string[] = [];
    if (utmSource) referrerParts.push(`utm_source=${encodeURIComponent(utmSource)}`);
    if (utmMedium) referrerParts.push(`utm_medium=${encodeURIComponent(utmMedium)}`);
    if (utmCampaign) referrerParts.push(`utm_campaign=${encodeURIComponent(utmCampaign)}`);

    const androidUrl =
      referrerParts.length > 0
        ? `${ANDROID_URL}&referrer=${encodeURIComponent(referrerParts.join("%26"))}`
        : ANDROID_URL;

    return NextResponse.redirect(androidUrl, { status: 302 });
  }

  // ── Desktop / unknown → website ──────────────────────────────
  return NextResponse.redirect(FALLBACK_URL, { status: 302 });
}
