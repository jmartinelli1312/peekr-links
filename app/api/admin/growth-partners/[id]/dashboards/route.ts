import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/growth-partners/admin-auth";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Resolve the Peekr profile behind a growth-partner contract (matched by the
// contract's handle/username, ignoring a leading @).
async function resolveProfile(admin: SupabaseClient, contractId: string) {
  const { data: contract } = await admin
    .from("growth_partners")
    .select("username")
    .eq("id", contractId)
    .maybeSingle();
  if (!contract) return { notFound: true as const };
  const handle = String(contract.username || "")
    .replace(/^@+/, "")
    .trim()
    .toLowerCase();
  if (!handle) return { handle: "", profile: null as null };
  const { data: profile } = await admin
    .from("profiles")
    .select("id, username")
    .ilike("username", handle)
    .maybeSingle();
  return { handle, profile: (profile as { id: string; username: string } | null) ?? null };
}

// GET — current dashboard countries for the partner behind [id].
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;
  const { id } = await params;

  const r = await resolveProfile(admin, id);
  if ("notFound" in r) return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  if (!r.profile) {
    return NextResponse.json({ linked: false, handle: r.handle, userId: null, countries: [] });
  }
  const { data: rows } = await admin
    .from("creator_dashboards")
    .select("country_code, enabled")
    .eq("user_id", r.profile.id);
  const countries = (rows ?? [])
    .filter((x) => x.enabled)
    .map((x) => String(x.country_code).toUpperCase())
    .sort();
  return NextResponse.json({
    linked: true,
    handle: r.handle,
    userId: r.profile.id,
    username: r.profile.username,
    countries,
  });
}

// POST { countries: string[] } — set exactly which countries the partner sees.
// Empty array = no dashboards.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as { countries?: unknown };
  const countries = Array.isArray(body.countries)
    ? Array.from(
        new Set(
          body.countries
            .map((c) => String(c).toUpperCase().trim())
            .filter(Boolean)
        )
      )
    : [];

  const r = await resolveProfile(admin, id);
  if ("notFound" in r) return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  if (!r.profile) {
    return NextResponse.json(
      {
        error: `No existe un perfil de Peekr con el usuario @${r.handle}. El partner necesita una cuenta para asignarle dashboards.`,
      },
      { status: 400 }
    );
  }
  const userId = r.profile.id;

  const { data: existing } = await admin
    .from("creator_dashboards")
    .select("country_code")
    .eq("user_id", userId);
  const existingCodes = (existing ?? []).map((x) => String(x.country_code).toUpperCase());

  const toDelete = existingCodes.filter((c) => !countries.includes(c));
  if (toDelete.length > 0) {
    await admin
      .from("creator_dashboards")
      .delete()
      .eq("user_id", userId)
      .in("country_code", toDelete);
  }

  if (countries.length > 0) {
    await admin.from("creator_dashboards").upsert(
      countries.map((c) => ({ user_id: userId, country_code: c, enabled: true })),
      { onConflict: "user_id,country_code" }
    );
  }

  return NextResponse.json({ ok: true, countries: [...countries].sort() });
}
