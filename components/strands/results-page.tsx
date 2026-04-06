"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"

import { DLS } from "@/lib/dls"
import { mmss, nextMidnightCountdown } from "@/lib/server/date"

import { AppShell, Card, Icon, PrimaryButton, SecondaryButton } from "./dls-ui"

type ResultData = {
  theme: string
  themeDisplayTitle?: string
  timeSeconds: number
  wordsFound: number
  totalWords: number
  spangramFound: boolean
  rank: number
  streak: number
  completedDates: string[]
}

function useCountdown() {
  const [seconds, setSeconds] = useState(nextMidnightCountdown())
  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [])
  const h = String(Math.floor(seconds / 3600)).padStart(2, "0")
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")
  const s = String(seconds % 60).padStart(2, "0")
  return `${h}:${m}:${s}`
}

function dayLabel(ymd: string) {
  return new Date(`${ymd}T00:00:00`)
    .toLocaleDateString(undefined, { weekday: "short" })
    .toUpperCase()
}

export function ResultsPage() {
  const [data] = useState<ResultData | null>(() => {
    if (typeof window === "undefined") {
      return null
    }
    const raw = localStorage.getItem("strand_last_result")
    return raw ? (JSON.parse(raw) as ResultData) : null
  })
  const [top3, setTop3] = useState<
    Array<{ rank: number; displayName: string; completionTimeSeconds: number }>
  >([])
  const countdown = useCountdown()

  useEffect(() => {
    const run = async () => {
      const lb = await fetch("/api/leaderboard").then((r) => r.json())
      setTop3(lb.entries.slice(0, 3))
    }
    void run()
  }, [])

  const streakSlots = useMemo(() => {
    const today = new Date()
    const days: string[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(today.getDate() - i)
      days.push(d.toISOString().slice(0, 10))
    }
    return days
  }, [])

  const share = async () => {
    if (!data) {
      return
    }
    const text = [
      `Strands Daily: ${data.themeDisplayTitle ?? data.theme}`,
      `Time: ${mmss(data.timeSeconds)}`,
      `Streak: ${data.streak}`,
      `Rank: #${data.rank}`,
      "🟩🟩🟩🟩🟩",
      "🟨🟨🟨🟨🟨",
    ].join("\n")
    if (navigator.share) {
      await navigator.share({ text })
      return
    }
    await navigator.clipboard.writeText(text)
  }

  return (
    <AppShell>
      <Card className="mb-4 text-center">
        <div className="mb-2 flex justify-center">
          <Icon src={DLS.assets.trophy} alt="trophy" size={72} />
        </div>
        <h1 className="text-3xl font-bold">Puzzle Complete!</h1>
        <p className="text-base">
          {data?.themeDisplayTitle ?? data?.theme ?? ""}
        </p>
        <p className="text-lg font-semibold">
          Completed in {mmss(data?.timeSeconds ?? 0)}
        </p>
      </Card>

      <Card className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xl font-semibold">7-Day Streak</h2>
          <div className="flex items-center gap-1 text-lg font-bold">
            <Icon src={DLS.assets.fire} alt="fire" size={18} />{" "}
            {data?.streak ?? 0}-day streak
          </div>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {streakSlots.map((d, i) => {
            const done = Boolean(data?.completedDates?.includes(d))
            const isToday = i === 6
            return (
              <div key={d} className="text-center">
                <div
                  className={`mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-full ${done ? "bg-black text-white" : "bg-black/15"}`}
                >
                  {done ? (
                    <Icon
                      src={isToday ? DLS.assets.ray : DLS.assets.tick}
                      alt="state"
                      size={14}
                    />
                  ) : (
                    <Icon src={DLS.assets.cross} alt="missed" size={14} />
                  )}
                </div>
                <div
                  className={`text-[11px] font-semibold ${isToday ? "text-orange-600" : "text-black"}`}
                >
                  {dayLabel(d)}
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      <Card className="mb-4">
        <h2 className="mb-2 text-xl font-semibold">Today&apos;s Performance</h2>
        <p>Time: {mmss(data?.timeSeconds ?? 0)}</p>
        <p>
          Words: {data?.wordsFound ?? 0} / {data?.totalWords ?? 0}
        </p>
        <p>Spangram: {data?.spangramFound ? "Found" : "Not found"}</p>
      </Card>

      <Card className="mb-4">
        <p className="mb-2 text-lg font-semibold">
          You ranked #{data?.rank ?? "-"} today
        </p>
        {top3.map((r) => (
          <div
            key={r.rank}
            className="flex items-center justify-between py-1 text-sm"
          >
            <span>#{r.rank}</span>
            <span>{r.displayName}</span>
            <span>{mmss(r.completionTimeSeconds)}</span>
          </div>
        ))}
        <div className="mt-3">
          <PrimaryButton href="/leaderboard">
            View Full Leaderboard
          </PrimaryButton>
        </div>
      </Card>

      <div className="mb-4">
        <SecondaryButton onClick={() => void share()}>Share</SecondaryButton>
      </div>

      <Card className="mb-4 text-center">
        <p className="text-sm">Next puzzle in {countdown}</p>
      </Card>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <PrimaryButton href="/leaderboard">View Leaderboard</PrimaryButton>
        <SecondaryButton href="/">Back to Home</SecondaryButton>
      </div>

      <div className="mt-4 text-center text-sm">
        <Link href="/play">Replay today</Link>
      </div>
    </AppShell>
  )
}
