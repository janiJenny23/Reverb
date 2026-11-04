import { NextResponse } from "next/server"
import { getMobileUser } from "@/lib/mobile-auth"
import {
  isFavoriteForUser,
  toggleFavoriteForUser,
  WorkUnavailableError,
} from "@/modules/library"

export async function POST(request: Request) {
  const user = await getMobileUser(request)
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 })
  if (user.role !== "AUDIENCE") return NextResponse.json({ error: "Audience account required" }, { status: 403 })

  const body = (await request.json().catch(() => null)) as { workId?: unknown } | null
  const workId = typeof body?.workId === "number" && Number.isInteger(body.workId) ? body.workId : null
  if (!workId) return NextResponse.json({ error: "workId must be an integer" }, { status: 400 })

  try {
    const result = await toggleFavoriteForUser(user.id, workId)
    return NextResponse.json({ data: { workId, favorited: result.favorited } }, {
      status: result.favorited ? 201 : 200,
    })
  } catch (error) {
    if (error instanceof WorkUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    throw error
  }
}

export async function GET(request: Request) {
  const user = await getMobileUser(request)
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 })
  if (user.role !== "AUDIENCE") return NextResponse.json({ error: "Audience account required" }, { status: 403 })
  const workId = Number(new URL(request.url).searchParams.get("workId"))
  if (!Number.isInteger(workId) || workId < 1) {
    return NextResponse.json({ error: "workId must be an integer" }, { status: 400 })
  }
  const favorited = await isFavoriteForUser(user.id, workId)
  return NextResponse.json({ data: { workId, favorited } })
}
