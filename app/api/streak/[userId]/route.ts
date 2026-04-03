import { NextRequest, NextResponse } from "next/server"

import { store } from "@/lib/server/store"

export async function GET(
  _: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  const params = await context.params
  const user = store.users.get(params.userId)
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  return NextResponse.json({
    userId: user.userId,
    currentStreak: user.currentStreak,
    longestStreak: user.longestStreak,
    completedDates: user.completedDates,
  })
}
