import { db } from "@/lib/db"
import { genre, musicianProfile, project, work } from "@/lib/db/schema"
import { and, desc, eq, ilike, or, sql } from "drizzle-orm"
import { getPublicMusicianProfile as getProfileFromModule } from "@/modules/profiles"

const PUBLISHED = eq(work.status, "PUBLISHED")

export type PublicWork = {
  id: number
  title: string
  artist: string
  artworkUrl: string | null
  audioUrl: string
  duration: number | null
  genreName: string | null
  projectTitle: string | null
  musicianName: string | null
  musicianId: string
}

const publicWorkColumns = {
  id: work.id,
  title: work.title,
  artist: work.artist,
  artworkUrl: sql<string | null>`coalesce(${project.artworkUrl}, ${work.artworkUrl})`,
  audioUrl: work.audioUrl,
  duration: work.duration,
  genreName: genre.name,
  projectTitle: project.title,
  musicianName: musicianProfile.displayName,
  musicianId: work.userId,
}

export async function getFeaturedWorks(limit = 12) {
  return db
    .select(publicWorkColumns)
    .from(work)
    .leftJoin(genre, eq(work.genreId, genre.id))
    .leftJoin(project, eq(work.projectId, project.id))
    .leftJoin(musicianProfile, eq(work.userId, musicianProfile.userId))
    .where(PUBLISHED)
    .orderBy(desc(work.createdAt))
    .limit(limit)
}

export async function getPopularWorks(limit = 12) {
  return db
    .select(publicWorkColumns)
    .from(work)
    .leftJoin(genre, eq(work.genreId, genre.id))
    .leftJoin(project, eq(work.projectId, project.id))
    .leftJoin(musicianProfile, eq(work.userId, musicianProfile.userId))
    .where(PUBLISHED)
    .orderBy(desc(work.playCount), desc(work.createdAt))
    .limit(limit)
}

export async function searchWorks(query: string, genreId?: number) {
  const conditions = [PUBLISHED]
  if (query?.trim()) {
    conditions.push(
      or(
        ilike(work.title, `%${query}%`),
        ilike(work.artist, `%${query}%`),
        ilike(musicianProfile.displayName, `%${query}%`),
        ilike(project.title, `%${query}%`),
      )!,
    )
  }
  if (genreId) conditions.push(eq(work.genreId, genreId))

  return db
    .select(publicWorkColumns)
    .from(work)
    .leftJoin(genre, eq(work.genreId, genre.id))
    .leftJoin(project, eq(work.projectId, project.id))
    .leftJoin(musicianProfile, eq(work.userId, musicianProfile.userId))
    .where(and(...conditions))
    .orderBy(desc(work.createdAt))
    .limit(50)
}

export async function getWorkDetail(id: number) {
  const [row] = await db
    .select({
      id: work.id,
      title: work.title,
      artist: work.artist,
      artworkUrl: sql<string | null>`coalesce(${project.artworkUrl}, ${work.artworkUrl})`,
      audioUrl: work.audioUrl,
      duration: work.duration,
      composer: work.composer,
      lyricist: work.lyricist,
      producer: work.producer,
      recording: work.recording,
      version: work.version,
      lyrics: work.lyrics,
      releasedDate: work.releasedDate,
      createdDate: work.createdDate,
      format: work.format,
      genreName: genre.name,
      projectTitle: project.title,
      musicianId: work.userId,
      musicianName: musicianProfile.displayName,
      musicianImage: musicianProfile.imageUrl,
    })
    .from(work)
    .leftJoin(genre, eq(work.genreId, genre.id))
    .leftJoin(project, eq(work.projectId, project.id))
    .leftJoin(musicianProfile, eq(work.userId, musicianProfile.userId))
    .where(and(eq(work.id, id), PUBLISHED))
    .limit(1)
  return row ?? null
}

export async function getMusicianPublicProfile(musicianId: string) {
  const profile = await getProfileFromModule(musicianId)
  if (!profile) return null

  const works = await db
    .select(publicWorkColumns)
    .from(work)
    .leftJoin(genre, eq(work.genreId, genre.id))
    .leftJoin(project, eq(work.projectId, project.id))
    .leftJoin(musicianProfile, eq(work.userId, musicianProfile.userId))
    .where(and(eq(work.userId, musicianId), PUBLISHED))
    .orderBy(desc(work.createdAt))

  return { profile, works }
}
