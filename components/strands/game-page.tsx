"use client"

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react"
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

type FoundTrace = {
  word: string
  path: Cell[]
  isSpangram: boolean
}

function pathSegments(path: Cell[]) {
  const segments: Array<{ from: Cell; to: Cell }> = []
  for (let i = 1; i < path.length; i += 1) {
    segments.push({ from: path[i - 1], to: path[i] })
  }
  return segments
}

export function GamePage() {
  const router = useRouter()
  const [puzzle, setPuzzle] = useState<PuzzlePayload | null>(null)
  const [userId, setUserId] = useState("")
  const [path, setPath] = useState<Cell[]>([])
  const [foundWords, setFoundWords] = useState<string[]>([])
  const [foundTraces, setFoundTraces] = useState<FoundTrace[]>([])
  const [spangramFound, setSpangramFound] = useState(false)
  const [foundCells, setFoundCells] = useState<Set<string>>(new Set())
  const [bonusWords, setBonusWords] = useState<string[]>([])
  const [hintsAvailable, setHintsAvailable] = useState(0)
  const [hintedWords, setHintedWords] = useState<string[]>([])
  const [hintedCells, setHintedCells] = useState<Set<string>>(new Set())
  const [timer, setTimer] = useState(0)
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState("")
  const dragActive = useRef(false)
  const pathRef = useRef<Cell[]>([])
  const endingTrace = useRef(false)
  const gridRef = useRef<HTMLDivElement | null>(null)

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
  const bonusProgress = bonusWords.length % 3
  const bonusMeter =
    bonusProgress === 0 && bonusWords.length > 0 ? 3 : bonusProgress
  const bonusNeeded = bonusProgress === 0 ? 3 : 3 - bonusProgress
  const ctaFill = hintsAvailable > 0 ? 100 : (bonusMeter / 3) * 100

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

  const pathKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const c of path) {
      keys.add(cellKey(c))
    }
    return keys
  }, [path])

  const boardGeometry = useMemo(() => {
    const rows = grid.length
    const cols = grid[0]?.length ?? 0
    const cell = 100
    const width = Math.max(cols * cell, 1)
    const height = Math.max(rows * cell, 1)
    const center = (c: Cell) => ({
      x: c.col * cell + cell / 2,
      y: c.row * cell + cell / 2,
    })

    return {
      width,
      height,
      foundSegments: foundTraces.flatMap((trace) =>
        pathSegments(trace.path).map((segment, index) => ({
          key: `${trace.word}-${index}`,
          stroke: trace.isSpangram ? "#facc15" : "#94d7ef",
          from: center(segment.from),
          to: center(segment.to),
        }))
      ),
      activeSegments: pathSegments(path).map((segment, index) => ({
        key: `active-${index}`,
        from: center(segment.from),
        to: center(segment.to),
      })),
    }
  }, [foundTraces, grid, path])

  const pushCell = (cell: Cell) => {
    if (foundCells.has(cellKey(cell))) {
      return
    }
    setPath((prev) => {
      let next = prev
      if (prev.length === 0) {
        setRunning(true)
        next = [cell]
      } else {
        const last = prev[prev.length - 1]
        if (!isAdjacent(last, cell)) {
          pathRef.current = prev
          return prev
        }
        const k = cellKey(cell)
        if (prev.length > 1 && k === cellKey(prev[prev.length - 2])) {
          const next = prev.slice(0, -1)
          pathRef.current = next
          return next
        }
        if (prev.some((p) => cellKey(p) === k)) {
          pathRef.current = prev
          return prev
        }
        next = [...prev, cell]
      }
      pathRef.current = next
      return next
    })
  }

  const onEnd = async () => {
    if (endingTrace.current) {
      return
    }

    const currentPath = pathRef.current
    if (!currentPath.length || !userId) {
      dragActive.current = false
      return
    }

    endingTrace.current = true

    try {
      const res = await fetch("/api/puzzle/trace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, path: currentPath }),
      }).then((r) => r.json())

      if (res.valid) {
        if (foundWords.includes(res.word)) {
          setMessage("Already found!")
        } else {
          setFoundWords((prev) => [...prev, res.word])
          setFoundTraces((prev) => [
            ...prev,
            {
              word: res.word,
              path: [...currentPath],
              isSpangram: Boolean(res.isSpangram),
            },
          ])
          setFoundCells((prev) => {
            const next = new Set(prev)
            for (const c of currentPath) {
              next.add(cellKey(c))
            }
            return next
          })
          if (res.isSpangram) {
            setSpangramFound(true)
          }
          setMessage(`Word found: ${res.word}`)
        }
      } else if (res.kind === "bonus" && res.word) {
        if (bonusWords.includes(res.word)) {
          setMessage("Bonus word already counted")
        } else {
          setBonusWords((prev) => {
            const next = [...prev, res.word]
            if (next.length % 3 === 0) {
              setHintsAvailable((h) => h + 1)
              setMessage(`Bonus word ${res.word}! Hint unlocked`)
            } else {
              const progress = next.length % 3
              setMessage(`Bonus word ${res.word}: ${progress}/3 toward hint`)
            }
            return next
          })
        }
      } else {
        setMessage("Invalid path")
      }
    } finally {
      setPath([])
      pathRef.current = []
      dragActive.current = false
      endingTrace.current = false
      setTimeout(() => setMessage(""), 900)
    }
  }

  const onPointerMoveGrid = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragActive.current) {
      return
    }
    const host = gridRef.current
    const rows = grid.length
    const cols = grid[0]?.length ?? 0
    if (!host || rows < 1 || cols < 1) {
      return
    }

    const rect = host.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
      return
    }

    const cellWidth = rect.width / cols
    const cellHeight = rect.height / rows
    const baseCol = Math.min(
      cols - 1,
      Math.max(0, Math.floor((x / rect.width) * cols))
    )
    const baseRow = Math.min(
      rows - 1,
      Math.max(0, Math.floor((y / rect.height) * rows))
    )

    let bestCell: Cell | null = null
    let bestDistance = Number.POSITIVE_INFINITY

    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        const row = baseRow + dr
        const col = baseCol + dc
        if (row < 0 || row >= rows || col < 0 || col >= cols) {
          continue
        }
        const cx = (col + 0.5) * cellWidth
        const cy = (row + 0.5) * cellHeight
        const dx = x - cx
        const dy = y - cy
        const distance = Math.hypot(dx, dy)
        if (distance < bestDistance) {
          bestDistance = distance
          bestCell = { row, col }
        }
      }
    }

    const discRadius = Math.min(cellWidth, cellHeight) * 0.36
    if (bestCell && bestDistance <= discRadius) {
      pushCell(bestCell)
    }
  }

  const handleHintClick = async () => {
    if (!userId) {
      return
    }
    if (hintsAvailable < 1) {
      setMessage("Find 3 bonus words to unlock hint")
      setTimeout(() => setMessage(""), 1200)
      return
    }

    const res = await fetch("/api/puzzle/hint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, foundWords, hintedWords }),
    })
    const data = await res.json()
    if (!res.ok) {
      setMessage(data.error ?? "No hints remaining")
      setTimeout(() => setMessage(""), 1000)
      return
    }

    setHintsAvailable((h) => Math.max(0, h - 1))
    setHintedWords((prev) => [...prev, data.word])
    setHintedCells((prev) => {
      const next = new Set(prev)
      for (const c of data.path as Cell[]) {
        next.add(cellKey(c))
      }
      return next
    })
    setMessage("Hint revealed")
    setTimeout(() => setMessage(""), 1000)
  }

  return (
    <AppShell>
      <header className="mb-3 grid grid-cols-[40px_1fr_70px] items-center rounded-xl bg-transparent p-2">
        <Link href="/" className="justify-self-start rounded-full bg-black p-2">
          <Icon src={DLS.assets.home} alt="home" size={20} />
        </Link>
        <div className="text-center text-lg font-bold">Word Connect</div>
        <div className="justify-self-end rounded-full bg-black px-3 py-2 text-sm font-semibold text-white">
          {mmss(timer)}
        </div>
      </header>

      <Card className="mb-3">
        <h1 className="text-center text-2xl font-bold">
          {puzzle?.theme ?? "Loading..."}
        </h1>
      </Card>

      <Card className="mb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Hints</p>
            <p className="text-xs">
              {hintsAvailable > 0
                ? `${hintsAvailable} available`
                : `Find ${bonusNeeded} bonus words for hint`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleHintClick()}
            className="relative overflow-hidden rounded-md border border-black px-3 py-2 text-sm font-semibold"
          >
            <span
              className="pointer-events-none absolute inset-0 bg-black/15 transition-all"
              style={{ width: `${ctaFill}%` }}
            />
            <span className="relative">Hint</span>
          </button>
        </div>
      </Card>

      <Card className="mb-3">
        <div className="relative">
          <svg
            viewBox={`0 0 ${boardGeometry.width} ${boardGeometry.height}`}
            className="pointer-events-none absolute inset-0 z-0 h-full w-full"
            aria-hidden="true"
          >
            {boardGeometry.foundSegments.map((segment) => (
              <line
                key={segment.key}
                x1={segment.from.x}
                y1={segment.from.y}
                x2={segment.to.x}
                y2={segment.to.y}
                stroke={segment.stroke}
                strokeWidth="22"
                strokeLinecap="round"
              />
            ))}
            {boardGeometry.activeSegments.map((segment) => (
              <line
                key={segment.key}
                x1={segment.from.x}
                y1={segment.from.y}
                x2={segment.to.x}
                y2={segment.to.y}
                stroke="#facc15"
                strokeWidth="22"
                strokeLinecap="round"
              />
            ))}
          </svg>

          <div
            ref={gridRef}
            className="relative z-10 grid touch-none gap-0 select-none"
            style={{
              gridTemplateColumns: `repeat(${grid[0]?.length ?? 8}, minmax(0, 1fr))`,
            }}
            onPointerUp={onEnd}
            onPointerCancel={onEnd}
            onPointerMove={onPointerMoveGrid}
            onPointerLeave={() => {
              if (dragActive.current) {
                void onEnd()
              }
            }}
          >
            {grid.flatMap((row, r) =>
              row.map((char, c) => {
                const k = `${r},${c}`
                const isPath = pathKeys.has(k)
                const isFound = foundCells.has(k)
                const isHinted = hintedCells.has(k) && !isFound
                const discClass = isPath
                  ? "bg-yellow-400"
                  : isFound
                    ? "bg-sky-200"
                    : "bg-white"

                return (
                  <button
                    key={k}
                    data-cell={`${r},${c}`}
                    type="button"
                    className="relative aspect-square touch-none"
                    onPointerDown={(event) => {
                      event.preventDefault()
                      dragActive.current = true
                      pushCell({ row: r, col: c })
                    }}
                  >
                    <span
                      className={`absolute inset-[14%] flex items-center justify-center rounded-full border-2 border-black text-lg font-bold ${discClass}`}
                    >
                      {char}
                    </span>
                    {isHinted && (
                      <span className="pointer-events-none absolute inset-[14%] rounded-full border-2 border-dashed border-black" />
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>
      </Card>

      {message && (
        <div className="pointer-events-none fixed inset-x-0 bottom-5 z-20 flex justify-center px-4">
          <p className="rounded-full bg-black px-4 py-2 text-center text-sm font-semibold text-white shadow-lg">
            {message}
          </p>
        </div>
      )}
    </AppShell>
  )
}
