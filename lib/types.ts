export type Cell = { row: number; col: number }

export type PuzzleWord = {
  word: string
  isSpangram: boolean
  path: Cell[]
}

export type Puzzle = {
  date: string
  theme: string
  themeDisplayTitle: string
  grid: string[][]
  words: PuzzleWord[]
  published: boolean
  status: "Draft" | "Published"
  adminStatus?: "draft" | "generated" | "validated"
  metadata?: {
    gridSize: 8
    seed: string
    attempts: number
    qualityScore: number
  }
  validation?: {
    valid: boolean
    errors: string[]
  }
}

export type UserRecord = {
  userId: string
  displayName: string
  createdAt: string
  lastActiveDate: string
  completedDates: string[]
  currentStreak: number
  longestStreak: number
  lastDisplayNameChangeDate?: string
}

export type CompletionEntry = {
  userId: string
  displayName: string
  puzzleDate: string
  completionTimeSeconds: number
  streakCount: number
  submittedAt: string
}

export type LeaderboardEntry = CompletionEntry & {
  rank: number
}
