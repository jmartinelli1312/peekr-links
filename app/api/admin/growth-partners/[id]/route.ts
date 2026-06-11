import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/growth-partners/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "growth-partner-contracts";

// DELETE /api/admin/growth-partners/[id] — permanently remove a contract.
// Requires the client to confirm with { confirm: "ELIMINAR" } in the body so
// an accidental request never destroys a record. Cleans up the stored final
// PDF (if any); the audit rows cascade-delete with the partner row.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const { admin } = auth;
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (String(body.confirm ?? "").trim().toUpperCase() !== "ELIMINAR") {
    return NextResponse.json(
      { error: "Confirmación inválida. Escribí ELIMINAR para confirmar." },
      { status: 400 }
    );
  }

  // Look up the row first so we can clean its stored PDF and log the deletion.
  const { data: row } = await admin
    .from("growth_partners")
    .select("id, username, country, percentage, final_pdf_path")
    .eq("id", id)
    .maybeSingle();

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Best-effort: remove the stored signed PDF (and any siblings under the id
  // folder). Storage errors don't block the row deletion.
  try {
    const paths: string[] = [];
    if (row.final_pdf_path) paths.push(row.final_pdf_path);
    const { data: listed } = await admin.storage.from(BUCKET).list(row.id);
    for (const f of listed ?? []) paths.push(`${row.id}/${f.name}`);
    if (paths.length > 0) {
      await admin.storage.from(BUCKET).remove(Array.from(new Set(paths)));
    }
  } catch {
    /* ignore storage cleanup failures */
  }

  // The partner's audit rows cascade-delete with the row (FK ON DELETE CASCADE).
  const { error: delErr } = await admin
    .from("growth_partners")
    .delete()
    .eq("id", id);

  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
