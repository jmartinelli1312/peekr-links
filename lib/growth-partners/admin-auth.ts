import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminOk = { admin: SupabaseClient; userId: string };

/**
 * Verifies the caller is an admin (Bearer token + profiles.is_admin).
 * Returns { admin, userId } on success, or a NextResponse error to return.
 */
export async function requireAdmin(
  req: NextRequest
): Promise<AdminOk | NextResponse> {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = getSupabaseAdmin();
  const {
    data: { user },
    error,
  } = await admin.auth.getUser(token);
  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data: profile } = await admin
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return { admin, userId: user.id };
}

export function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}
