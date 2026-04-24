// POST /api/meta/data-deletion
//
// Endpoint requerido por Meta para que los usuarios soliciten la
// eliminación de sus datos. Meta exige una respuesta JSON con:
//   { url: string, confirmation_code: string }
// La `url` es donde el usuario puede verificar el estado, y
// `confirmation_code` es un identificador de la solicitud.
//
// Como Peekr no guarda datos vinculados al user_id de Meta (solo opera
// con su propia cuenta business), no tenemos nada que borrar, pero
// cumplimos con el contrato del endpoint.

import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.text();
    console.log("[meta/data-deletion] received", { bodyLength: body.length });
  } catch (e) {
    console.warn("[meta/data-deletion] error parsing body", e);
  }

  const confirmationCode = `peekr-${Date.now().toString(36)}`;
  return NextResponse.json({
    url: `https://www.peekr.app/data-deletion-status?code=${confirmationCode}`,
    confirmation_code: confirmationCode,
  });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    info: "POST to request deletion. See privacy policy at https://www.peekr.app/privacy",
  });
}
