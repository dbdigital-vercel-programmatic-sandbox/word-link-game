import { NextRequest, NextResponse } from "next/server"

import { completePuzzle } from "@/lib/server/puzzle-service"

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    userId: string
    completionTimeSeconds: number
    timezoneOffsetMinutes?: number
  }

  if (!body.userId || Number.isNaN(body.completionTimeSeconds)) {
    return NextResponse.json(
      { error: "userId and completionTimeSeconds required" },
      { status: 400 }
    )
  }

  try {
    const result = completePuzzle(body)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json(
      { error: "Unable to complete puzzle" },
      { status: 400 }
    )
  }
}
