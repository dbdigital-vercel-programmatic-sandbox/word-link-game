"use client"

import { useEffect, useState } from "react"

import { Input } from "@/components/ui/input"
import { Puzzle } from "@/lib/types"

import { AppShell, Card, PrimaryButton, SecondaryButton } from "./dls-ui"

type Scheduled = { date: string; theme: string; status: string }

export function AdminPage() {
  const [theme, setTheme] = useState("Solar System")
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [customWords, setCustomWords] = useState("")
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null)
  const [error, setError] = useState("")
  const [scheduled, setScheduled] = useState<Scheduled[]>([])
  const [editingDate, setEditingDate] = useState<string | null>(null)

  const parseWords = () =>
    customWords
      .split(/[\n,]+/)
      .map((w) => w.trim())
      .filter(Boolean)

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
  }

  const generate = async () => {
    setError("")
    const words = parseWords()
    const res = await fetch("/api/admin/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        theme,
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
    setDate(existing.date)
    setEditingDate(existing.date)
    setCustomWords(existing.words.map((w) => w.word).join("\n"))
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
          placeholder="Enter theme"
        />
        <div>
          <label className="mb-1 block text-sm font-semibold">
            Custom Words (10 to 20 words)
          </label>
          <textarea
            value={customWords}
            onChange={(e) => setCustomWords(e.target.value)}
            placeholder="Enter one word per line or comma separated"
            rows={6}
            className="w-full rounded-md border border-black bg-white px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs">
            Optional. If provided, longest word becomes the spangram and the
            system picks a subset that exactly fills 8x8.
          </p>
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          <SecondaryButton onClick={getSuggestions}>
            Suggest Themes
          </SecondaryButton>
          <SecondaryButton onClick={suggestWords}>
            Suggest Words
          </SecondaryButton>
          <PrimaryButton onClick={generate}>Generate Puzzle</PrimaryButton>
        </div>
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
            Preview: {puzzle.theme}
          </h2>
          {editingDate && (
            <p className="mb-2 text-sm font-semibold">
              Editing existing puzzle for {editingDate}
            </p>
          )}
          <div
            className="mb-3 grid gap-1"
            style={{
              gridTemplateColumns: `repeat(${puzzle.grid[0]?.length ?? 8}, minmax(0, 1fr))`,
            }}
          >
            {puzzle.grid.flatMap((row, r) =>
              row.map((ch, c) => (
                <div
                  key={`${r}-${c}`}
                  className="aspect-square rounded-md border border-black bg-white text-center text-sm leading-8 font-bold"
                >
                  {ch}
                </div>
              ))
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
              <span>{p.theme}</span>
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
