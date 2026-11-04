import { NextResponse } from "next/server"
import { getMobileUser } from "@/lib/mobile-auth"
import { getLibraryForUser } from "@/modules/library"

export async function GET(request: Request) {
  const user = await getMobileUser(request)
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 })
  if (user.role !== "AUDIENCE") return NextResponse.json({ error: "Audience account required" }, { status: 403 })

  const data = await getLibraryForUser(user.id)
  return NextResponse.json({ data })
}
