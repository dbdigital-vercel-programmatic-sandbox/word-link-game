import { isDictionaryWord } from "@/lib/server/dictionary"
import { Puzzle } from "@/lib/types"

export function isRecognizedBonusWord(puzzle: Puzzle, word: string) {
  if (word.length < 3) {
    return false
  }

  const upper = word.toUpperCase()
  const answerWords = new Set(puzzle.words.map((w) => w.word.toUpperCase()))
  if (answerWords.has(upper)) {
    return false
  }

  return isDictionaryWord(upper)
}
