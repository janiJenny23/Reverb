import { NextRequest, NextResponse } from "next/server"
import { getFeaturedWorks, searchWorks } from "@/modules/discovery"

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? ""
  const genreValue = request.nextUrl.searchParams.get("genre")
  const genreId = genreValue ? Number(genreValue) : undefined
  if (genreValue && (genreId === undefined || !Number.isInteger(genreId) || genreId <= 0)) {
    return NextResponse.json({ error: "genre must be a positive integer" }, { status: 400 })
  }

  const works = query || genreId ? await searchWorks(query, genreId) : await getFeaturedWorks(50)
  return NextResponse.json({
    data: works,
    meta: { count: works.length, query: query || null, genreId: genreId ?? null },
  })
}
