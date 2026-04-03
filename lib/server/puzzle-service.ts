import { computeStreak } from "@/lib/server/streak"
import { ymdFromOffset, todayUtcYmd } from "@/lib/server/date"
import { generatePuzzle } from "@/lib/server/puzzle-generator"
import { store } from "@/lib/server/store"
import { isRecognizedBonusWord } from "@/lib/server/word-check"
import { Cell, CompletionEntry, Puzzle } from "@/lib/types"
import { isValidPath } from "@/lib/game"

export function ensureTodayPuzzle(theme = "Solar System") {
  const date = todayUtcYmd()
  const existing = store.puzzles.get(date)
  if (existing) {
    return existing
  }
  const puzzle = generatePuzzle(theme, date)
  puzzle.published = true
  puzzle.status = "Published"
  store.puzzles.set(date, puzzle)
  return puzzle
}

export function getPuzzleForDate(date: string) {
  return store.puzzles.get(date)
}

export function getTodayPuzzle() {
  return ensureTodayPuzzle()
}

function samePath(a: Cell[], b: Cell[]) {
  if (a.length !== b.length) {
    return false
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i].row !== b[i].row || a[i].col !== b[i].col) {
      return false
    }
  }
  return true
}

export function validateTrace(puzzle: Puzzle, path: Cell[]) {
  if (!path.length || !isValidPath(path)) {
    return { valid: false, kind: "invalid" as const }
  }

  for (const c of path) {
    if (
      c.row < 0 ||
      c.row >= puzzle.grid.length ||
      c.col < 0 ||
      c.col >= (puzzle.grid[c.row]?.length ?? 0)
    ) {
      return { valid: false, kind: "invalid" as const }
    }
  }

  for (const w of puzzle.words) {
    if (samePath(w.path, path) || samePath([...w.path].reverse(), path)) {
      return {
        valid: true,
        kind: "answer" as const,
        word: w.word,
        isSpangram: w.isSpangram,
      }
    }
  }

  const tracedWord = path.map((c) => puzzle.grid[c.row][c.col]).join("")
  if (isRecognizedBonusWord(puzzle, tracedWord)) {
    return {
      valid: false,
      kind: "bonus" as const,
      word: tracedWord,
    }
  }

  return { valid: false, kind: "invalid" as const }
}

export function getHintWord(args: {
  puzzle: Puzzle
  foundWords: string[]
  hintedWords: string[]
}) {
  const blocked = new Set(
    [...args.foundWords, ...args.hintedWords].map((w) => w.toUpperCase())
  )

  const nonSpangram = args.puzzle.words.find(
    (w) => !w.isSpangram && !blocked.has(w.word.toUpperCase())
  )
  if (nonSpangram) {
    return nonSpangram
  }

  return (
    args.puzzle.words.find((w) => !blocked.has(w.word.toUpperCase())) ?? null
  )
}

export function completePuzzle(args: {
  userId: string
  completionTimeSeconds: number
  timezoneOffsetMinutes?: number
}) {
  const user = store.users.get(args.userId)
  if (!user) {
    throw new Error("USER_NOT_FOUND")
  }

  const nowIso = new Date().toISOString()
  const date = todayUtcYmd()
  const localDate = ymdFromOffset(nowIso, args.timezoneOffsetMinutes ?? 0)

  const existing = store.completions.find(
    (c) => c.userId === args.userId && c.puzzleDate === date
  )
  if (!existing) {
    const entry: CompletionEntry = {
      userId: args.userId,
      displayName: user.displayName,
      puzzleDate: date,
      completionTimeSeconds: args.completionTimeSeconds,
      streakCount: user.currentStreak,
      submittedAt: nowIso,
    }
    store.completions.push(entry)
  }

  if (!user.completedDates.includes(localDate)) {
    user.completedDates.push(localDate)
  }
  const streak = computeStreak(user.completedDates)
  user.completedDates = streak.completedDates
  user.currentStreak = streak.currentStreak
  user.longestStreak = streak.longestStreak

  for (const c of store.completions) {
    if (c.userId === args.userId && c.puzzleDate === date) {
      c.displayName = user.displayName
      c.streakCount = user.currentStreak
      c.completionTimeSeconds = Math.min(
        c.completionTimeSeconds,
        args.completionTimeSeconds
      )
    }
  }

  const ranked = store.completions
    .filter((c) => c.puzzleDate === date)
    .sort((a, b) =>
      a.completionTimeSeconds === b.completionTimeSeconds
        ? a.submittedAt.localeCompare(b.submittedAt)
        : a.completionTimeSeconds - b.completionTimeSeconds
    )

  const rank = ranked.findIndex((r) => r.userId === args.userId) + 1
  return {
    rank,
    streak: user.currentStreak,
    completedDates: user.completedDates,
  }
}
