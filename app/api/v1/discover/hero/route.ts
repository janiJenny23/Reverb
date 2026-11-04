import { NextResponse } from "next/server"
import { getDiscoverHeroImage } from "@/modules/discovery-content"

export async function GET() {
  const imageUrl = await getDiscoverHeroImage()
  return NextResponse.json({ data: { imageUrl } })
}
