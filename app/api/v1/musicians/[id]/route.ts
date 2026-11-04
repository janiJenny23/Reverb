import { NextResponse } from "next/server"
import { getMusicianPublicProfile } from "@/modules/discovery"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!id.trim()) return NextResponse.json({ error: "id is required" }, { status: 400 })
  const musician = await getMusicianPublicProfile(id)
  if (!musician) return NextResponse.json({ error: "Musician not found" }, { status: 404 })
  return NextResponse.json({ data: musician })
}
