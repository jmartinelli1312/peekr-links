import { NextResponse } from "next/server"

export async function GET(
  request: Request,
  context: { params: Promise<{ lang: string }> }
) {

  const { lang } = await context.params

  const response = NextResponse.redirect(new URL("/", request.url))

  response.cookies.set("lang", lang)

  return response
}
