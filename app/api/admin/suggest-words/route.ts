import { NextRequest, NextResponse } from "next/server"

import { normalizeAndFilterWords } from "@/lib/admin/puzzle-workflow"
import { generateThemeWords } from "@/lib/admin/theme-word-generation"

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { theme?: string }
  const theme = body.theme?.trim()
  if (!theme) {
    return NextResponse.json({ error: "Theme is required" }, { status: 400 })
  }

  const generated = await generateThemeWords(theme, {
    useWebSearch: true,
    maxWords: 14,
  })

  return NextResponse.json({
    source: generated.source,
    words: normalizeAndFilterWords(generated.candidates.map((c) => c.word)),
    candidates: generated.candidates,
  })
}
