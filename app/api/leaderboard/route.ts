import { NextRequest, NextResponse } from "next/server"

import {
  getLeaderboardByDate,
  getLeaderboardByPeriod,
} from "@/lib/server/leaderboard"

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date")
  const period = request.nextUrl.searchParams.get("period") as
    | "week"
    | "all"
    | null

  const entries = period
    ? getLeaderboardByPeriod(period)
    : getLeaderboardByDate(date ?? undefined)
  return NextResponse.json({ entries })
}
