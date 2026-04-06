import { NextRequest, NextResponse } from "next/server"

import {
  generateGridFromApprovedWords,
  normalizeAndFilterWords,
  toPuzzleWords,
  validateGeneratedGrid,
} from "@/lib/admin/puzzle-workflow"
import { generateThemeWords } from "@/lib/admin/theme-word-generation"

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    theme: string
    themeDisplayTitle?: string
    date?: string
    words?: string[]
  }
  if (!body.theme) {
    return NextResponse.json({ error: "Theme is required" }, { status: 400 })
  }

  try {
    const date = body.date ?? new Date().toISOString().slice(0, 10)
    const themeDisplayTitle = body.themeDisplayTitle?.trim() || body.theme
    const generatedThemeWords = body.words?.length
      ? null
      : await generateThemeWords(body.theme, {
          useWebSearch: true,
          maxWords: 16,
        })

    const approvedWords = normalizeAndFilterWords(
      body.words?.length
        ? body.words
        : (generatedThemeWords?.candidates ?? []).map((entry) => entry.word)
    )
    const generated = generateGridFromApprovedWords(approvedWords, {
      theme: body.theme,
      seed: `${date}-${body.theme}`,
    })
    const validation = validateGeneratedGrid(generated)

    const puzzle = {
      date,
      theme: body.theme,
      themeDisplayTitle,
      grid: generated.grid,
      words: toPuzzleWords(generated.approvedWords),
      published: false,
      status: "Draft" as const,
      adminStatus: validation.valid ? "validated" : "generated",
      metadata: generated.metadata,
      validation,
    }
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
