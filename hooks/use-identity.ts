"use client"

import { useEffect, useState } from "react"

import { USER_ID_STORAGE_KEY } from "@/lib/dls"

type IdentityState = {
  userId: string
  displayName: string
  streak: number
  completedDates: string[]
}

export function useIdentity() {
  const [identity, setIdentity] = useState<IdentityState | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      const localId = localStorage.getItem(USER_ID_STORAGE_KEY) ?? undefined
      const res = await fetch("/api/user/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(localId ? { userId: localId } : {}),
      })
      const data = (await res.json()) as IdentityState
      localStorage.setItem(USER_ID_STORAGE_KEY, data.userId)
      setIdentity(data)
      setLoading(false)
    }
    void init()
  }, [])

  return { identity, setIdentity, loading }
}
