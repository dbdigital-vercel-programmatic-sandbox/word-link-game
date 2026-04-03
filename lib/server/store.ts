import { Puzzle, CompletionEntry, UserRecord } from "@/lib/types"

type MemoryStore = {
  users: Map<string, UserRecord>
  puzzles: Map<string, Puzzle>
  completions: CompletionEntry[]
}

declare global {
  var __strandsStore: MemoryStore | undefined
}

function createStore(): MemoryStore {
  return {
    users: new Map(),
    puzzles: new Map(),
    completions: [],
  }
}

export const store = globalThis.__strandsStore ?? createStore()

if (!globalThis.__strandsStore) {
  globalThis.__strandsStore = store
}
