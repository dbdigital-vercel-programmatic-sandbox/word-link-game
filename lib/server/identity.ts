import { randomUUID } from "node:crypto"

import { todayUtcYmd } from "@/lib/server/date"
import { store } from "@/lib/server/store"
import { UserRecord } from "@/lib/types"

const adjectives = [
  "Quick",
  "Blue",
  "Swift",
  "Bright",
  "Calm",
  "Lucky",
  "Solar",
  "Neon",
]
const animals = [
  "Fox",
  "Tiger",
  "Owl",
  "Whale",
  "Falcon",
  "Otter",
  "Wolf",
  "Lynx",
]

function randomDisplayName() {
  const a = adjectives[Math.floor(Math.random() * adjectives.length)]
  const b = animals[Math.floor(Math.random() * animals.length)]
  const n = Math.floor(Math.random() * 90) + 10
  return `${a}${b}${n}`
}

export function getOrCreateUser(candidateUserId?: string) {
  if (candidateUserId && store.users.has(candidateUserId)) {
    const u = store.users.get(candidateUserId) as UserRecord
    u.lastActiveDate = todayUtcYmd()
    return u
  }

  const userId = randomUUID()
  const now = new Date().toISOString()
  const user: UserRecord = {
    userId,
    displayName: randomDisplayName(),
    createdAt: now,
    lastActiveDate: todayUtcYmd(),
    completedDates: [],
    currentStreak: 0,
    longestStreak: 0,
  }
  store.users.set(userId, user)
  return user
}

export function updateDisplayName(userId: string, displayName: string) {
  const user = store.users.get(userId)
  if (!user) {
    throw new Error("USER_NOT_FOUND")
  }

  const today = todayUtcYmd()
  if (user.lastDisplayNameChangeDate === today) {
    throw new Error("DISPLAY_NAME_RATE_LIMIT")
  }

  user.displayName = displayName.trim()
  user.lastDisplayNameChangeDate = today
  return user
}

export function anonymizeUser(userId: string) {
  const user = store.users.get(userId)
  if (!user) {
    return false
  }

  user.displayName = "Anonymous"
  user.completedDates = []
  user.currentStreak = 0
  user.longestStreak = 0

  store.completions = store.completions.filter((c) => c.userId !== userId)
  return true
}
