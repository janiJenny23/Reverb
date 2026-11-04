import { db } from "@/lib/db"
import type { DbExecutor } from "@/lib/db"
import { favorite } from "@/lib/db/schema"
import { and, desc, eq } from "drizzle-orm"
import { getPublishedWorksByIds, isPublishedWork } from "@/modules/archive"

export class WorkUnavailableError extends Error {
  constructor() {
    super("This work is not available")
    this.name = "WorkUnavailableError"
  }
}

export async function toggleFavoriteForUser(userId: string, workId: number) {
  if (!(await isPublishedWork(workId))) {
    throw new WorkUnavailableError()
  }

  const [existing] = await db
    .select({ id: favorite.id })
    .from(favorite)
    .where(and(eq(favorite.userId, userId), eq(favorite.workId, workId)))
    .limit(1)

  if (existing) {
    await db.delete(favorite).where(eq(favorite.id, existing.id))
    return { favorited: false }
  }

  await db.insert(favorite).values({ userId, workId })
  return { favorited: true }
}

export async function isFavoriteForUser(userId: string, workId: number) {
  const [existing] = await db
    .select({ id: favorite.id })
    .from(favorite)
    .where(and(eq(favorite.userId, userId), eq(favorite.workId, workId)))
    .limit(1)

  return Boolean(existing)
}

export async function getFavoriteIdsForUser(userId: string) {
  const rows = await db
    .select({ workId: favorite.workId })
    .from(favorite)
    .where(eq(favorite.userId, userId))

  return rows.map((row) => row.workId)
}

export async function deleteFavoritesForWork(workId: number, executor: DbExecutor = db) {
  await executor.delete(favorite).where(eq(favorite.workId, workId))
}

export async function getFavoritesForUser(userId: string) {
  const favoriteRows = await getOrderedFavoriteRows(userId)
  const worksById = new Map(
    (await getPublishedWorksByIds(favoriteRows.map(({ workId }) => workId))).map((work) => [work.id, work]),
  )

  return favoriteRows.flatMap(({ workId }) => {
    const work = worksById.get(workId)
    return work
      ? [{
          id: work.id,
          title: work.title,
          artist: work.artist,
          artworkUrl: work.artworkUrl,
          duration: work.duration,
          audioUrl: work.audioUrl,
          genreName: work.genreName,
          musicianName: work.musicianName,
        }]
      : []
  })
}

export async function getLibraryForUser(userId: string) {
  const favoriteRows = await getOrderedFavoriteRows(userId)
  const worksById = new Map(
    (await getPublishedWorksByIds(favoriteRows.map(({ workId }) => workId))).map((work) => [work.id, work]),
  )

  return favoriteRows.flatMap(({ workId }) => {
    const work = worksById.get(workId)
    return work
      ? [{
          id: work.id,
          title: work.title,
          artist: work.artist,
          artworkUrl: work.artworkUrl,
          audioUrl: work.audioUrl,
          duration: work.duration,
          genreName: work.genreName,
          musicianName: work.musicianName,
          musicianId: work.musicianId,
        }]
      : []
  })
}

async function getOrderedFavoriteRows(userId: string) {
  return db
    .select({ workId: favorite.workId })
    .from(favorite)
    .where(eq(favorite.userId, userId))
    .orderBy(desc(favorite.createdAt))
}
