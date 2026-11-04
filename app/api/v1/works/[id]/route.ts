import { NextResponse } from "next/server"
import { getWorkDetail } from "@/modules/discovery"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const workId = Number(id)
  if (!Number.isInteger(workId) || workId <= 0) {
    return NextResponse.json({ error: "id must be a positive integer" }, { status: 400 })
  }
  const work = await getWorkDetail(workId)
  if (!work) return NextResponse.json({ error: "Work not found" }, { status: 404 })
  return NextResponse.json({ data: work })
}
