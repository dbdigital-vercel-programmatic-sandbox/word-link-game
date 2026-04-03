type ThemeWordCandidate = {
  word: string
  relevanceScore: number
  sourceNote?: string
}

export type GeneratedThemeWords = {
  theme: string
  source: "web" | "local" | "hybrid"
  candidates: ThemeWordCandidate[]
}

type ThemeLexicon = {
  aliases: string[]
  core: string[]
  secondary: string[]
}

const THEME_LEXICONS: ThemeLexicon[] = [
  {
    aliases: ["solar system", "space", "planets", "astronomy"],
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
    secondary: ["METEOR", "NEBULA", "COSMOS", "ROCKET", "SATELLITE"],
  },
  {
    aliases: ["national park", "parks", "wilderness", "nature reserve"],
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
    secondary: ["NATURE", "SAFARI", "SUMMIT", "PRAIRIE", "RIDGE"],
  },
  {
    aliases: ["ocean", "sea", "marine"],
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
      "LAGOON",
      "KELP",
      "SURF",
    ],
    secondary: ["COAST", "SEABED", "MARINA", "TURTLE"],
  },
]

const WEAK_WORDS = new Set([
  "PLACE",
  "AREA",
  "THING",
  "GOOD",
  "OUTSIDE",
  "OBJECT",
  "TOPIC",
  "THEME",
  "COMMON",
  "GREAT",
  "WORLD",
])

function cleanToken(value: string) {
  return value.toUpperCase().replace(/[^A-Z]/g, "")
}

function resolveLexicon(theme: string) {
  const lower = theme.toLowerCase()
  return (
    THEME_LEXICONS.find((lexicon) =>
      lexicon.aliases.some((alias) => lower.includes(alias))
    ) ?? null
  )
}

function extractWebTokens(text: string) {
  const matches = text.toLowerCase().match(/\b[a-z]{4,10}\b/g) ?? []
  return matches.map((w) => cleanToken(w)).filter(Boolean)
}

function tokenFrequencies(tokens: string[]) {
  const map = new Map<string, number>()
  for (const token of tokens) {
    map.set(token, (map.get(token) ?? 0) + 1)
  }
  return map
}

async function fetchWikipediaText(theme: string) {
  const queries = [
    `${theme} related terms`,
    `${theme} vocabulary`,
    `${theme} glossary`,
  ]

  const chunks: string[] = []
  for (const query of queries) {
    const searchUrl =
      "https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&utf8=1&srlimit=4&srsearch=" +
      encodeURIComponent(query)
    const searchRes = await fetch(searchUrl)
    if (!searchRes.ok) {
      continue
    }

    const searchJson = (await searchRes.json()) as {
      query?: { search?: Array<{ title?: string; snippet?: string }> }
    }
    const rows = searchJson.query?.search ?? []
    for (const row of rows) {
      if (row.snippet) {
        chunks.push(row.snippet.replace(/<[^>]+>/g, " "))
      }
      if (!row.title) {
        continue
      }
      const title = encodeURIComponent(row.title)
      const summaryRes = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${title}`
      )
      if (!summaryRes.ok) {
        continue
      }
      const summary = (await summaryRes.json()) as { extract?: string }
      if (summary.extract) {
        chunks.push(summary.extract)
      }
    }
  }

  return chunks.join(" ")
}

export function filterByThemeRelevance(
  theme: string,
  candidates: Array<{
    word: string
    relevanceScore?: number
    sourceNote?: string
  }>
) {
  const themeTokens = new Set(
    theme
      .toUpperCase()
      .split(/[^A-Z]+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3)
  )

  const lexicon = resolveLexicon(theme)
  const core = new Set((lexicon?.core ?? []).map(cleanToken))
  const secondary = new Set((lexicon?.secondary ?? []).map(cleanToken))
  const used = new Set<string>()
  const out: ThemeWordCandidate[] = []

  for (const candidate of candidates) {
    const word = cleanToken(candidate.word)
    if (!word || used.has(word) || word.length < 4 || word.length > 10) {
      continue
    }
    if (WEAK_WORDS.has(word)) {
      continue
    }
    if (themeTokens.has(word) && !core.has(word) && !secondary.has(word)) {
      continue
    }

    const isCore = core.has(word)
    const isSecondary = secondary.has(word)
    if (!isCore && !isSecondary && lexicon) {
      continue
    }

    const base = candidate.relevanceScore ?? 0.4
    const boosted = isCore
      ? Math.max(base, 0.95)
      : isSecondary
        ? Math.max(base, 0.8)
        : base
    out.push({
      word,
      relevanceScore: boosted,
      sourceNote: candidate.sourceNote,
    })
    used.add(word)
  }

  return out.sort((a, b) => b.relevanceScore - a.relevanceScore)
}

export async function generateThemeWords(
  theme: string,
  options?: {
    useWebSearch?: boolean
    maxWords?: number
  }
): Promise<GeneratedThemeWords> {
  const maxWords = Math.max(8, Math.min(options?.maxWords ?? 14, 20))
  const lexicon = resolveLexicon(theme)

  const localCandidates: ThemeWordCandidate[] = [
    ...(lexicon?.core ?? []).map((word, i) => ({
      word,
      relevanceScore: 0.98 - i * 0.01,
      sourceNote: "curated-core",
    })),
    ...(lexicon?.secondary ?? []).map((word, i) => ({
      word,
      relevanceScore: 0.82 - i * 0.01,
      sourceNote: "curated-secondary",
    })),
  ]

  const wantsWeb = options?.useWebSearch !== false
  if (!wantsWeb) {
    return {
      theme,
      source: "local",
      candidates: filterByThemeRelevance(theme, localCandidates).slice(
        0,
        maxWords
      ),
    }
  }

  try {
    const text = await fetchWikipediaText(theme)
    const frequencies = tokenFrequencies(extractWebTokens(text))
    const webCandidates: ThemeWordCandidate[] = Array.from(
      frequencies.entries()
    )
      .map(([word, count]) => ({
        word,
        relevanceScore: Math.min(0.78, 0.5 + count * 0.04),
        sourceNote: "wikipedia",
      }))
      .sort((a, b) => b.relevanceScore - a.relevanceScore)

    const merged = filterByThemeRelevance(theme, [
      ...localCandidates,
      ...webCandidates,
    ]).slice(0, maxWords)

    return {
      theme,
      source: localCandidates.length ? "hybrid" : "web",
      candidates: merged,
    }
  } catch {
    return {
      theme,
      source: "local",
      candidates: filterByThemeRelevance(theme, localCandidates).slice(
        0,
        maxWords
      ),
    }
  }
}
