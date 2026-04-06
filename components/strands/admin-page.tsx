"use client"

import { useEffect, useMemo, useState } from "react"

import { Input } from "@/components/ui/input"
import {
  getSolutionOverlayData,
  normalizeAndFilterWords,
} from "@/lib/admin/puzzle-workflow"
import { Puzzle } from "@/lib/types"

import { AppShell, Card, PrimaryButton, SecondaryButton } from "./dls-ui"

type Scheduled = {
  date: string
  theme: string
  themeDisplayTitle: string
  status: string
}

export function AdminPage() {
  const [theme, setTheme] = useState("Solar System")
  const [themeDisplayTitle, setThemeDisplayTitle] = useState("सौर मंडल")
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [customWords, setCustomWords] = useState("")
  const [approvedWords, setApprovedWords] = useState<string[]>([])
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null)
  const [showSolution, setShowSolution] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState("")
  const [scheduled, setScheduled] = useState<Scheduled[]>([])
  const [editingDate, setEditingDate] = useState<string | null>(null)

  const parseWords = () =>
    normalizeAndFilterWords(
      customWords
        .split(/[\n,]+/)
        .map((w) => w.trim())
        .filter(Boolean)
    )

  const solutionOverlay = useMemo(() => {
    if (!puzzle) {
      return { segments: [], highlights: [] }
    }
    return getSolutionOverlayData({
      approvedWords: puzzle.words.map((w) => ({ word: w.word, path: w.path })),
    })
  }, [puzzle])

  const highlightByCell = useMemo(() => {
    const out = new Map<string, { word: string; step: number }>()
    for (const highlight of solutionOverlay.highlights) {
      const key = `${highlight.row},${highlight.col}`
      if (!out.has(key)) {
        out.set(key, { word: highlight.word, step: highlight.step })
      }
    }
    return out
  }, [solutionOverlay.highlights])

  const refreshScheduled = async () => {
    const data = await fetch("/api/admin/puzzles").then((r) => r.json())
    setScheduled(data.puzzles)
  }

  useEffect(() => {
    fetch("/api/admin/puzzles")
      .then((r) => r.json())
      .then((data) => setScheduled(data.puzzles))
  }, [])

  const getSuggestions = async () => {
    const data = await fetch("/api/admin/suggest-themes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: theme }),
    }).then((r) => r.json())
    setSuggestions(data.suggestions)
  }

  const suggestWords = async () => {
    setError("")
    const res = await fetch("/api/admin/suggest-words", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? "Could not suggest words")
      return
    }
    setCustomWords((data.words as string[]).join("\n"))
    setApprovedWords([])
  }

  const approveWords = () => {
    setError("")
    const words = parseWords()
    if (words.length < 8) {
      setError("Please provide at least 8 words to approve.")
      return
    }
    setApprovedWords(words)
  }

  const generate = async () => {
    setError("")
    setIsGenerating(true)
    const words = approvedWords.length ? approvedWords : parseWords()
    if (!words.length) {
      setError("Please approve words before generating the grid.")
      setIsGenerating(false)
      return
    }
    try {
      const res = await fetch("/api/admin/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theme,
          themeDisplayTitle,
          date,
          words: words.length ? words : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error)
        return
      }
      setPuzzle(data.puzzle)
      setApprovedWords(data.puzzle.words.map((w: { word: string }) => w.word))
      setShowSolution(false)
    } catch {
      setError("Could not generate puzzle")
    } finally {
      setIsGenerating(false)
    }
  }

  const publish = async () => {
    if (!puzzle) {
      return
    }
    const res = await fetch("/api/admin/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, puzzle, overwrite: Boolean(editingDate) }),
    })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error)
      return
    }
    setPuzzle(null)
    setEditingDate(null)
    await refreshScheduled()
  }

  const editPuzzle = async (targetDate: string) => {
    setError("")
    const res = await fetch(`/api/admin/puzzles?date=${targetDate}`)
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? "Could not load puzzle")
      return
    }
    const existing = data.puzzle as Puzzle
    setPuzzle(existing)
    setTheme(existing.theme)
    setThemeDisplayTitle(existing.themeDisplayTitle ?? existing.theme)
    setDate(existing.date)
    setEditingDate(existing.date)
    setCustomWords(existing.words.map((w) => w.word).join("\n"))
    setApprovedWords(existing.words.map((w) => w.word))
    setShowSolution(false)
  }

  const runSolarSystemDemo = async () => {
    setTheme("Solar System")
    setThemeDisplayTitle("सौर मंडल")
    setError("")
    const wordsRes = await fetch("/api/admin/suggest-words", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: "Solar System" }),
    })
    const wordsData = await wordsRes.json()
    if (!wordsRes.ok) {
      setError(wordsData.error ?? "Could not run demo flow")
      return
    }
    const demoWords = normalizeAndFilterWords(wordsData.words ?? []).slice(
      0,
      10
    )
    setCustomWords(demoWords.join("\n"))
    setApprovedWords(demoWords)

    const generateRes = await fetch("/api/admin/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        theme: "Solar System",
        themeDisplayTitle: "सौर मंडल",
        date,
        words: demoWords,
      }),
    })
    const generateData = await generateRes.json()
    if (!generateRes.ok) {
      setError(generateData.error ?? "Could not generate demo puzzle")
      return
    }
    setPuzzle(generateData.puzzle)
    setShowSolution(true)
  }

  return (
    <AppShell>
      <Card className="mb-4">
        <h1 className="text-2xl font-bold">Admin Panel</h1>
      </Card>

      <Card className="mb-4 space-y-3">
        <h2 className="text-xl font-semibold">Theme Input</h2>
        <Input
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          placeholder="Enter theme in English"
        />
        <Input
          value={themeDisplayTitle}
          onChange={(e) => setThemeDisplayTitle(e.target.value)}
          placeholder="Theme Display title in Hindi"
        />
        <div>
          <label className="mb-1 block text-sm font-semibold">
            Candidate Words (recommended 8 to 14)
          </label>
          <textarea
            value={customWords}
            onChange={(e) => setCustomWords(e.target.value)}
            placeholder="Enter one word per line or comma separated"
            rows={6}
            className="w-full rounded-md border border-black bg-white px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs">
            Review and edit suggested words, then click Approve Words before
            generating the 8x8 grid.
          </p>
        </div>
        <div className="grid gap-2 md:grid-cols-4">
          <SecondaryButton onClick={getSuggestions}>
            Suggest Themes
          </SecondaryButton>
          <SecondaryButton onClick={suggestWords}>
            Suggest Words
          </SecondaryButton>
          <SecondaryButton onClick={approveWords}>
            Approve Words
          </SecondaryButton>
          <PrimaryButton onClick={generate} disabled={isGenerating}>
            {isGenerating ? "Generating..." : "Generate Grid"}
          </PrimaryButton>
        </div>
        <button
          type="button"
          onClick={() => void runSolarSystemDemo()}
          className="text-sm font-semibold underline"
        >
          Run Solar System Demo Flow
        </button>
        {!!approvedWords.length && (
          <div>
            <p className="mb-2 text-sm font-semibold">
              Approved Words ({approvedWords.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {approvedWords.map((word) => (
                <button
                  type="button"
                  key={word}
                  className="rounded-full border border-black px-3 py-1 text-xs font-semibold"
                  onClick={() =>
                    setApprovedWords((prev) => prev.filter((w) => w !== word))
                  }
                  title="Remove approved word"
                >
                  {word} ×
                </button>
              ))}
            </div>
          </div>
        )}
        {!!suggestions.length && (
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                type="button"
                key={s}
                className={`rounded-full border px-3 py-1 text-sm ${s === theme ? "border-black bg-black text-white" : "border-black"}`}
                onClick={() => setTheme(s)}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </Card>

      {error && (
        <Card className="mb-4">
          <p className="font-semibold text-red-700">{error}</p>
        </Card>
      )}

      {puzzle && (
        <Card className="mb-4">
          <h2 className="mb-2 text-xl font-semibold">
            Preview: {puzzle.themeDisplayTitle || puzzle.theme}
          </h2>
          {editingDate && (
            <p className="mb-2 text-sm font-semibold">
              Editing existing puzzle for {editingDate}
            </p>
          )}
          <div className="relative mb-3">
            <div
              className="grid gap-1"
              style={{
                gridTemplateColumns: `repeat(${puzzle.grid[0]?.length ?? 8}, minmax(0, 1fr))`,
              }}
            >
              {puzzle.grid.flatMap((row, r) =>
                row.map((ch, c) => {
                  const highlight = highlightByCell.get(`${r},${c}`)
                  return (
                    <div
                      key={`${r}-${c}`}
                      className={`relative aspect-square rounded-md border border-black text-center text-sm leading-8 font-bold ${showSolution && highlight ? "bg-amber-200" : "bg-white"}`}
                    >
                      {ch}
                      {showSolution && highlight && (
                        <span className="absolute top-0 left-1 text-[10px] font-bold">
                          {highlight.step}
                        </span>
                      )}
                    </div>
                  )
                })
              )}
            </div>
            {showSolution && (
              <svg
                className="pointer-events-none absolute inset-0 h-full w-full"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                {solutionOverlay.segments.map((segment, index) => {
                  const cols = puzzle.grid[0]?.length ?? 8
                  const rows = puzzle.grid.length || 8
                  const x1 = ((segment.from.col + 0.5) / cols) * 100
                  const y1 = ((segment.from.row + 0.5) / rows) * 100
                  const x2 = ((segment.to.col + 0.5) / cols) * 100
                  const y2 = ((segment.to.row + 0.5) / rows) * 100
                  const hue = (index * 37) % 360
                  return (
                    <line
                      key={`${segment.word}-${segment.order}-${index}`}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={`hsl(${hue} 80% 42%)`}
                      strokeWidth={1.2}
                      strokeLinecap="round"
                    />
                  )
                })}
              </svg>
            )}
          </div>
          <div className="mb-3 flex flex-wrap gap-2">
            {puzzle.words.map((w) => (
              <span
                key={w.word}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${w.isSpangram ? "bg-orange-500 text-white" : "bg-black text-white"}`}
              >
                {w.word}
              </span>
            ))}
          </div>
          <p className="mb-2 text-sm font-semibold">
            Words in puzzle: {puzzle.words.length}
          </p>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-md border border-black px-3 py-1 text-sm font-semibold"
              onClick={() => setShowSolution((prev) => !prev)}
            >
              {showSolution ? "Hide Solution" : "Check Grid"}
            </button>
            <span className="text-xs">
              {puzzle.validation?.valid
                ? "Validation: passed"
                : `Validation: ${puzzle.validation?.errors?.[0] ?? "pending"}`}
            </span>
            {puzzle.metadata && (
              <span className="text-xs">
                attempts: {puzzle.metadata.attempts}, quality:{" "}
                {puzzle.metadata.qualityScore}
              </span>
            )}
          </div>
          <div className="mb-2">
            <label className="mb-1 block text-sm font-semibold">
              Publish Date
            </label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <SecondaryButton onClick={generate}>Regenerate</SecondaryButton>
            <PrimaryButton onClick={publish}>Publish</PrimaryButton>
          </div>
        </Card>
      )}

      <Card>
        <h2 className="mb-2 text-xl font-semibold">Scheduled Puzzles</h2>
        <div className="space-y-1 text-sm">
          {scheduled.map((p) => (
            <div
              key={`${p.date}-${p.theme}`}
              className="grid grid-cols-[1fr_1fr_auto_auto] items-center gap-2 rounded-md bg-white px-2 py-2"
            >
              <span>{p.date}</span>
              <span>{p.themeDisplayTitle || p.theme}</span>
              <span>{p.status}</span>
              <SecondaryButton onClick={() => void editPuzzle(p.date)}>
                Edit
              </SecondaryButton>
            </div>
          ))}
        </div>
      </Card>
    </AppShell>
  )
}
