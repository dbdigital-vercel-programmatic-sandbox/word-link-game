import { Cell, Puzzle, PuzzleWord } from "@/lib/types"

const SIZE = 9
const DIRS: Array<[number, number]> = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
]

function inBounds(row: number, col: number) {
  return row >= 0 && row < SIZE && col >= 0 && col < SIZE
}

function key(c: Cell) {
  return `${c.row},${c.col}`
}

function neighbors(c: Cell, blocked: Set<string>) {
  const out: Cell[] = []
  for (const [dr, dc] of DIRS) {
    const nr = c.row + dr
    const nc = c.col + dc
    if (inBounds(nr, nc) && !blocked.has(`${nr},${nc}`)) {
      out.push({ row: nr, col: nc })
    }
  }
  return out.sort(() => Math.random() - 0.5)
}

function findPath(
  length: number,
  blocked: Set<string>,
  mustSpan?: "vertical" | "horizontal"
) {
  const starts: Cell[] = []
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (!blocked.has(`${r},${c}`)) {
        starts.push({ row: r, col: c })
      }
    }
  }
  starts.sort(() => Math.random() - 0.5)

  const dfs = (path: Cell[], used: Set<string>): Cell[] | null => {
    if (path.length === length) {
      if (!mustSpan) {
        return path
      }
      const rows = new Set(path.map((p) => p.row))
      const cols = new Set(path.map((p) => p.col))
      const ok =
        mustSpan === "vertical"
          ? rows.has(0) && rows.has(SIZE - 1)
          : cols.has(0) && cols.has(SIZE - 1)
      return ok ? path : null
    }

    const current = path[path.length - 1]
    const nexts = neighbors(current, blocked).filter((n) => !used.has(key(n)))
    for (const nxt of nexts) {
      used.add(key(nxt))
      path.push(nxt)
      const found = dfs(path, used)
      if (found) {
        return found
      }
      path.pop()
      used.delete(key(nxt))
    }
    return null
  }

  for (const s of starts) {
    const used = new Set<string>([key(s)])
    const found = dfs([s], used)
    if (found) {
      return found
    }
  }

  return null
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
  for (let attempt = 0; attempt < 50; attempt++) {
    const words = buildWords(theme)
    if (!words) {
      continue
    }

    const blocked = new Set<string>()
    const placed: PuzzleWord[] = []
    const axis = Math.random() > 0.5 ? "vertical" : "horizontal"

    const spangramWord = words[0]
    const spPath = findPath(spangramWord.length, blocked, axis)
    if (!spPath) {
      continue
    }
    for (const c of spPath) {
      blocked.add(key(c))
    }
    placed.push({ word: spangramWord, isSpangram: true, path: spPath })

    let fail = false
    for (let i = 1; i < words.length; i++) {
      const w = words[i]
      const p = findPath(w.length, blocked)
      if (!p) {
        fail = true
        break
      }
      for (const c of p) {
        blocked.add(key(c))
      }
      placed.push({ word: w, isSpangram: false, path: p })
    }

    if (fail || blocked.size !== 81 || !validate(placed)) {
      continue
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

  throw new Error(
    "Could not generate a valid puzzle for this theme. Try a different theme or fewer words."
  )
}
