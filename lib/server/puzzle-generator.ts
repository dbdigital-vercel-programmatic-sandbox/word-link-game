import { Cell, Puzzle, PuzzleWord } from "@/lib/types"

const SIZE = 9

function key(c: Cell) {
  return `${c.row},${c.col}`
}

function sanitizeWord(w: string) {
  return w.toUpperCase().replace(/[^A-Z]/g, "")
}

function buildWords(theme: string) {
  const root = sanitizeWord(theme)
  const fallback = [
    "ORBITS",
    "PLANETS",
    "COMETS",
    "ASTEROID",
    "GALAXY",
    "NEBULA",
    "ROCKET",
    "SATELLITE",
    "TELESCOPE",
    "COSMOS",
    "ECLIPSE",
  ]
  const themeWords = [root, ...fallback]
    .map(sanitizeWord)
    .filter((w) => w.length >= 4)
  const unique = [...new Set(themeWords)]

  const chosen: string[] = []
  for (const w of unique) {
    if (chosen.length >= 10) {
      break
    }
    chosen.push(w)
  }

  while (chosen.length < 8) {
    chosen.push(
      (root + "STAR").slice(0, Math.max(4, Math.min(10, root.length + 2)))
    )
  }

  chosen.sort((a, b) => b.length - a.length)
  const spangram = chosen[0]
  const rest = chosen.slice(1, 8)

  let total = spangram.length + rest.reduce((acc, w) => acc + w.length, 0)
  const out = [spangram, ...rest]

  while (total < 81 && out.length < 10) {
    const remaining = 81 - total
    const len = Math.max(4, Math.min(12, remaining))
    const filler = (root + "PUZZLEGRIDGAMEWORD").slice(0, len)
    out.push(filler)
    total += filler.length
  }

  if (total > 81) {
    const last = out[out.length - 1]
    const delta = total - 81
    const nextLen = last.length - delta
    if (nextLen >= 4) {
      out[out.length - 1] = last.slice(0, nextLen)
      total = 81
    }
  }

  if (total !== 81 || out.length < 6 || out.length > 10) {
    return null
  }

  return out
}

function buildSnakePath() {
  const cells: Cell[] = []

  for (let col = 0; col < SIZE; col++) {
    if (col % 2 === 0) {
      for (let row = 0; row < SIZE; row++) {
        cells.push({ row, col })
      }
      continue
    }

    for (let row = SIZE - 1; row >= 0; row--) {
      cells.push({ row, col })
    }
  }

  return cells
}

function validate(words: PuzzleWord[]) {
  const cells = new Set<string>()
  for (const w of words) {
    if (w.word.length !== w.path.length) {
      return false
    }
    const usedInWord = new Set<string>()
    for (let i = 0; i < w.path.length; i++) {
      const c = w.path[i]
      const k = key(c)
      if (usedInWord.has(k)) {
        return false
      }
      usedInWord.add(k)
      if (cells.has(k)) {
        return false
      }
      cells.add(k)
      if (i > 0) {
        const p = w.path[i - 1]
        const dr = Math.abs(c.row - p.row)
        const dc = Math.abs(c.col - p.col)
        if (dr > 1 || dc > 1 || (dr === 0 && dc === 0)) {
          return false
        }
      }
    }
  }

  if (cells.size !== 81) {
    return false
  }

  const sp = words.find((w) => w.isSpangram)
  if (!sp) {
    return false
  }
  const rows = new Set(sp.path.map((p) => p.row))
  const cols = new Set(sp.path.map((p) => p.col))
  return (rows.has(0) && rows.has(8)) || (cols.has(0) && cols.has(8))
}

export function generatePuzzle(theme: string, date: string): Puzzle {
  const words = buildWords(theme)
  if (!words) {
    throw new Error(
      "Could not generate a valid puzzle for this theme. Try a different theme or fewer words."
    )
  }

  const path = buildSnakePath()
  let cursor = 0
  const placed: PuzzleWord[] = words.map((word, index) => {
    const wordPath = path.slice(cursor, cursor + word.length)
    cursor += word.length
    return {
      word,
      isSpangram: index === 0,
      path: wordPath,
    }
  })

  if (cursor !== SIZE * SIZE || !validate(placed)) {
    throw new Error(
      "Could not generate a valid puzzle for this theme. Try a different theme or fewer words."
    )
  }

  const grid = Array.from({ length: SIZE }, () =>
    Array.from({ length: SIZE }, () => "")
  )
  for (const w of placed) {
    for (let i = 0; i < w.path.length; i++) {
      const c = w.path[i]
      grid[c.row][c.col] = w.word[i]
    }
  }

  return {
    date,
    theme,
    grid,
    words: placed,
    published: false,
    status: "Draft",
  }
}
