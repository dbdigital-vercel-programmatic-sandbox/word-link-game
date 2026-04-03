export function ymdFromOffset(iso: string, timezoneOffsetMinutes: number) {
  const ms = new Date(iso).getTime() - timezoneOffsetMinutes * 60_000
  const d = new Date(ms)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, "0")
  const day = String(d.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function todayUtcYmd() {
  return new Date().toISOString().slice(0, 10)
}

export function addDays(ymd: string, delta: number) {
  const d = new Date(`${ymd}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}

export function mmss(total: number) {
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

export function nextMidnightCountdown() {
  const now = new Date()
  const next = new Date(now)
  next.setHours(24, 0, 0, 0)
  return Math.max(0, Math.floor((next.getTime() - now.getTime()) / 1000))
}
