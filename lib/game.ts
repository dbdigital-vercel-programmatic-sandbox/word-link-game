import { Cell } from "@/lib/types"

export function cellKey(cell: Cell) {
  return `${cell.row},${cell.col}`
}

export function isAdjacent(a: Cell, b: Cell) {
  const dr = Math.abs(a.row - b.row)
  const dc = Math.abs(a.col - b.col)
  return dr <= 1 && dc <= 1 && !(dr === 0 && dc === 0)
}

export function isValidPath(path: Cell[]) {
  const seen = new Set<string>()
  for (let i = 0; i < path.length; i++) {
    const k = cellKey(path[i])
    if (seen.has(k)) {
      return false
    }
    seen.add(k)
    if (i > 0 && !isAdjacent(path[i - 1], path[i])) {
      return false
    }
  }
  return true
}
