import { readFileSync } from "node:fs"

import wordListPath from "word-list"

let dictionaryCache: Set<string> | null = null

function normalize(word: string) {
  return word.toUpperCase().replace(/[^A-Z]/g, "")
}

function loadDictionary() {
  if (dictionaryCache) {
    return dictionaryCache
  }

  const raw = readFileSync(wordListPath, "utf8")
  const words = raw.split("\n")
  dictionaryCache = new Set(
    words.map((word) => normalize(word)).filter((word) => word.length >= 3)
  )
  return dictionaryCache
}

export function isDictionaryWord(word: string) {
  const normalized = normalize(word)
  if (normalized.length < 3) {
    return false
  }

  return loadDictionary().has(normalized)
}
