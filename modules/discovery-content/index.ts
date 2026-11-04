import { db } from "@/lib/db"
import { discoverHero } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"

export async function getDiscoverHeroImage() {
  const [hero] = await db
    .select({ imageUrl: discoverHero.imageUrl })
    .from(discoverHero)
    .where(and(eq(discoverHero.id, 1), eq(discoverHero.status, "PUBLISHED")))
    .limit(1)
  return hero?.imageUrl ?? null
}

export async function getAdminDiscoverHeroImage() {
  const [hero] = await db
    .select({ imageUrl: discoverHero.imageUrl })
    .from(discoverHero)
    .where(eq(discoverHero.id, 1))
    .limit(1)
  return hero?.imageUrl ?? null
}

function validateDiscoverHeroImage(imageUrl: string): string {
  const normalizedImageUrl = imageUrl.trim()
  if (!normalizedImageUrl) throw new Error("An image is required")
  let parsedImageUrl: URL
  try {
    parsedImageUrl = new URL(normalizedImageUrl)
  } catch {
    throw new Error("Image URL is invalid")
  }
  if (parsedImageUrl.protocol !== "https:" && parsedImageUrl.protocol !== "http:") {
    throw new Error("Image URL must use HTTP or HTTPS")
  }
  return normalizedImageUrl
}

export async function setDiscoverHeroImage(imageUrl: string | null) {
  if (imageUrl === null || !imageUrl.trim()) {
    await db.delete(discoverHero).where(eq(discoverHero.id, 1))
  } else {
    const normalizedImageUrl = validateDiscoverHeroImage(imageUrl)
    await db
      .insert(discoverHero)
      .values({ id: 1, title: "Discover background", imageUrl: normalizedImageUrl, status: "PUBLISHED" })
      .onConflictDoUpdate({
        target: discoverHero.id,
        set: { title: "Discover background", imageUrl: normalizedImageUrl, status: "PUBLISHED", updatedAt: new Date() },
      })
  }
}
