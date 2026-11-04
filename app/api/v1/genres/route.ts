import { NextResponse } from "next/server"
import { getGenres } from "@/modules/genres"

export async function GET() {
  const genres = await getGenres()
  return NextResponse.json({ data: genres, meta: { count: genres.length } })
}
