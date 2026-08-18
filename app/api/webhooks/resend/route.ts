import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/webhooks/resend
 *
 * Receives Resend email events (delivered / opened / clicked / bounced / …)
 * and stores them in public.email_events so we can compute open/click rates
 * per newsletter edition (joined to newsletter_sends.resend_id).
 *
 * Security: Resend signs webhooks with Svix. We verify the signature with
 * RESEND_WEBHOOK_SECRET (format "whsec_…") before trusting the payload.
 *
 * Setup (one-time): Resend dashboard → Webhooks → add endpoint
 *   https://peekr.app/api/webhooks/resend  (select the email.* events)
 * then copy the signing secret into the RESEND_WEBHOOK_SECRET env var (Vercel).
 */

function verifySvix(
  secret: string,
  svixId: string,
  svixTimestamp: string,
  body: string,
  svixSignature: string
): boolean {
  // Secret is "whsec_<base64>"; the HMAC key is the decoded base64.
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const signedContent = `${svixId}.${svixTimestamp}.${body}`;
  const expected = crypto
    .createHmac("sha256", key)
    .update(signedContent)
    .digest("base64");

  // Header is space-separated "v1,<sig> v1,<sig2>" — any match passes.
  const expectedBuf = Buffer.from(expected);
  return svixSignature.split(" ").some((part) => {
    const sig = part.includes(",") ? part.split(",")[1] : part;
    const sigBuf = Buffer.from(sig);
    return (
      sigBuf.length === expectedBuf.length &&
      crypto.timingSafeEqual(sigBuf, expectedBuf)
    );
  });
}

const TYPE_MAP: Record<string, string> = {
  "email.delivered": "delivered",
  "email.opened": "opened",
  "email.clicked": "clicked",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.delivery_delayed": "delivery_delayed",
  "email.sent": "sent",
};

export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "RESEND_WEBHOOK_SECRET not configured" },
      { status: 500 }
    );
  }

  const body = await req.text();
  const svixId = req.headers.get("svix-id") ?? "";
  const svixTimestamp = req.headers.get("svix-timestamp") ?? "";
  const svixSignature = req.headers.get("svix-signature") ?? "";

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Missing Svix headers" }, { status: 400 });
  }

  if (!verifySvix(secret, svixId, svixTimestamp, body, svixSignature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: {
    type?: string;
    created_at?: string;
    data?: { email_id?: string; to?: string[] };
  };
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = TYPE_MAP[payload.type ?? ""] ?? payload.type ?? "unknown";
  const data = payload.data ?? {};
  const email = Array.isArray(data.to) ? data.to[0] : null;

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("email_events").upsert(
    {
      resend_id: data.email_id ?? null,
      event_type: eventType,
      email,
      occurred_at: payload.created_at ?? new Date().toISOString(),
      raw: payload,
    },
    { onConflict: "resend_id,event_type,occurred_at", ignoreDuplicates: true }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Feedback loop: hard bounces and spam complaints mean we must stop mailing
  // this address. Add it to the suppression list so the newsletter send skips
  // it forever (protects sender reputation; a bounced address in a Resend batch
  // also 422s the whole batch). Idempotent.
  if ((eventType === "bounced" || eventType === "complained") && email) {
    await supabase.from("email_suppressions").upsert(
      {
        email: email.trim().toLowerCase(),
        reason: eventType,
        source: "resend_webhook",
      },
      { onConflict: "email", ignoreDuplicates: true }
    );
  }

  return NextResponse.json({ ok: true });
}
