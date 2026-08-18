import { NextRequest, NextResponse } from "next/server";

// Renders the personalized "SneakPeeks" weekly email for a given user, served
// with text/html so it renders in the browser. The edge function itself can
// only return text/plain (Supabase forces nosniff on function responses), so
// this route proxies it and fixes the content-type.
//
//   /admin/email-preview?username=jmartinelli&lang=es|pt|en
const FN = "https://glorjiffzccygrhtvnyc.supabase.co/functions/v1/newsletter_sender";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const username = sp.get("username") || "jmartinelli";
  const lang = sp.get("lang") || "es";
  const url = `${FN}?action=preview_personal&username=${encodeURIComponent(username)}&lang=${encodeURIComponent(lang)}`;
  const res = await fetch(url, { cache: "no-store" });
  const html = await res.text();
  return new NextResponse(html, {
    status: res.status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
