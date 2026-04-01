"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { DLS, USER_ID_STORAGE_KEY } from "@/lib/dls"
import { cellKey, isAdjacent } from "@/lib/game"
import { mmss } from "@/lib/server/date"
import { Cell } from "@/lib/types"

import { AppShell, Card, Icon } from "./dls-ui"

type PuzzlePayload = {
  date: string
  theme: string
  grid: string[][]
  wordsCount: number
}

export function GamePage() {
  const router = useRouter()
  const [puzzle, setPuzzle] = useState<PuzzlePayload | null>(null)
  const [userId, setUserId] = useState("")
  const [path, setPath] = useState<Cell[]>([])
  const [foundWords, setFoundWords] = useState<string[]>([])
  const [spangramFound, setSpangramFound] = useState(false)
  const [foundCells, setFoundCells] = useState<Set<string>>(new Set())
  const [timer, setTimer] = useState(0)
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState("")
  const dragActive = useRef(false)

  useEffect(() => {
    const init = async () => {
      const stored = localStorage.getItem(USER_ID_STORAGE_KEY)
      if (!stored) {
        router.push("/")
        return
      }
      setUserId(stored)
      const data = await fetch("/api/puzzle/today").then((r) => r.json())
      setPuzzle(data)
    }
    void init()
  }, [router])

  useEffect(() => {
    if (!running) {
      return
    }
    const id = setInterval(() => setTimer((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [running])

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        setRunning(false)
      } else if (
        path.length === 0 &&
        foundWords.length < (puzzle?.wordsCount ?? 0)
      ) {
        setRunning(true)
      }
    }
    document.addEventListener("visibilitychange", onVisibility)
    return () => document.removeEventListener("visibilitychange", onVisibility)
  }, [path.length, foundWords.length, puzzle?.wordsCount])

  const canComplete = puzzle && foundWords.length === puzzle.wordsCount

  useEffect(() => {
    if (!canComplete || !userId) {
      return
    }
    const finish = async () => {
      const res = await fetch("/api/puzzle/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          completionTimeSeconds: timer,
          timezoneOffsetMinutes: new Date().getTimezoneOffset(),
        }),
      }).then((r) => r.json())

      localStorage.setItem("strand_last_result_date", puzzle.date)
      localStorage.setItem(
        "strand_last_result",
        JSON.stringify({
          theme: puzzle.theme,
          timeSeconds: timer,
          wordsFound: foundWords.length,
          totalWords: puzzle.wordsCount,
          spangramFound,
          rank: res.rank,
          streak: res.streak,
          completedDates: res.completedDates,
        })
      )
      router.push("/results")
    }
    void finish()
  }, [
    canComplete,
    foundWords.length,
    puzzle,
    router,
    spangramFound,
    timer,
    userId,
  ])

  const grid = useMemo(() => puzzle?.grid ?? [], [puzzle?.grid])

  const pushCell = (cell: Cell) => {
    if (foundCells.has(cellKey(cell))) {
      return
    }
    setPath((prev) => {
      if (prev.length === 0) {
        setRunning(true)
        return [cell]
      }
      const last = prev[prev.length - 1]
      if (!isAdjacent(last, cell)) {
        return prev
      }
      const k = cellKey(cell)
      if (prev.some((p) => cellKey(p) === k)) {
        return prev
      }
      return [...prev, cell]
    })
  }

  const onEnd = async () => {
    if (!path.length || !userId) {
      dragActive.current = false
      return
    }

    const res = await fetch("/api/puzzle/trace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, path }),
    }).then((r) => r.json())

    if (res.valid) {
      if (foundWords.includes(res.word)) {
        setMessage("Already found!")
      } else {
        setFoundWords((prev) => [...prev, res.word])
        setFoundCells((prev) => {
          const next = new Set(prev)
          for (const c of path) {
            next.add(cellKey(c))
          }
          return next
        })
        if (res.isSpangram) {
          setSpangramFound(true)
        }
        setMessage("Word found")
      }
    } else {
      setMessage("Invalid path")
    }

    setPath([])
    dragActive.current = false
    setTimeout(() => setMessage(""), 900)
  }

  return (
    <AppShell>
      <header className="mb-3 flex items-center justify-between rounded-xl bg-transparent p-2">
        <Link href="/" className="rounded-full bg-black p-2">
          <Icon src={DLS.assets.home} alt="home" size={20} />
        </Link>
        <div className="text-lg font-semibold">{puzzle?.date ?? "Daily"}</div>
        <div className="rounded-full bg-black px-3 py-2 text-sm font-semibold text-white">
          {mmss(timer)}
        </div>
      </header>

      <Card className="mb-3">
        <h1 className="text-2xl font-bold">{puzzle?.theme ?? "Loading..."}</h1>
      </Card>

      <Card className="mb-3">
        <div
          className="grid grid-cols-9 gap-1"
          onPointerUp={onEnd}
          onPointerLeave={() => {
            if (dragActive.current) {
              void onEnd()
            }
          }}
        >
          {grid.flatMap((row, r) =>
            row.map((char, c) => {
              const k = `${r},${c}`
              const isPath = path.some((p) => p.row === r && p.col === c)
              const isFound = foundCells.has(k)
              const cls = isFound
                ? spangramFound && isPath
                  ? "bg-orange-500 text-white"
                  : "bg-green-600 text-white"
                : isPath
                  ? "bg-black text-white"
                  : "bg-white"

              return (
                <button
                  key={k}
                  type="button"
                  className={`aspect-square rounded-md border border-black text-lg font-bold ${cls}`}
                  onPointerDown={() => {
                    dragActive.current = true
                    pushCell({ row: r, col: c })
                  }}
                  onPointerEnter={() => {
                    if (dragActive.current) {
                      pushCell({ row: r, col: c })
                    }
                  }}
                >
                  {char}
                </button>
              )
            })
          )}
        </div>
      </Card>

      <Card>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Found Words</h2>
          <span className="text-sm font-semibold">
            {foundWords.length}/{puzzle?.wordsCount ?? 0}
          </span>
        </div>
        {foundWords.length ? (
          <div className="flex flex-wrap gap-2">
            {foundWords.map((w) => (
              <span
                key={w}
                className="rounded-full bg-black px-3 py-1 text-xs font-semibold text-white"
              >
                {w}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm">No words found yet.</p>
        )}
      </Card>

      {message && (
        <p className="mt-2 text-center text-sm font-semibold">{message}</p>
      )}
    </AppShell>
  )
}
