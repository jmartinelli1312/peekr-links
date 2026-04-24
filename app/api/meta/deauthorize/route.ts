// POST /api/meta/deauthorize
//
// Endpoint requerido por Meta (Instagram, Threads, Facebook) que se
// invoca cuando un usuario revoca el acceso de nuestra app a sus datos.
// Como Peekr opera con cuentas propias (no gestiona accounts de terceros),
// solo registramos la llamada y devolvemos 200.

import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    // Meta manda un "signed_request" en form-urlencoded. No lo validamos
    // criptográficamente porque no tenemos acción que tomar con él:
    // Peekr no guarda datos vinculados al user_id de Meta.
    const body = await request.text();
    console.log("[meta/deauthorize] received", { bodyLength: body.length });
  } catch (e) {
    console.warn("[meta/deauthorize] error parsing body", e);
  }

  return NextResponse.json({ ok: true });
}

// Algunas versiones del crawler de Meta hacen GET para verificar que el
// endpoint exista. Respondemos 200 en GET también.
export async function GET() {
  return NextResponse.json({ ok: true });
}
