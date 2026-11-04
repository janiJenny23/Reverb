import { db } from "@/lib/db"
import { musicianProfile } from "@/lib/db/schema"
import { eq, inArray } from "drizzle-orm"
import { getAccountNamesByIds, setUserDisplayName } from "@/modules/identity"

export type ProfileInput = {
  displayName: string
  bio?: string | null
  primaryGenre?: string | null
  imageUrl?: string | null
}

function clean(value?: string | null): string | null {
  if (value == null) return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

export async function getMusicianProfile(userId: string) {
  const [profile] = await db
    .select()
    .from(musicianProfile)
    .where(eq(musicianProfile.userId, userId))
    .limit(1)
  return profile ?? null
}

export async function getPublicMusicianProfile(userId: string) {
  const [profile, accounts] = await Promise.all([
    getMusicianProfile(userId),
    getAccountNamesByIds([userId]),
  ])
  const account = accounts[0]
  if (!account) return null

  return {
    userId,
    displayName: profile?.displayName ?? null,
    bio: profile?.bio ?? null,
    primaryGenre: profile?.primaryGenre ?? null,
    imageUrl: profile?.imageUrl ?? null,
    accountName: account.name,
  }
}

export async function getMusicianDisplayNames(userIds: string[]) {
  if (userIds.length === 0) return []

  return db
    .select({ userId: musicianProfile.userId, displayName: musicianProfile.displayName })
    .from(musicianProfile)
    .where(inArray(musicianProfile.userId, userIds))
}

export async function getMusicianProfilesByUserIds(userIds: string[]) {
  if (userIds.length === 0) return []

  return db
    .select({
      userId: musicianProfile.userId,
      displayName: musicianProfile.displayName,
      primaryGenre: musicianProfile.primaryGenre,
      imageUrl: musicianProfile.imageUrl,
    })
    .from(musicianProfile)
    .where(inArray(musicianProfile.userId, userIds))
}

export async function saveMusicianProfile(userId: string, input: ProfileInput) {
  const displayName = input.displayName?.trim()
  if (!displayName) throw new Error("Display name is required")

  const profileValues = {
    displayName,
    bio: clean(input.bio),
    primaryGenre: clean(input.primaryGenre),
    imageUrl: clean(input.imageUrl),
  }

  await db.transaction(async (transaction) => {
    const [existing] = await transaction
      .select({ id: musicianProfile.id })
      .from(musicianProfile)
      .where(eq(musicianProfile.userId, userId))
      .limit(1)

    if (existing) {
      await transaction
        .update(musicianProfile)
        .set({ ...profileValues, updatedAt: new Date() })
        .where(eq(musicianProfile.userId, userId))
    } else {
      await transaction.insert(musicianProfile).values({ userId, ...profileValues })
    }

    await setUserDisplayName(userId, displayName, transaction)
  })
}
