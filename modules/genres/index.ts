import { db } from "@/lib/db"
import type { DbExecutor } from "@/lib/db"
import { genre } from "@/lib/db/schema"
import { eq, inArray, sql } from "drizzle-orm"

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export async function getGenres() {
  return db.select({ id: genre.id, name: genre.name, slug: genre.slug }).from(genre).orderBy(genre.name)
}

export async function getGenreCount() {
  const [result] = await db.select({ count: sql<number>`count(*)::int` }).from(genre)
  return result?.count ?? 0
}

export async function getGenreNameById(id: number) {
  const [selectedGenre] = await db
    .select({ name: genre.name })
    .from(genre)
    .where(eq(genre.id, id))
    .limit(1)
  return selectedGenre?.name ?? null
}

export async function getGenreNamesByIds(ids: number[]) {
  if (ids.length === 0) return []

  return db
    .select({ id: genre.id, name: genre.name })
    .from(genre)
    .where(inArray(genre.id, ids))
}

export async function createGenre(name: string) {
  if (!name?.trim()) throw new Error("Name is required")
  await db
    .insert(genre)
    .values({ name: name.trim(), slug: slugify(name) })
    .onConflictDoNothing()
}

export async function deleteGenreRecord(id: number, executor: DbExecutor = db) {
  await executor.delete(genre).where(eq(genre.id, id))
}
