import { NextRequest, NextResponse } from "next/server"

import { getThemeWordSuggestions } from "@/lib/server/theme-words"

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { theme?: string }
  const theme = body.theme?.trim()
  if (!theme) {
    return NextResponse.json({ error: "Theme is required" }, { status: 400 })
  }

  return NextResponse.json({
    words: getThemeWordSuggestions(theme, 16),
  })
}
