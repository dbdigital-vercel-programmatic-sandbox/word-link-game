const WORD_BANK: Record<string, string[]> = {
  SPACE: [
    "ORBIT",
    "PLANET",
    "COMET",
    "NEBULA",
    "GALAXY",
    "ROCKET",
    "ASTEROID",
    "SATELLITE",
    "TELESCOPE",
    "ECLIPSE",
    "COSMOS",
    "GRAVITY",
    "METEOR",
    "SPACESHIP",
    "MOONLIGHT",
    "STARDUST",
  ],
  OCEAN: [
    "CORAL",
    "REEF",
    "TIDAL",
    "CURRENT",
    "WHALE",
    "DOLPHIN",
    "SEAHORSE",
    "JELLYFISH",
    "OCTOPUS",
    "SEASHELL",
    "SHIPWRECK",
    "COASTLINE",
    "SEABREEZE",
    "ANCHOR",
    "HARBOR",
    "MARINER",
  ],
}

const FILLER_PARTS = [
  "QUEST",
  "TRACK",
  "SPARK",
  "FIELD",
  "TRAIL",
  "GLOW",
  "WAVE",
  "LIGHT",
  "CORE",
  "POINT",
]

function normalizeWord(word: string) {
  return word.toUpperCase().replace(/[^A-Z]/g, "")
}

function themeKey(theme: string) {
  const upper = theme.toUpperCase()
  if (
    upper.includes("SPACE") ||
    upper.includes("PLANET") ||
    upper.includes("STAR")
  ) {
    return "SPACE"
  }
  if (
    upper.includes("OCEAN") ||
    upper.includes("SEA") ||
    upper.includes("WATER")
  ) {
    return "OCEAN"
  }
  return "SPACE"
}

export function getCoreThemeWords(theme: string) {
  const root = normalizeWord(theme)
  const themeParts = theme
    .split(/[^A-Za-z]+/)
    .map((part) => normalizeWord(part))
    .filter((part) => part.length >= 4)
  const byTheme = WORD_BANK[themeKey(theme)] ?? []
  const out: string[] = []
  const used = new Set<string>()

  const push = (word: string) => {
    const clean = normalizeWord(word)
    if (clean.length < 4 || used.has(clean)) {
      return
    }
    used.add(clean)
    out.push(clean)
  }

  push(root)
  for (const part of themeParts) {
    push(part)
  }
  for (const w of byTheme) {
    push(w)
  }

  return out
}

export function makeThemeWordOfLength(
  theme: string,
  length: number,
  used?: Set<string>
) {
  const cleanTheme = normalizeWord(theme) || "THEME"
  const minLength = Math.max(4, length)
  const candidates = WORD_BANK[themeKey(theme)] ?? []

  for (const word of candidates) {
    const clean = normalizeWord(word)
    if (clean.length === minLength && !used?.has(clean)) {
      return clean
    }
  }

  for (const part of FILLER_PARTS) {
    const seed = normalizeWord(`${cleanTheme}${part}`)
    if (!seed) {
      continue
    }
    let out = seed
    while (out.length < minLength) {
      out += cleanTheme
    }
    const next = out.slice(0, minLength)
    if (!used?.has(next)) {
      return next
    }
  }

  let fallback = cleanTheme
  while (fallback.length < minLength) {
    fallback += "A"
  }
  return fallback.slice(0, minLength)
}

export function getThemeWordSuggestions(theme: string, limit = 20) {
  const out = getCoreThemeWords(theme)
  const used = new Set(out)

  let len = 4
  while (out.length < limit) {
    const next = makeThemeWordOfLength(theme, len, used)
    if (!used.has(next)) {
      out.push(next)
      used.add(next)
    }
    len += 1
    if (len > 12) {
      len = 4
    }
  }

  return out.slice(0, limit)
}
