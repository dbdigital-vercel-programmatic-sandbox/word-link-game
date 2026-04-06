import { NextRequest, NextResponse } from "next/server"

import { store } from "@/lib/server/store"

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date")
  if (date) {
    const puzzle = store.puzzles.get(date)
    if (!puzzle) {
      return NextResponse.json({ error: "Puzzle not found" }, { status: 404 })
    }
    return NextResponse.json({ puzzle })
  }

  const puzzles = Array.from(store.puzzles.values()).map((p) => ({
    date: p.date,
    theme: p.theme,
    themeDisplayTitle: p.themeDisplayTitle,
    status: p.status,
  }))
  puzzles.sort((a, b) => a.date.localeCompare(b.date))
  return NextResponse.json({ puzzles })
}
