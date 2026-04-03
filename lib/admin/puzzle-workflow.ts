import { Cell, PuzzleWord } from "@/lib/types"

const GRID_SIZE = 8
const GRID_CELLS = GRID_SIZE * GRID_SIZE
const MIN_WORD_LENGTH = 4
const MAX_WORD_LENGTH = 10
const TARGET_WORDS_MIN = 8
const TARGET_WORDS_MAX = 14
const CORE_RATIO_MIN = 0.8

const DEBUG_PREFIX = "[admin-puzzle]"
const WEAK_FALLBACK_WORDS = new Set([
  "PLACE",
  "AREA",
  "THING",
  "GOOD",
  "WORLD",
  "TOPIC",
])

type ThemeBank = {
  id: string
  keys: string[]
  core: string[]
  secondary: string[]
}

const THEME_BANKS: ThemeBank[] = [
  {
    id: "SOLAR_SYSTEM",
    keys: ["SOLAR", "SYSTEM", "PLANET", "SPACE", "ASTRO", "GALAXY"],
    core: [
      "MERCURY",
      "VENUS",
      "EARTH",
      "MARS",
      "JUPITER",
      "SATURN",
      "URANUS",
      "NEPTUNE",
      "ORBIT",
      "ASTEROID",
      "COMET",
      "GALAXY",
      "GRAVITY",
      "ECLIPSE",
    ],
    secondary: ["NEBULA", "METEOR", "ROCKET", "COSMOS", "SATELLITE"],
  },
  {
    id: "NATIONAL_PARK",
    keys: ["NATIONAL", "PARK", "WILDERNESS", "RESERVE"],
    core: [
      "FOREST",
      "RANGER",
      "WILDLIFE",
      "TRAIL",
      "CANYON",
      "HIKING",
      "RIVER",
      "VALLEY",
      "CAMPING",
      "RESERVE",
      "BISON",
      "EAGLE",
      "GLACIER",
      "MEADOW",
    ],
    secondary: ["NATURE", "SAFARI", "PRAIRIE", "SUMMIT", "RIDGE"],
  },
  {
    id: "OCEAN",
    keys: ["OCEAN", "SEA", "MARINE", "REEF", "WATER"],
    core: [
      "CORAL",
      "REEF",
      "TIDAL",
      "CURRENT",
      "WHALE",
      "DOLPHIN",
      "SEAHORSE",
      "ANCHOR",
      "HARBOR",
      "KELP",
      "SURF",
      "LAGOON",
    ],
    secondary: ["COAST", "SEABED", "MARINA", "TURTLE"],
  },
  {
    id: "FOREST",
    keys: ["FOREST", "TREE", "WOOD", "JUNGLE"],
    core: [
      "FOREST",
      "CANOPY",
      "ROOTS",
      "CEDAR",
      "MAPLE",
      "PINE",
      "ACORN",
      "FERN",
      "MOSS",
      "BARK",
      "THICKET",
      "WILDLIFE",
    ],
    secondary: ["RANGER", "MEADOW", "BROOK", "GROVE"],
  },
  {
    id: "MUSIC",
    keys: ["MUSIC", "SONG", "BAND", "AUDIO"],
    core: [
      "RHYTHM",
      "MELODY",
      "CHORUS",
      "LYRIC",
      "TEMPO",
      "NOTES",
      "GUITAR",
      "DRUMS",
      "VOCAL",
      "HARMONY",
      "STUDIO",
      "MICROPHONE",
    ],
    secondary: ["PIANO", "VIOLIN", "RECORD", "AMPLIFIER"],
  },
]

const RELATED_TOKENS: Record<string, string[]> = {
  SOLAR: ["ORBIT", "GRAVITY", "ECLIPSE", "COMET"],
  PLANET: ["ORBIT", "ASTEROID", "GALAXY", "GRAVITY"],
  NATIONAL: ["RANGER", "WILDLIFE", "TRAIL", "RESERVE"],
  PARK: ["FOREST", "CANYON", "VALLEY", "GLACIER"],
  OCEAN: ["CORAL", "CURRENT", "HARBOR", "TIDAL"],
  FOREST: ["CANOPY", "ROOTS", "CEDAR", "ACORN"],
  MUSIC: ["MELODY", "RHYTHM", "CHORUS", "TEMPO"],
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

type PlacedWord = {
  word: string
  path: Cell[]
}

type PathSegment = {
  word: string
  index: number
  from: Cell
  to: Cell
}

export type GeneratedGridResult = {
  grid: string[][]
  approvedWords: PlacedWord[]
  status: "generated" | "validated"
  metadata: {
    gridSize: 8
    seed: string
    attempts: number
    qualityScore: number
  }
}

export type ValidationResult = {
  valid: boolean
  errors: string[]
}

type RelevanceResult = {
  filtered: string[]
  coreWords: Set<string>
  rejected: Array<{ word: string; reason: string }>
}

function debug(message: string, details?: Record<string, unknown>) {
  if (details) {
    console.info(`${DEBUG_PREFIX} ${message}`, details)
    return
  }
  console.info(`${DEBUG_PREFIX} ${message}`)
}

function cleanWord(word: string) {
  return word.toUpperCase().replace(/[^A-Z]/g, "")
}

function wordKey(cell: Cell) {
  return `${cell.row},${cell.col}`
}

function samePoint(a: Cell, b: Cell) {
  return a.row === b.row && a.col === b.col
}

function orientation(a: Cell, b: Cell, c: Cell) {
  const value =
    (b.col - a.col) * (c.row - b.row) - (b.row - a.row) * (c.col - b.col)
  if (value === 0) {
    return 0
  }
  return value > 0 ? 1 : 2
}

function onSegment(a: Cell, b: Cell, c: Cell) {
  return (
    b.col <= Math.max(a.col, c.col) &&
    b.col >= Math.min(a.col, c.col) &&
    b.row <= Math.max(a.row, c.row) &&
    b.row >= Math.min(a.row, c.row)
  )
}

export function getPathSegments(path: Cell[], word = ""): PathSegment[] {
  const segments: PathSegment[] = []
  for (let i = 1; i < path.length; i += 1) {
    segments.push({
      word,
      index: i - 1,
      from: path[i - 1],
      to: path[i],
    })
  }
  return segments
}

export function segmentsIntersect(a: PathSegment, b: PathSegment) {
  const p1 = a.from
  const q1 = a.to
  const p2 = b.from
  const q2 = b.to

  const o1 = orientation(p1, q1, p2)
  const o2 = orientation(p1, q1, q2)
  const o3 = orientation(p2, q2, p1)
  const o4 = orientation(p2, q2, q1)

  if (o1 !== o2 && o3 !== o4) {
    return true
  }

  if (o1 === 0 && onSegment(p1, p2, q1)) {
    return true
  }
  if (o2 === 0 && onSegment(p1, q2, q1)) {
    return true
  }
  if (o3 === 0 && onSegment(p2, p1, q2)) {
    return true
  }
  if (o4 === 0 && onSegment(p2, q1, q2)) {
    return true
  }

  return false
}

function sharedEndpointCount(a: PathSegment, b: PathSegment) {
  const pointsA = [a.from, a.to]
  const pointsB = [b.from, b.to]
  let shared = 0
  for (const pA of pointsA) {
    for (const pB of pointsB) {
      if (samePoint(pA, pB)) {
        shared += 1
      }
    }
  }
  return shared
}

export function isAllowedSharedEndpoint(a: PathSegment, b: PathSegment) {
  const shared = sharedEndpointCount(a, b)
  if (shared !== 1) {
    return false
  }
  if (a.word !== b.word) {
    return false
  }
  return Math.abs(a.index - b.index) === 1
}

function isDiagonal(segment: PathSegment) {
  return (
    Math.abs(segment.from.row - segment.to.row) === 1 &&
    Math.abs(segment.from.col - segment.to.col) === 1
  )
}

function segmentMidpoint(segment: PathSegment) {
  return {
    row: (segment.from.row + segment.to.row) / 2,
    col: (segment.from.col + segment.to.col) / 2,
  }
}

function diagonalClusterPenalty(segment: PathSegment, pool: PathSegment[]) {
  if (!isDiagonal(segment)) {
    return 0
  }
  const center = segmentMidpoint(segment)
  let nearbyDiagonals = 0
  for (const item of pool) {
    if (!isDiagonal(item)) {
      continue
    }
    const c = segmentMidpoint(item)
    const dist = Math.hypot(center.row - c.row, center.col - c.col)
    if (dist <= 1.1) {
      nearbyDiagonals += 1
    }
  }
  return nearbyDiagonals
}

function geometryPenalty(segments: PathSegment[]) {
  let penalty = 0
  for (let i = 0; i < segments.length; i += 1) {
    const diagDensity = diagonalClusterPenalty(
      segments[i],
      segments.slice(0, i)
    )
    if (diagDensity >= 2) {
      penalty += diagDensity * 0.2
    }
  }
  return penalty
}

function inBounds(row: number, col: number, size: number) {
  return row >= 0 && row < size && col >= 0 && col < size
}

function makeRng(seedText: string) {
  let seed = 2166136261
  for (let i = 0; i < seedText.length; i += 1) {
    seed ^= seedText.charCodeAt(i)
    seed = Math.imul(seed, 16777619)
  }

  return () => {
    seed += 0x6d2b79f5
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle<T>(items: T[], rng: () => number) {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function trimWordVariants(word: string) {
  const variants = new Set<string>()
  if (word.endsWith("ING") && word.length - 3 >= MIN_WORD_LENGTH) {
    variants.add(word.slice(0, -3))
  }
  if (word.endsWith("ED") && word.length - 2 >= MIN_WORD_LENGTH) {
    variants.add(word.slice(0, -2))
  }
  if (word.endsWith("ES") && word.length - 2 >= MIN_WORD_LENGTH) {
    variants.add(word.slice(0, -2))
  }
  if (word.endsWith("S") && word.length - 1 >= MIN_WORD_LENGTH) {
    variants.add(word.slice(0, -1))
  }
  return Array.from(variants)
}

function resolveThemeBank(theme: string): ThemeBank | null {
  const upper = theme.toUpperCase()
  return (
    THEME_BANKS.find((bank) => bank.keys.some((key) => upper.includes(key))) ??
    null
  )
}

function dynamicThemeBank(theme: string): ThemeBank {
  const parts = theme
    .toUpperCase()
    .split(/[^A-Z]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= MIN_WORD_LENGTH)

  const related = parts.flatMap((part) => RELATED_TOKENS[part] ?? [])
  const uniqueRelated = Array.from(new Set(related))
  return {
    id: "DYNAMIC",
    keys: parts,
    core: uniqueRelated,
    secondary: [],
  }
}

function normalizeAndDedupe(words: string[]) {
  const used = new Set<string>()
  const out: string[] = []
  for (const raw of words) {
    const clean = cleanWord(raw)
    if (
      !clean ||
      used.has(clean) ||
      clean.length < MIN_WORD_LENGTH ||
      clean.length > MAX_WORD_LENGTH
    ) {
      continue
    }
    used.add(clean)
    out.push(clean)
  }
  return out
}

export function normalizeAndFilterWords(words: string[]) {
  return normalizeAndDedupe(words)
}

export function filterWordsByThemeRelevance(
  words: string[],
  theme: string
): RelevanceResult {
  const bank = resolveThemeBank(theme) ?? dynamicThemeBank(theme)
  const core = new Set(bank.core.map(cleanWord))
  const secondary = new Set(bank.secondary.map(cleanWord))
  const normalized = normalizeAndDedupe(words)
  const filtered: string[] = []
  const rejected: Array<{ word: string; reason: string }> = []
  const hasStrictBank =
    bank.id !== "DYNAMIC" || core.size > 0 || secondary.size > 0

  const themeTokens = new Set(
    theme
      .toUpperCase()
      .split(/[^A-Z]+/)
      .map((part) => part.trim())
      .filter((part) => part.length >= 3)
  )

  for (const word of normalized) {
    if (!hasStrictBank) {
      if (themeTokens.has(word) || WEAK_FALLBACK_WORDS.has(word)) {
        rejected.push({ word, reason: "weak theme fallback" })
        continue
      }
      filtered.push(word)
      continue
    }

    if (core.has(word)) {
      filtered.push(word)
      continue
    }
    if (secondary.has(word)) {
      filtered.push(word)
      continue
    }
    rejected.push({ word, reason: "weak theme relevance" })
  }

  for (const entry of rejected) {
    debug("rejected word", entry)
  }

  return { filtered, coreWords: core, rejected }
}

export function generateCandidateWords(theme: string) {
  const bank = resolveThemeBank(theme) ?? dynamicThemeBank(theme)
  const combined = normalizeAndDedupe([...bank.core, ...bank.secondary])
  const picked = combined.slice(0, TARGET_WORDS_MAX)
  debug("candidate words generated", {
    theme,
    count: picked.length,
    themeBank: bank.id,
  })
  return picked
}

function chooseCoverageSubset(args: {
  words: string[]
  target: number
  minWords: number
  maxWords: number
  coreWords: Set<string>
  rng: () => number
}): string[] | null {
  const { words, target, minWords, maxWords, coreWords, rng } = args
  const shuffled = shuffle(words, rng).sort((a, b) => b.length - a.length)
  const memo = new Map<string, boolean>()

  const walk = (
    index: number,
    sum: number,
    picked: string[],
    coreCount: number
  ): string[] | null => {
    if (sum === target) {
      const ratio = picked.length ? coreCount / picked.length : 0
      if (
        picked.length >= minWords &&
        picked.length <= maxWords &&
        ratio >= CORE_RATIO_MIN
      ) {
        return [...picked]
      }
      return null
    }

    if (sum > target || index >= shuffled.length || picked.length > maxWords) {
      return null
    }

    const memoKey = `${index}|${sum}|${picked.length}|${coreCount}`
    if (memo.has(memoKey)) {
      return null
    }

    const remainingMax = shuffled
      .slice(index)
      .reduce((acc, word) => acc + word.length, 0)
    if (sum + remainingMax < target) {
      memo.set(memoKey, false)
      return null
    }

    const word = shuffled[index]
    picked.push(word)
    const withWord = walk(
      index + 1,
      sum + word.length,
      picked,
      coreCount + (coreWords.has(word) ? 1 : 0)
    )
    if (withWord) {
      return withWord
    }
    picked.pop()

    const withoutWord = walk(index + 1, sum, picked, coreCount)
    if (withoutWord) {
      return withoutWord
    }

    memo.set(memoKey, false)
    return null
  }

  return walk(0, 0, [], 0)
}

function chooseCoverageSubsetWithFallback(args: {
  words: string[]
  target: number
  coreWords: Set<string>
  rng: () => number
}) {
  const strict = chooseCoverageSubset({
    ...args,
    minWords: TARGET_WORDS_MIN,
    maxWords: TARGET_WORDS_MAX,
  })
  if (strict) {
    return strict
  }

  return chooseCoverageSubset({
    ...args,
    minWords: 6,
    maxWords: 16,
  })
}

export function ensureFullGridCoverage(
  words: string[],
  gridSize = GRID_SIZE,
  options?: { theme?: string; seed?: string; maxAttempts?: number }
): {
  words: string[]
  attempts: number
} {
  const target = gridSize * gridSize
  const seed = options?.seed ?? `${Date.now()}-${words.join("-")}`
  const rng = makeRng(seed)
  const maxAttempts = Math.max(50, options?.maxAttempts ?? 120)
  const theme = options?.theme ?? ""

  const themeBank = resolveThemeBank(theme) ?? dynamicThemeBank(theme)
  const relevance = filterWordsByThemeRelevance(
    [...words, ...themeBank.core, ...themeBank.secondary],
    theme
  )
  const basePool = normalizeAndDedupe(relevance.filtered)

  debug("coverage target", {
    totalLetters: basePool.reduce((sum, word) => sum + word.length, 0),
    gridCells: target,
    poolSize: basePool.length,
  })

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const pool = new Set(basePool)

    for (const word of Array.from(pool)) {
      for (const variant of trimWordVariants(word)) {
        if (!WEAK_FALLBACK_WORDS.has(variant)) {
          pool.add(variant)
        }
      }
    }

    const selected = chooseCoverageSubsetWithFallback({
      words: Array.from(pool),
      target,
      coreWords: relevance.coreWords,
      rng,
    })

    if (!selected) {
      debug("coverage retry", {
        attempt,
        reason: "no exact 64-letter selection",
      })
      continue
    }

    const letters = selected.reduce((sum, word) => sum + word.length, 0)
    const coreRatio =
      selected.filter((word) => relevance.coreWords.has(word)).length /
      selected.length

    if (letters === target && coreRatio >= CORE_RATIO_MIN) {
      debug("coverage success", {
        attempt,
        letters,
        words: selected.length,
        coreRatio,
      })
      return { words: selected, attempts: attempt }
    }

    debug("coverage retry", {
      attempt,
      reason: "core ratio or letter mismatch",
      letters,
      coreRatio,
    })
  }

  throw new Error(
    "Could not select a strongly related word set that exactly fills 8x8. Try adjusting approved words."
  )
}

function scorePathTurns(path: Cell[]) {
  let turns = 0
  for (let i = 2; i < path.length; i += 1) {
    const a = path[i - 2]
    const b = path[i - 1]
    const c = path[i]
    const dir1 = [Math.sign(b.row - a.row), Math.sign(b.col - a.col)].join(",")
    const dir2 = [Math.sign(c.row - b.row), Math.sign(c.col - b.col)].join(",")
    if (dir1 !== dir2) {
      turns += 1
    }
  }
  return turns
}

function neighbors(cell: Cell, size: number, rng: () => number) {
  return shuffle(
    DIRECTIONS.map(([dr, dc]) => ({
      row: cell.row + dr,
      col: cell.col + dc,
    })).filter((next) => inBounds(next.row, next.col, size)),
    rng
  )
}

function collectCandidatePaths(args: {
  length: number
  size: number
  occupied: Set<string>
  existingSegments: PathSegment[]
  word: string
  rng: () => number
  cap: number
}) {
  const { length, size, occupied, existingSegments, word, rng, cap } = args
  const freeCells: Cell[] = []
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const k = `${row},${col}`
      if (!occupied.has(k)) {
        freeCells.push({ row, col })
      }
    }
  }

  const starts = shuffle(freeCells, rng)
  const paths: Cell[][] = []

  const walk = (
    path: Cell[],
    seen: Set<string>,
    localSegments: PathSegment[]
  ) => {
    if (paths.length >= cap) {
      return
    }
    if (path.length === length) {
      paths.push([...path])
      return
    }

    const current = path[path.length - 1]
    const options = neighbors(current, size, rng).filter((next) => {
      const k = wordKey(next)
      return !occupied.has(k) && !seen.has(k)
    })

    for (const next of options) {
      const candidateSegment: PathSegment = {
        word,
        index: path.length - 1,
        from: current,
        to: next,
      }

      const clusterPenalty = diagonalClusterPenalty(candidateSegment, [
        ...existingSegments,
        ...localSegments,
      ])
      if (clusterPenalty >= 5) {
        continue
      }

      const k = wordKey(next)
      seen.add(k)
      path.push(next)
      localSegments.push(candidateSegment)
      walk(path, seen, localSegments)
      localSegments.pop()
      path.pop()
      seen.delete(k)
      if (paths.length >= cap) {
        return
      }
    }
  }

  for (const start of starts) {
    const key = wordKey(start)
    if (occupied.has(key)) {
      continue
    }
    const seen = new Set<string>([key])
    walk([start], seen, [])
    if (paths.length >= cap) {
      break
    }
  }

  return paths.sort((a, b) => scorePathTurns(b) - scorePathTurns(a))
}

function placeWordsBacktracking(args: {
  words: string[]
  size: number
  rng: () => number
  maxVisits?: number
}): PlacedWord[] | null {
  const { words, size, rng } = args
  const occupied = new Set<string>()
  const placed: PlacedWord[] = []
  const placedSegments: PathSegment[] = []
  const maxVisits = Math.max(1000, args.maxVisits ?? 12000)
  let visits = 0

  const walk = (index: number): boolean => {
    visits += 1
    if (visits > maxVisits) {
      return false
    }

    if (index >= words.length) {
      return true
    }

    const word = words[index]
    const candidates = collectCandidatePaths({
      length: word.length,
      size,
      occupied,
      existingSegments: placedSegments,
      word,
      rng,
      cap: 120,
    })

    if (!candidates.length) {
      return false
    }

    const ordered = shuffle(candidates.slice(0, 20), rng)
    for (const path of ordered) {
      const pathSegments = getPathSegments(path, word)
      for (const cell of path) {
        occupied.add(wordKey(cell))
      }
      placedSegments.push(...pathSegments)
      placed.push({ word, path })

      if (walk(index + 1)) {
        return true
      }

      placed.pop()
      for (let i = 0; i < pathSegments.length; i += 1) {
        placedSegments.pop()
      }
      for (const cell of path) {
        occupied.delete(wordKey(cell))
      }
    }

    return false
  }

  return walk(0) ? placed : null
}

export function generateGridFromApprovedWords(
  words: string[],
  options?: {
    seed?: string
    gridSize?: number
    maxAttempts?: number
    theme?: string
  }
): GeneratedGridResult {
  const gridSize = options?.gridSize ?? GRID_SIZE
  if (gridSize !== GRID_SIZE) {
    throw new Error("Only 8x8 grid generation is currently supported.")
  }

  const seed = options?.seed ?? `${Date.now()}-${words.join("-")}`

  const coverage = ensureFullGridCoverage(words, gridSize, {
    theme: options?.theme,
    seed,
    maxAttempts: 120,
  })
  const selected = coverage.words

  debug("selected words for placement", {
    words: selected,
    totalLetters: selected.reduce((sum, word) => sum + word.length, 0),
  })

  const maxAttempts = Math.max(120, options?.maxAttempts ?? 220)
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const attemptRng = makeRng(`${seed}-${attempt}`)
    const ordered = shuffle(selected, attemptRng).sort(
      (a, b) => b.length - a.length
    )
    const placed = placeWordsBacktracking({
      words: ordered,
      size: gridSize,
      rng: attemptRng,
      maxVisits: 12000,
    })

    if (!placed) {
      debug("placement retry", {
        attempt,
        reason: "backtracking placement failed",
      })
      continue
    }

    const grid = Array.from({ length: gridSize }, () =>
      Array.from({ length: gridSize }, () => "")
    )

    for (const entry of placed) {
      for (let i = 0; i < entry.path.length; i += 1) {
        const cell = entry.path[i]
        grid[cell.row][cell.col] = entry.word[i]
      }
    }

    const result: GeneratedGridResult = {
      grid,
      approvedWords: placed,
      status: "generated",
      metadata: {
        gridSize: GRID_SIZE,
        seed,
        attempts: attempt + coverage.attempts,
        qualityScore: 0,
      },
    }

    const allSegments = placed.flatMap((entry) =>
      getPathSegments(entry.path, entry.word)
    )
    const baseTurnScore =
      placed.reduce((sum, word) => sum + scorePathTurns(word.path), 0) /
      Math.max(1, placed.length)
    const spacingPenalty = geometryPenalty(allSegments)
    result.metadata.qualityScore =
      Math.round(Math.max(0, baseTurnScore - spacingPenalty) * 100) / 100

    const validation = validatePuzzle(result)
    if (validation.valid) {
      result.status = "validated"
      debug("generation validated", {
        attempts: result.metadata.attempts,
        qualityScore: result.metadata.qualityScore,
      })
      return result
    }

    debug("validation failure", { attempt, errors: validation.errors })
  }

  throw new Error(
    "Could not generate a fully-covered 8x8 puzzle with current approved words."
  )
}

export function validatePuzzle(puzzle: {
  grid: string[][]
  approvedWords: Array<{ word: string; path: Cell[] }>
  metadata?: { gridSize?: number }
}): ValidationResult {
  const errors: string[] = []
  const size = puzzle.metadata?.gridSize ?? puzzle.grid.length
  const cellUsage = new Map<string, number>()
  let placedLetters = 0

  if (size !== GRID_SIZE) {
    errors.push("Grid size must be 8x8.")
  }

  if (
    puzzle.grid.length !== size ||
    puzzle.grid.some((row) => row.length !== size)
  ) {
    errors.push("Grid dimensions are invalid.")
    return { valid: false, errors }
  }

  for (const entry of puzzle.approvedWords) {
    if (!entry.word || entry.path.length !== entry.word.length) {
      errors.push(`Word path length mismatch for ${entry.word || "<empty>"}.`)
      continue
    }

    placedLetters += entry.word.length
    for (let i = 0; i < entry.path.length; i += 1) {
      const cell = entry.path[i]
      if (!inBounds(cell.row, cell.col, size)) {
        errors.push(`Out-of-bounds coordinate in ${entry.word}.`)
        break
      }

      const key = wordKey(cell)
      cellUsage.set(key, (cellUsage.get(key) ?? 0) + 1)

      if (puzzle.grid[cell.row][cell.col] !== entry.word[i]) {
        errors.push(`Grid letter mismatch for ${entry.word}.`)
        break
      }

      if (i > 0) {
        const prev = entry.path[i - 1]
        const dr = Math.abs(cell.row - prev.row)
        const dc = Math.abs(cell.col - prev.col)
        if (dr > 1 || dc > 1 || (dr === 0 && dc === 0)) {
          errors.push(`Path is not contiguous for ${entry.word}.`)
          break
        }
      }
    }
  }

  if (placedLetters !== GRID_CELLS) {
    errors.push(`Total letters mismatch: ${placedLetters}/${GRID_CELLS}.`)
  }

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const key = `${row},${col}`
      const usage = cellUsage.get(key) ?? 0
      if (usage !== 1) {
        if (usage === 0) {
          errors.push(`Orphan letter at ${key}.`)
        } else {
          errors.push(`Overlap detected at ${key}.`)
        }
      }

      if (!puzzle.grid[row][col] || puzzle.grid[row][col].length !== 1) {
        errors.push(`Empty or invalid cell at ${key}.`)
      }
    }
  }

  return { valid: errors.length === 0, errors }
}

export function validateGeneratedGrid(puzzle: {
  grid: string[][]
  approvedWords: Array<{ word: string; path: Cell[] }>
  metadata?: { gridSize?: number }
}) {
  return validatePuzzle(puzzle)
}

export function getSolutionOverlayData(puzzle: {
  approvedWords: Array<{ word: string; path: Cell[] }>
}): {
  segments: Array<{
    word: string
    order: number
    from: Cell
    to: Cell
  }>
  highlights: Array<{ word: string; row: number; col: number; step: number }>
} {
  const segments: Array<{ word: string; order: number; from: Cell; to: Cell }> =
    []
  const highlights: Array<{
    word: string
    row: number
    col: number
    step: number
  }> = []

  for (const entry of puzzle.approvedWords) {
    for (let i = 0; i < entry.path.length; i += 1) {
      const cell = entry.path[i]
      highlights.push({
        word: entry.word,
        row: cell.row,
        col: cell.col,
        step: i + 1,
      })
      if (i > 0) {
        segments.push({
          word: entry.word,
          order: i,
          from: entry.path[i - 1],
          to: cell,
        })
      }
    }
  }

  return { segments, highlights }
}

export function toPuzzleWords(approvedWords: PlacedWord[]): PuzzleWord[] {
  const longest = approvedWords.reduce((max, word) =>
    word.word.length > max.word.length ? word : max
  )

  return approvedWords.map((entry) => ({
    word: entry.word,
    path: entry.path,
    isSpangram: entry.word === longest.word,
  }))
}
