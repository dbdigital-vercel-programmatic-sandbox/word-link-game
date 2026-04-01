import { NextRequest, NextResponse } from "next/server"

import { generatePuzzle } from "@/lib/server/puzzle-generator"

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { theme: string; date?: string }
  if (!body.theme) {
    return NextResponse.json({ error: "Theme is required" }, { status: 400 })
  }

  try {
    const date = body.date ?? new Date().toISOString().slice(0, 10)
    const puzzle = generatePuzzle(body.theme, date)
    return NextResponse.json({ puzzle })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not generate a valid puzzle for this theme. Try a different theme or fewer words.",
      },
      { status: 422 }
    )
  }
}
