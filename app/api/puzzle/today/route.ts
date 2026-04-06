import { NextResponse } from "next/server"

import { getTodayPuzzle } from "@/lib/server/puzzle-service"

export async function GET() {
  const puzzle = getTodayPuzzle()
  if (!puzzle.published) {
    return NextResponse.json({ empty: true, message: "Come back soon" })
  }

  return NextResponse.json({
    date: puzzle.date,
    theme: puzzle.theme,
    themeDisplayTitle: puzzle.themeDisplayTitle,
    grid: puzzle.grid,
    wordsCount: puzzle.words.length,
  })
}
