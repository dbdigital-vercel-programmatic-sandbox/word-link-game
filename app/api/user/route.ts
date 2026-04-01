import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

import { anonymizeUser } from "@/lib/server/identity"

const COOKIE = "strand_uid"

export async function DELETE(request: NextRequest) {
  const body = (await request.json()) as { userId: string }
  anonymizeUser(body.userId)
  const res = NextResponse.json({ success: true })
  const jar = await cookies()
  jar.delete(COOKIE)
  res.cookies.set(COOKIE, "", { maxAge: 0, path: "/" })
  return res
}
