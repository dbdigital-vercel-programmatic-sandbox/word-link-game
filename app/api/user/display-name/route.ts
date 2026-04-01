import { NextRequest, NextResponse } from "next/server"

import { updateDisplayName } from "@/lib/server/identity"

export async function PATCH(request: NextRequest) {
  const body = (await request.json()) as { userId: string; displayName: string }
  try {
    const user = updateDisplayName(body.userId, body.displayName)
    return NextResponse.json({
      userId: user.userId,
      displayName: user.displayName,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN"
    if (message === "DISPLAY_NAME_RATE_LIMIT") {
      return NextResponse.json(
        { error: "Display name can only change once per day." },
        { status: 429 }
      )
    }
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }
}
