"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { Input } from "@/components/ui/input"
import { DLS, USER_ID_STORAGE_KEY } from "@/lib/dls"

import {
  AppShell,
  Card,
  Icon,
  PrimaryButton,
  SecondaryButton,
  TopNav,
} from "./dls-ui"

type TodayPuzzle = {
  date: string
  theme: string
  grid: string[][]
  wordsCount: number
}

function Step({ title, body }: { title: string; body: string }) {
  return (
    <Card>
      <p className="text-base font-semibold">{title}</p>
      <p className="text-sm">{body}</p>
    </Card>
  )
}

function MiniDemo() {
  const letters = [
    ["S", "E", "A"],
    ["U", "N", "R"],
    ["N", "O", "W"],
  ]
  const solution = ["0,0", "0,1", "0,2", "1,1"]
  const [path, setPath] = useState<string[]>([])
  const found = path.join("|") === solution.join("|")

  return (
    <Card>
      <p className="mb-2 text-sm font-semibold">Mini Demo: trace SUNN</p>
      <div className="grid w-fit grid-cols-3 gap-1">
        {letters.flatMap((row, r) =>
          row.map((char, c) => {
            const k = `${r},${c}`
            const active = path.includes(k)
            return (
              <button
                type="button"
                key={k}
                className={`h-10 w-10 rounded-md border border-black text-sm font-bold ${active ? "bg-black text-white" : "bg-white"}`}
                onClick={() =>
                  setPath((prev) => (prev.includes(k) ? prev : [...prev, k]))
                }
              >
                {char}
              </button>
            )
          })
        )}
      </div>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          className="rounded-md border border-black px-2 py-1 text-xs"
          onClick={() => setPath([])}
        >
          Reset
        </button>
        {found && (
          <span className="text-xs font-semibold text-green-700">
            Valid trace!
          </span>
        )}
      </div>
    </Card>
  )
}

export function LandingPage() {
  const [puzzle, setPuzzle] = useState<TodayPuzzle | null>(null)
  const [identity, setIdentity] = useState<{
    userId: string
    displayName: string
    streak: number
    completedDates: string[]
  } | null>(null)
  const [displayName, setDisplayName] = useState("")
  const [alreadyDone, setAlreadyDone] = useState(false)

  useEffect(() => {
    const run = async () => {
      const localId = localStorage.getItem(USER_ID_STORAGE_KEY)
      const initRes = await fetch("/api/user/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(localId ? { userId: localId } : {}),
      })
      const initData = await initRes.json()
      localStorage.setItem(USER_ID_STORAGE_KEY, initData.userId)
      setIdentity(initData)
      setDisplayName(initData.displayName)

      const p = await fetch("/api/puzzle/today").then((r) => r.json())
      setPuzzle(p)

      const doneDate = localStorage.getItem("strand_last_result_date")
      setAlreadyDone(doneDate === p.date)
    }
    void run()
  }, [])

  const publishDate = !puzzle?.date
    ? ""
    : new Date(`${puzzle.date}T00:00:00`).toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      })

  const streakLine = identity?.streak
    ? `You're on a ${identity.streak}-day streak!`
    : "Start your streak today!"

  const saveDisplayName = async () => {
    if (!identity) {
      return
    }
    await fetch("/api/user/display-name", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: identity.userId, displayName }),
    })
  }

  const resetData = async () => {
    if (!identity) {
      return
    }
    const ok = window.confirm(
      "Reset all local progress and leaderboard history for this device?"
    )
    if (!ok) {
      return
    }
    await fetch("/api/user", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: identity.userId }),
    })
    localStorage.removeItem(USER_ID_STORAGE_KEY)
    localStorage.removeItem("strand_last_result_date")
    window.location.reload()
  }

  return (
    <AppShell>
      <TopNav title="Strands Daily" />

      <div className="mb-4 flex justify-end">
        <Drawer>
          <DrawerTrigger asChild>
            <button
              type="button"
              className="rounded-full bg-black p-2 text-white"
              aria-label="settings"
            >
              <Icon src={DLS.assets.settings} alt="settings" size={20} />
            </button>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Settings</DrawerTitle>
            </DrawerHeader>
            <div className="space-y-3 p-4">
              <label className="text-sm font-semibold">Display Name</label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
              <p className="text-xs text-black/70">
                You can update your display name once per day.
              </p>
              <PrimaryButton onClick={saveDisplayName}>Save Name</PrimaryButton>
            </div>
          </DrawerContent>
        </Drawer>
      </div>

      <Card className="mb-4 space-y-3">
        <p className="text-sm font-semibold">Theme of the Day</p>
        <h1 className="text-3xl font-bold">{puzzle?.theme ?? "Loading..."}</h1>
        <p className="text-sm">{publishDate}</p>
        {alreadyDone ? (
          <PrimaryButton href="/results">View Your Results</PrimaryButton>
        ) : (
          <PrimaryButton href="/play">Play Today&apos;s Puzzle</PrimaryButton>
        )}
      </Card>

      <Card className="mb-4 flex items-center gap-2">
        <Icon src={DLS.assets.fire} alt="fire" size={18} />
        <p className="font-semibold">{streakLine}</p>
      </Card>

      <Card className="mb-4" id="how-to-play">
        <h2 className="mb-3 text-xl font-semibold">How to Play</h2>
        <div className="space-y-2">
          <Step title="Step 1" body="Find words hidden in the 9x9 grid." />
          <Step
            title="Step 2"
            body="Tap a letter and drag through adjacent letters in any of 8 directions."
          />
          <Step
            title="Step 3"
            body="Every cell belongs to one word. Find all words to finish the puzzle."
          />
          <Step
            title="Step 4"
            body="Find the Spangram: it stretches across the full grid."
          />
          <Step
            title="Step 5"
            body="Return daily for a new theme and puzzle."
          />
        </div>
        <div className="mt-3">
          <MiniDemo />
        </div>
      </Card>

      <Card className="mb-4 border-l-4 border-black">
        <p className="text-sm">
          Your progress is saved to this device. Clearing your cookies and
          browser storage will reset your streak and leaderboard history.
        </p>
      </Card>

      <footer className="dls-card flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
        <Link href="#">Privacy</Link>
        <Link href="#">Terms</Link>
        <Link href="#">Feedback</Link>
        <button type="button" onClick={resetData} className="font-semibold">
          Reset My Data
        </button>
      </footer>
      <div className="h-3" />
      <SecondaryButton href="/leaderboard">View Leaderboard</SecondaryButton>
    </AppShell>
  )
}
