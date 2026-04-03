import { NextRequest, NextResponse } from "next/server"

const suggestionsBySeed: Record<string, string[]> = {
  SPACE: [
    "Solar System",
    "Moon Landing",
    "Mars Mission",
    "Astronaut Life",
    "Deep Space",
    "NASA History",
  ],
  OCEAN: [
    "Coral Reef",
    "Sea Creatures",
    "Tidal World",
    "Ocean Currents",
    "Island Life",
    "Deep Sea",
  ],
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { prompt?: string }
  const upper = (body.prompt ?? "space").toUpperCase()
  const key = upper.includes("OCEAN") ? "OCEAN" : "SPACE"
  return NextResponse.json({ suggestions: suggestionsBySeed[key] })
}
