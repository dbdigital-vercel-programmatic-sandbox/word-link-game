import { NextRequest, NextResponse } from "next/server"

import { getTodayPuzzle, validateTrace } from "@/lib/server/puzzle-service"
import { Cell } from "@/lib/types"

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { userId: string; path: Cell[] }
  if (!body.userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 })
  }

  const puzzle = getTodayPuzzle()
  return NextResponse.json(validateTrace(puzzle, body.path))
}
