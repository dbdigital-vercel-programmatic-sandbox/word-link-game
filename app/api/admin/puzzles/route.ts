import { NextResponse } from "next/server"

import { store } from "@/lib/server/store"

export async function GET() {
  const puzzles = Array.from(store.puzzles.values()).map((p) => ({
    date: p.date,
    theme: p.theme,
    status: p.status,
  }))
  puzzles.sort((a, b) => a.date.localeCompare(b.date))
  return NextResponse.json({ puzzles })
}
