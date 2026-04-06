import { NextRequest, NextResponse } from "next/server"

import { store } from "@/lib/server/store"
import { Puzzle } from "@/lib/types"

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    date: string
    puzzle: Puzzle
    overwrite?: boolean
  }
  if (!body.date || !body.puzzle) {
    return NextResponse.json(
      { error: "date and puzzle are required" },
      { status: 400 }
    )
  }
  if (store.puzzles.has(body.date) && !body.overwrite) {
    return NextResponse.json(
      { error: "Puzzle for this date already exists" },
      { status: 409 }
    )
  }

  body.puzzle.date = body.date
  body.puzzle.themeDisplayTitle =
    body.puzzle.themeDisplayTitle?.trim() || body.puzzle.theme
  body.puzzle.published = true
  body.puzzle.status = "Published"
  store.puzzles.set(body.date, body.puzzle)
  return NextResponse.json({ success: true })
}
