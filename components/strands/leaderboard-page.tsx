"use client"

import { useEffect, useMemo, useState } from "react"

import { USER_ID_STORAGE_KEY } from "@/lib/dls"
import { mmss } from "@/lib/server/date"

import { AppShell, Card, PrimaryButton, SecondaryButton } from "./dls-ui"

type Entry = {
  userId: string
  displayName: string
  completionTimeSeconds: number
  streakCount: number
  rank: number
}

export function LeaderboardPage() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [filter, setFilter] = useState<"today" | "week" | "all">("today")
  const [userId] = useState(() =>
    typeof window === "undefined"
      ? ""
      : (localStorage.getItem(USER_ID_STORAGE_KEY) ?? "")
  )
  const [page, setPage] = useState(1)

  useEffect(() => {
    const query =
      filter === "today"
        ? "/api/leaderboard"
        : `/api/leaderboard?period=${filter === "week" ? "week" : "all"}`
    fetch(query)
      .then((r) => r.json())
      .then((d) => setEntries(d.entries))
  }, [filter])

  const own = entries.find((e) => e.userId === userId)
  const paged = useMemo(() => entries.slice(0, page * 50), [entries, page])

  return (
    <AppShell>
      <Card className="mb-4">
        <h1 className="text-2xl font-bold">Today&apos;s Leaderboard</h1>
      </Card>

      <Card className="mb-4">
        {own ? (
          <div className="flex items-center justify-between">
            <span>#{own.rank}</span>
            <span>{own.displayName}</span>
            <span>{mmss(own.completionTimeSeconds)}</span>
            <span>{own.streakCount}d</span>
          </div>
        ) : (
          <p>Complete today&apos;s puzzle to join the leaderboard. Rank: -</p>
        )}
      </Card>

      <div className="mb-4 grid grid-cols-3 gap-2">
        <button
          type="button"
          className={
            filter === "today"
              ? "dls-button-primary rounded-xl"
              : "dls-button-secondary rounded-xl"
          }
          onClick={() => setFilter("today")}
        >
          Today
        </button>
        <button
          type="button"
          className={
            filter === "week"
              ? "dls-button-primary rounded-xl"
              : "dls-button-secondary rounded-xl"
          }
          onClick={() => setFilter("week")}
        >
          This Week
        </button>
        <button
          type="button"
          className={
            filter === "all"
              ? "dls-button-primary rounded-xl"
              : "dls-button-secondary rounded-xl"
          }
          onClick={() => setFilter("all")}
        >
          All Time
        </button>
      </div>

      <Card className="mb-4">
        {paged.length ? (
          <div className="space-y-1">
            {paged.map((e) => (
              <div
                key={`${e.userId}-${e.rank}`}
                className={`grid grid-cols-4 items-center rounded-md px-2 py-2 text-sm ${e.userId === userId ? "bg-black text-white" : "bg-white"}`}
              >
                <span>#{e.rank}</span>
                <span className="truncate">{e.displayName}</span>
                <span>{mmss(e.completionTimeSeconds)}</span>
                <span>{e.streakCount}d</span>
              </div>
            ))}
          </div>
        ) : (
          <p>Be the first to complete today&apos;s puzzle!</p>
        )}
      </Card>

      {paged.length < entries.length && (
        <div className="mb-4">
          <SecondaryButton onClick={() => setPage((p) => p + 1)}>
            Load More
          </SecondaryButton>
        </div>
      )}

      <div className="grid gap-2 md:grid-cols-2">
        <PrimaryButton href="/play">Play Today</PrimaryButton>
        <SecondaryButton href="/">Back Home</SecondaryButton>
      </div>
    </AppShell>
  )
}
