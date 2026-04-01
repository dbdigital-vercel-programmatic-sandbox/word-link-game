import { addDays } from "@/lib/server/date"

export function computeStreak(completedDates: string[]) {
  const sorted = [...new Set(completedDates)].sort()
  if (!sorted.length) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      completedDates: [] as string[],
    }
  }

  let longest = 1
  let run = 1
  for (let i = 1; i < sorted.length; i++) {
    const expected = addDays(sorted[i - 1], 1)
    if (sorted[i] === expected) {
      run += 1
      longest = Math.max(longest, run)
    } else {
      run = 1
    }
  }

  let current = 1
  for (let i = sorted.length - 1; i > 0; i--) {
    const prev = sorted[i - 1]
    const expectedPrev = addDays(sorted[i], -1)
    if (prev === expectedPrev) {
      current += 1
    } else {
      break
    }
  }

  return {
    currentStreak: current,
    longestStreak: longest,
    completedDates: sorted,
  }
}
