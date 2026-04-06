import { Cell, Puzzle, PuzzleWord } from "@/lib/types"
import {
  getThemeWordSuggestions,
  makeThemeWordOfLength,
} from "@/lib/server/theme-words"

const SIZE = 8
const GRID_CELLS = SIZE * SIZE
const MIN_WORD_LENGTH = 4
const GRID_LABEL = `${SIZE}x${SIZE}`

function key(c: Cell) {
  return `${c.row},${c.col}`
}

function sanitizeWord(w: string) {
  return w.toUpperCase().replace(/[^A-Z]/g, "")
}

function hasUniqueWords(words: string[]) {
  return new Set(words).size === words.length
}

function chooseSubsetByLength(args: {
  words: string[]
  target: number
  minWords: number
  maxWords: number
}) {
  const { words, target, minWords, maxWords } = args
  const memo = new Map<string, string[] | null>()

  function search(
    index: number,
    remaining: number,
    usedCount: number
  ): string[] | null {
    if (remaining === 0) {
      return usedCount >= minWords ? [] : null
    }
    if (remaining < 0 || index >= words.length || usedCount > maxWords) {
      return null
    }
    if (usedCount + (words.length - index) < minWords) {
      return null
    }

    const memoKey = `${index}|${remaining}|${usedCount}`
    if (memo.has(memoKey)) {
      return memo.get(memoKey) ?? null
    }

    const current = words[index]
    if (remaining >= current.length && usedCount + 1 <= maxWords) {
      const withCurrent = search(
        index + 1,
        remaining - current.length,
        usedCount + 1
      )
      if (withCurrent) {
        const out = [current, ...withCurrent]
        memo.set(memoKey, out)
        return out
      }
    }

    const withoutCurrent = search(index + 1, remaining, usedCount)
    memo.set(memoKey, withoutCurrent)
    return withoutCurrent
  }

  return search(0, target, 0)
}

function findClosestSubsetByLength(args: {
  words: string[]
  target: number
  minWords: number
  maxWords: number
}) {
  const { words, target, minWords, maxWords } = args
  const states = new Map<string, string[]>()
  states.set("0|0", [])

  for (const word of words) {
    const entries = Array.from(states.entries())
    for (const [stateKey, subset] of entries) {
      const [countRaw, sumRaw] = stateKey.split("|")
      const count = Number(countRaw)
      const sum = Number(sumRaw)
      if (count + 1 > maxWords) {
        continue
      }
      const nextSum = sum + word.length
      if (nextSum > GRID_CELLS) {
        continue
      }
      const nextKey = `${count + 1}|${nextSum}`
      if (!states.has(nextKey)) {
        states.set(nextKey, [...subset, word])
      }
    }
  }

  let best: string[] | null = null
  let bestSum = -1

  for (const [stateKey, subset] of states) {
    const [countRaw, sumRaw] = stateKey.split("|")
    const count = Number(countRaw)
    const sum = Number(sumRaw)
    if (count < minWords || count > maxWords) {
      continue
    }

    if (!best) {
      best = subset
      bestSum = sum
      continue
    }

    const bestDiff = Math.abs(bestSum - target)
    const nextDiff = Math.abs(sum - target)
    if (
      nextDiff < bestDiff ||
      (nextDiff === bestDiff && sum > bestSum) ||
      (nextDiff === bestDiff && sum === bestSum && subset.length > best.length)
    ) {
      best = subset
      bestSum = sum
    }
  }

  return { subset: best, sum: bestSum }
}

function buildLengthFixMessage(args: {
  theme: string
  spangram: string
  target: number
  bestSubset: string[]
  bestSum: number
  allWords: string[]
}) {
  const { theme, spangram, target, bestSubset, bestSum, allWords } = args
  const diff = target - bestSum
  const used = new Set(allWords)
  const direction = diff > 0 ? "longer" : "shorter"

  const single = bestSubset.find((w) => w.length + diff >= MIN_WORD_LENGTH)
  if (single) {
    const replacementLength = single.length + diff
    const replacement = makeThemeWordOfLength(theme, replacementLength, used)
    return `Could not fit these words exactly into ${GRID_LABEL}. Keep \"${spangram}\" as spangram. Remove \"${single}\" and replace it with \"${replacement}\" (${replacementLength} letters, ${direction}).`
  }

  for (let i = 0; i < bestSubset.length; i++) {
    for (let j = i + 1; j < bestSubset.length; j++) {
      const replacementLength =
        bestSubset[i].length + bestSubset[j].length + diff
      if (replacementLength < MIN_WORD_LENGTH) {
        continue
      }
      const replacement = makeThemeWordOfLength(theme, replacementLength, used)
      return `Could not fit these words exactly into ${GRID_LABEL}. Keep \"${spangram}\" as spangram. Remove \"${bestSubset[i]}\" and \"${bestSubset[j]}\", then replace both with \"${replacement}\" (${replacementLength} letters).`
    }
  }

  const replacement = makeThemeWordOfLength(
    theme,
    Math.max(MIN_WORD_LENGTH, diff),
    used
  )
  return `Could not fit these words exactly into ${GRID_LABEL}. Keep \"${spangram}\" as spangram. Add one ${Math.abs(diff)}-letter adjustment word, for example \"${replacement}\", and try again.`
}

function buildCustomWords(theme: string, rawWords: string[]) {
  const unique = [...new Set(rawWords.map(sanitizeWord))].filter(
    (w) => w.length >= MIN_WORD_LENGTH
  )

  if (unique.length < 10 || unique.length > 20) {
    throw new Error(
      "Please provide 10 to 20 unique words with at least 4 letters each."
    )
  }

  const sorted = [...unique].sort((a, b) => b.length - a.length)
  const spangram = sorted[0]

  if (spangram.length >= GRID_CELLS) {
    throw new Error(`The longest word is too long for a ${GRID_LABEL} grid.`)
  }

  const target = GRID_CELLS - spangram.length
  const rest = sorted.slice(1)
  const picked = chooseSubsetByLength({
    words: rest,
    target,
    minWords: 5,
    maxWords: 19,
  })

  if (!picked) {
    const closest = findClosestSubsetByLength({
      words: rest,
      target,
      minWords: 5,
      maxWords: 19,
    })
    if (!closest.subset) {
      throw new Error(
        `These word lengths cannot fill a ${GRID_LABEL} grid exactly. Keep \"${spangram}\" as spangram and add more words with mixed lengths.`
      )
    }

    throw new Error(
      buildLengthFixMessage({
        theme,
        spangram,
        target,
        bestSubset: closest.subset,
        bestSum: closest.sum,
        allWords: unique,
      })
    )
  }

  const out = [spangram, ...picked]
  if (!hasUniqueWords(out)) {
    throw new Error("Each word in the puzzle must be unique.")
  }

  return out
}

function buildAutoWords(theme: string) {
  const root = sanitizeWord(theme)
  const suggested = getThemeWordSuggestions(theme, 24)
    .map(sanitizeWord)
    .filter((w) => w.length >= MIN_WORD_LENGTH)

  const pool = [...new Set([root, ...suggested].filter(Boolean))]
  const used = new Set(pool)
  let fillerLength = MIN_WORD_LENGTH

  while (pool.length < 30) {
    const filler = makeThemeWordOfLength(theme, fillerLength, used)
    if (!used.has(filler)) {
      pool.push(filler)
      used.add(filler)
    }
    fillerLength += 1
    if (fillerLength > 12) {
      fillerLength = MIN_WORD_LENGTH
    }
  }

  const sorted = [...pool].sort((a, b) => b.length - a.length)
  const spangram = sorted[0]
  if (!spangram || spangram.length >= GRID_CELLS) {
    return null
  }

  const target = GRID_CELLS - spangram.length
  const rest = sorted.slice(1)
  const picked = chooseSubsetByLength({
    words: rest,
    target,
    minWords: 4,
    maxWords: 19,
  })
  if (!picked) {
    return null
  }

  const out = [spangram, ...picked]
  if (!hasUniqueWords(out)) {
    return null
  }

  return out
}

const DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
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

function countUnvisitedNeighbors(cell: Cell, visited: Set<string>) {
  let count = 0
  for (const [dr, dc] of DIRECTIONS) {
    const row = cell.row + dr
    const col = cell.col + dc
    if (!inBounds(row, col)) {
      continue
    }
    if (!visited.has(`${row},${col}`)) {
      count += 1
    }
  }
  return count
}

function hasDirectionMix(path: Cell[]) {
  let horizontal = 0
  let vertical = 0
  let diagonal = 0

  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]
    const b = path[i]
    const dr = Math.abs(a.row - b.row)
    const dc = Math.abs(a.col - b.col)

    if (dr === 0) {
      horizontal += 1
    } else if (dc === 0) {
      vertical += 1
    } else {
      diagonal += 1
    }
  }

  const total = horizontal + vertical + diagonal
  if (total === 0 || !horizontal || !vertical || !diagonal) {
    return false
  }

  const maxShare = Math.max(horizontal, vertical, diagonal) / total
  return maxShare <= 0.6
}

function buildJumbledPath() {
  const walk = (path: Cell[], visited: Set<string>): boolean => {
    if (path.length === GRID_CELLS) {
      return true
    }

    const current = path[path.length - 1]
    const neighbors: Cell[] = []

    for (const [dr, dc] of DIRECTIONS) {
      const row = current.row + dr
      const col = current.col + dc
      if (!inBounds(row, col)) {
        continue
      }
      const next = { row, col }
      if (visited.has(key(next))) {
        continue
      }
      neighbors.push(next)
    }

    neighbors.sort((a, b) => {
      const diff =
        countUnvisitedNeighbors(a, visited) -
        countUnvisitedNeighbors(b, visited)
      if (diff !== 0) {
        return diff
      }
      return Math.random() - 0.5
    })

    for (const next of neighbors) {
      const k = key(next)
      visited.add(k)
      path.push(next)
      if (walk(path, visited)) {
        return true
      }
      path.pop()
      visited.delete(k)
    }

    return false
  }

  let fallbackPath: Cell[] | null = null

  for (let attempt = 0; attempt < 120; attempt++) {
    const start = {
      row: Math.floor(Math.random() * SIZE),
      col: Math.floor(Math.random() * SIZE),
    }
    const path: Cell[] = [start]
    const visited = new Set<string>([key(start)])

    if (!walk(path, visited)) {
      continue
    }

    if (!fallbackPath) {
      fallbackPath = [...path]
    }
    if (hasDirectionMix(path)) {
      return path
    }
  }

  if (fallbackPath) {
    return fallbackPath
  }

  throw new Error(
    "Could not generate a valid puzzle for this theme. Try a different theme or fewer words."
  )
}

function validate(words: PuzzleWord[]) {
  const cells = new Set<string>()
  const usedWords = new Set<string>()
  for (const w of words) {
    if (usedWords.has(w.word)) {
      return false
    }
    usedWords.add(w.word)
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

  if (cells.size !== GRID_CELLS) {
    return false
  }

  const sp = words.find((w) => w.isSpangram)
  return Boolean(sp)
}

function countWordPaths(grid: string[][], word: string, maxCount = 2) {
  if (!word.length) {
    return 0
  }

  const rows = grid.length
  const cols = grid[0]?.length ?? 0
  let count = 0

  const walk = (
    row: number,
    col: number,
    index: number,
    visited: Set<string>
  ) => {
    if (count >= maxCount) {
      return
    }
    if (grid[row][col] !== word[index]) {
      return
    }
    if (index === word.length - 1) {
      count += 1
      return
    }

    const here = `${row},${col}`
    visited.add(here)

    for (const [dr, dc] of DIRECTIONS) {
      const nr = row + dr
      const nc = col + dc
      const nextKey = `${nr},${nc}`
      if (!inBounds(nr, nc) || visited.has(nextKey)) {
        continue
      }
      if (grid[nr][nc] !== word[index + 1]) {
        continue
      }
      walk(nr, nc, index + 1, visited)
      if (count >= maxCount) {
        break
      }
    }

    visited.delete(here)
  }

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (grid[row][col] !== word[0]) {
        continue
      }
      walk(row, col, 0, new Set<string>())
      if (count >= maxCount) {
        return count
      }
    }
  }

  return count
}

function hasUniqueAnswerTraces(grid: string[][], words: PuzzleWord[]) {
  for (const w of words) {
    if (countWordPaths(grid, w.word, 2) !== 1) {
      return false
    }
  }
  return true
}

export function generatePuzzle(
  theme: string,
  date: string,
  options?: { candidateWords?: string[] }
): Puzzle {
  const words = options?.candidateWords?.length
    ? buildCustomWords(theme, options.candidateWords)
    : buildAutoWords(theme)
  if (!words) {
    throw new Error(
      "Could not generate a valid puzzle for this theme. Try a different theme or fewer words."
    )
  }

  for (let attempt = 0; attempt < 180; attempt += 1) {
    const path = buildJumbledPath()
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

    if (cursor !== GRID_CELLS || !validate(placed)) {
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

    if (!hasUniqueAnswerTraces(grid, placed)) {
      continue
    }

    return {
      date,
      theme,
      themeDisplayTitle: theme,
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
