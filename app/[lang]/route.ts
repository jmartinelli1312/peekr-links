import { NextResponse } from "next/server"

export async function GET(
  req: Request,
  { params }: { params: { lang: string } }
) {

  const res = NextResponse.redirect(new URL("/", req.url))

  res.cookies.set("lang", params.lang)

  return res
}
