import { addDays, todayUtcYmd } from "@/lib/server/date"
import { store } from "@/lib/server/store"
import { LeaderboardEntry } from "@/lib/types"

function rankEntries(entries: typeof store.completions) {
  return entries
    .sort((a, b) =>
      a.completionTimeSeconds === b.completionTimeSeconds
        ? a.submittedAt.localeCompare(b.submittedAt)
        : a.completionTimeSeconds - b.completionTimeSeconds
    )
    .map((e, idx) => ({ ...e, rank: idx + 1 })) as LeaderboardEntry[]
}

export function getLeaderboardByDate(date = todayUtcYmd()) {
  const list = store.completions.filter((c) => c.puzzleDate === date)
  return rankEntries(list)
}

export function getLeaderboardByPeriod(period: "week" | "all") {
  const today = todayUtcYmd()
  const inRange =
    period === "all"
      ? store.completions
      : store.completions.filter(
          (c) => c.puzzleDate >= addDays(today, -6) && c.puzzleDate <= today
        )

  const bestByUser = new Map<string, (typeof inRange)[number]>()
  for (const entry of inRange) {
    const prev = bestByUser.get(entry.userId)
    if (!prev) {
      bestByUser.set(entry.userId, entry)
      continue
    }
    if (
      entry.completionTimeSeconds < prev.completionTimeSeconds ||
      (entry.completionTimeSeconds === prev.completionTimeSeconds &&
        entry.submittedAt < prev.submittedAt)
    ) {
      bestByUser.set(entry.userId, entry)
    }
  }

  return rankEntries(Array.from(bestByUser.values()))
}
