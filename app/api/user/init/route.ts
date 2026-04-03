import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

import { getOrCreateUser } from "@/lib/server/identity"

const COOKIE = "strand_uid"

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { userId?: string }
  const jar = await cookies()
  const cookieUserId = jar.get(COOKIE)?.value
  const candidate = cookieUserId || body.userId
  const user = getOrCreateUser(candidate)

  const res = NextResponse.json({
    userId: user.userId,
    displayName: user.displayName,
    streak: user.currentStreak,
    completedDates: user.completedDates,
  })

  res.cookies.set(COOKIE, user.userId, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    path: "/",
  })

  return res
}
