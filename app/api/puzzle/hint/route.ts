import { NextRequest, NextResponse } from "next/server"

import { getHintWord, getTodayPuzzle } from "@/lib/server/puzzle-service"

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    userId?: string
    foundWords?: string[]
    hintedWords?: string[]
  }

  if (!body.userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 })
  }

  const puzzle = getTodayPuzzle()
  const hint = getHintWord({
    puzzle,
    foundWords: body.foundWords ?? [],
    hintedWords: body.hintedWords ?? [],
  })

  if (!hint) {
    return NextResponse.json({ error: "No hints remaining" }, { status: 404 })
  }

  return NextResponse.json({ word: hint.word, path: hint.path })
}
