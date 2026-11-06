import { db } from "@/lib/db"
import type { DbExecutor } from "@/lib/db"
import { project, work } from "@/lib/db/schema"
import { validateRequiredWorkFields } from "@/lib/domain-rules"
import { and, desc, eq, ilike, inArray, isNotNull, ne, or, sql } from "drizzle-orm"
import { getGenreNameById, getGenreNamesByIds } from "@/modules/genres"
import { getAccountNamesByIds } from "@/modules/identity"
import { getMusicianDisplayNames } from "@/modules/profiles"

export type WorkInput = {
  title: string
  artist: string
  genreId?: number | null
  projectId?: number | null
  createdDate?: string | null
  releasedDate?: string | null
  duration?: number | null
  composer?: string | null
  lyricist?: string | null
  producer?: string | null
  recording?: string | null
  version?: string | null
  audioUrl: string
  artworkUrl?: string | null
  lyrics?: string | null
  fileSize?: number | null
  format?: string | null
}

export type PublishedWorkSummary = {
  id: number
  title: string
  artist: string
  artworkUrl: string | null
  duration: number | null
  audioUrl: string
  genreName: string | null
  musicianName: string | null
  musicianId: string
}

export type WorkLabel = {
  id: number
  title: string
  artist: string
}

export const WORK_DELETION_PENDING = "DELETION_PENDING"

type AdminWorkRow = {
  id: number
  title: string
  artist: string
  artworkUrl: string | null
  status: string
  duration: number | null
  audioUrl: string
  genreName: string | null
  ownerName: string | null
  createdAt: Date
}

function cleanValue(value?: string | null): string | null {
  if (value == null) return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

export async function isPublishedWork(id: number) {
  const [publishedWork] = await db
    .select({ id: work.id })
    .from(work)
    .where(and(eq(work.id, id), eq(work.status, "PUBLISHED")))
    .limit(1)
  return Boolean(publishedWork)
}

export async function getWorkLabelsByIds(ids: number[]): Promise<WorkLabel[]> {
  if (ids.length === 0) return []

  return db
    .select({ id: work.id, title: work.title, artist: work.artist })
    .from(work)
    .where(inArray(work.id, ids))
}

export async function getPublishedWorkReporterId(id: number) {
  const [publishedWork] = await db
    .select({ userId: work.userId })
    .from(work)
    .where(and(eq(work.id, id), eq(work.status, "PUBLISHED")))
    .limit(1)
  return publishedWork?.userId ?? null
}

export async function getPublishedWorksByIds(ids: number[]): Promise<PublishedWorkSummary[]> {
  if (ids.length === 0) return []

  const works = await db
    .select({
      id: work.id,
      title: work.title,
      artist: work.artist,
      artworkUrl: sql<string | null>`coalesce(${project.artworkUrl}, ${work.artworkUrl})`,
      duration: work.duration,
      audioUrl: work.audioUrl,
      genreId: work.genreId,
      musicianId: work.userId,
    })
    .from(work)
    .leftJoin(project, eq(work.projectId, project.id))
    .where(and(inArray(work.id, ids), eq(work.status, "PUBLISHED")))
  const genreNames = new Map(
    (
      await getGenreNamesByIds([
        ...new Set(works.flatMap(({ genreId }) => (genreId === null ? [] : [genreId]))),
      ])
    ).map(({ id, name }) => [id, name]),
  )
  const musicianNames = new Map(
    (await getMusicianDisplayNames([...new Set(works.map(({ musicianId }) => musicianId))]))
      .map(({ userId, displayName }) => [userId, displayName]),
  )

  return works.map((work) => {
    const { genreId, ...summary } = work
    return {
      ...summary,
      genreName: genreId === null ? null : genreNames.get(genreId) ?? null,
      musicianName: musicianNames.get(work.musicianId) ?? null,
    }
  })
}

async function getAdminWorkRows(query?: string, limit?: number): Promise<AdminWorkRow[]> {
  const base = db
    .select({
      id: work.id,
      title: work.title,
      artist: work.artist,
      artworkUrl: sql<string | null>`coalesce(${project.artworkUrl}, ${work.artworkUrl})`,
      status: work.status,
      duration: work.duration,
      audioUrl: work.audioUrl,
      genreId: work.genreId,
      userId: work.userId,
      createdAt: work.createdAt,
    })
    .from(work)
    .leftJoin(project, eq(work.projectId, project.id))
  const orderedRows = query?.trim()
    ? base.where(or(ilike(work.title, `%${query}%`), ilike(work.artist, `%${query}%`))!).orderBy(desc(work.createdAt))
    : base.orderBy(desc(work.createdAt))
  const rows = limit === undefined ? await orderedRows : await orderedRows.limit(limit)
  const genreIds = [...new Set(rows.flatMap(({ genreId }) => (genreId === null ? [] : [genreId])))]
  const userIds = [...new Set(rows.map(({ userId }) => userId))]
  const [genres, accounts] = await Promise.all([
    getGenreNamesByIds(genreIds),
    getAccountNamesByIds(userIds),
  ])
  const genreNames = new Map(genres.map(({ id, name }) => [id, name]))
  const accountNames = new Map(accounts.map(({ id, name }) => [id, name]))

  return rows.map(({ genreId, userId, ...row }) => ({
    ...row,
    genreName: genreId === null ? null : genreNames.get(genreId) ?? null,
    ownerName: accountNames.get(userId) ?? null,
  }))
}

export async function getAdminWorks(query?: string) {
  return getAdminWorkRows(query)
}

export async function getRecentAdminWorks(limit = 4) {
  const rows = await getAdminWorkRows(undefined, limit)
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    artist: row.artist,
    artworkUrl: row.artworkUrl,
    status: row.status,
    genreName: row.genreName,
    ownerName: row.ownerName,
    createdAt: row.createdAt,
  }))
}

export async function getArchiveCounts() {
  const [works, projects] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(work),
    db.select({ count: sql<number>`count(*)::int` }).from(project),
  ])
  return {
    totalWorks: works[0]?.count ?? 0,
    totalProjects: projects[0]?.count ?? 0,
  }
}

export async function getWorkCountsByGenre() {
  return db
    .select({
      genreId: work.genreId,
      count: sql<number>`count(*)::int`,
    })
    .from(work)
    .where(isNotNull(work.genreId))
    .groupBy(work.genreId)
}

export async function getWorkCountsByUserIds(userIds: string[]) {
  if (userIds.length === 0) return []

  return db
    .select({
      userId: work.userId,
      count: sql<number>`count(*)::int`,
    })
    .from(work)
    .where(inArray(work.userId, userIds))
    .groupBy(work.userId)
}

export async function createWork(userId: string, input: WorkInput) {
  validateRequiredWorkFields(input)
  if (input.genreId != null) {
    if ((await getGenreNameById(input.genreId)) === null) throw new Error("Selected genre was not found")
  }
  if (input.projectId != null) {
    const [selectedProject] = await db
      .select({ id: project.id })
      .from(project)
      .where(and(eq(project.id, input.projectId), eq(project.userId, userId)))
      .limit(1)
    if (!selectedProject) throw new Error("Selected project does not belong to this account")
  }

  const [created] = await db
    .insert(work)
    .values({
      userId,
      title: input.title.trim(),
      artist: input.artist.trim(),
      genreId: input.genreId ?? null,
      projectId: input.projectId ?? null,
      createdDate: cleanValue(input.createdDate),
      releasedDate: cleanValue(input.releasedDate),
      duration: input.duration ?? null,
      composer: cleanValue(input.composer),
      lyricist: cleanValue(input.lyricist),
      producer: cleanValue(input.producer),
      recording: cleanValue(input.recording),
      version: cleanValue(input.version),
      audioUrl: input.audioUrl,
      artworkUrl: input.projectId == null ? cleanValue(input.artworkUrl) : null,
      lyrics: cleanValue(input.lyrics),
      fileSize: input.fileSize ?? null,
      format: cleanValue(input.format),
      status: "PUBLISHED",
    })
    .returning({ id: work.id })

  return created.id
}

export async function updateWork(userId: string, id: number, input: WorkInput) {
  validateRequiredWorkFields(input)
  const [existingWork] = await db
    .select({ projectId: work.projectId, artworkUrl: work.artworkUrl })
    .from(work)
    .where(and(eq(work.id, id), eq(work.userId, userId)))
    .limit(1)
  if (!existingWork) throw new Error("Work was not found or is not owned by this account")

  if (input.genreId != null) {
    if ((await getGenreNameById(input.genreId)) === null) throw new Error("Selected genre was not found")
  }
  if (input.projectId != null) {
    const [selectedProject] = await db
      .select({ id: project.id })
      .from(project)
      .where(and(eq(project.id, input.projectId), eq(project.userId, userId)))
      .limit(1)
    if (!selectedProject) throw new Error("Selected project does not belong to this account")
  }

  let artworkUrl = cleanValue(input.artworkUrl)
  if (existingWork.projectId && existingWork.projectId !== (input.projectId ?? null)) {
    const [previousProject] = await db
      .select({ artworkUrl: project.artworkUrl })
      .from(project)
      .where(and(eq(project.id, existingWork.projectId), eq(project.userId, userId)))
      .limit(1)
    artworkUrl = previousProject?.artworkUrl ?? artworkUrl
  }

  const [updated] = await db
    .update(work)
    .set({
      title: input.title.trim(),
      artist: input.artist.trim(),
      genreId: input.genreId ?? null,
      projectId: input.projectId ?? null,
      createdDate: cleanValue(input.createdDate),
      releasedDate: cleanValue(input.releasedDate),
      duration: input.duration ?? null,
      composer: cleanValue(input.composer),
      lyricist: cleanValue(input.lyricist),
      producer: cleanValue(input.producer),
      recording: cleanValue(input.recording),
      version: cleanValue(input.version),
      audioUrl: input.audioUrl,
      artworkUrl,
      lyrics: cleanValue(input.lyrics),
      fileSize: input.fileSize ?? null,
      format: cleanValue(input.format),
      updatedAt: new Date(),
    })
    .where(and(eq(work.id, id), eq(work.userId, userId)))
    .returning({ id: work.id, genreId: work.genreId })

  if (!updated) throw new Error("Work was not found or is not owned by this account")
  if (updated.genreId !== (input.genreId ?? null)) {
    throw new Error("Work genre was not updated")
  }
}

export async function deleteWork(userId: string, id: number) {
  const [deleted] = await db
    .delete(work)
    .where(and(eq(work.id, id), eq(work.userId, userId), ne(work.status, WORK_DELETION_PENDING)))
    .returning({ id: work.id })
  if (deleted) return

  const [pendingWork] = await db
    .select({ id: work.id })
    .from(work)
    .where(and(eq(work.id, id), eq(work.userId, userId), eq(work.status, WORK_DELETION_PENDING)))
    .limit(1)
  if (pendingWork) throw new Error("This work is pending permanent deletion and cannot be deleted here")
}

export async function deleteWorkForAdmin(id: number, executor: DbExecutor = db) {
  await executor.delete(work).where(eq(work.id, id))
}

export async function setWorkStatus(id: number, status: string, executor: DbExecutor = db) {
  const [updated] = await executor
    .update(work)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(work.id, id), ne(work.status, WORK_DELETION_PENDING)))
    .returning({ id: work.id })
  if (updated) return

  const [pendingWork] = await executor
    .select({ id: work.id })
    .from(work)
    .where(and(eq(work.id, id), eq(work.status, WORK_DELETION_PENDING)))
    .limit(1)
  if (pendingWork) throw new Error("This work is pending permanent deletion and its status cannot be changed")
}

export async function markWorkDeletionPending(id: number, executor: DbExecutor = db) {
  const [marked] = await executor
    .update(work)
    .set({ status: WORK_DELETION_PENDING, updatedAt: new Date() })
    .where(eq(work.id, id))
    .returning({ id: work.id })
  return Boolean(marked)
}

export async function clearWorkGenreReferences(genreId: number, executor: DbExecutor = db) {
  await executor.update(work).set({ genreId: null }).where(eq(work.genreId, genreId))
}

export async function incrementPlayCount(id: number) {
  await db
    .update(work)
    .set({ playCount: sql`${work.playCount} + 1` })
    .where(and(eq(work.id, id), eq(work.status, "PUBLISHED")))
}

export async function getMyWorks(userId: string) {
  const rows = await db
    .select({
      id: work.id,
      title: work.title,
      artist: work.artist,
      artworkUrl: sql<string | null>`coalesce(${project.artworkUrl}, ${work.artworkUrl})`,
      version: work.version,
      releasedDate: work.releasedDate,
      duration: work.duration,
      genreId: work.genreId,
      projectId: work.projectId,
      projectTitle: project.title,
      createdAt: work.createdAt,
    })
    .from(work)
    .leftJoin(project, eq(work.projectId, project.id))
    .where(eq(work.userId, userId))
    .orderBy(desc(work.createdAt))
  const genreNames = new Map(
    (
      await getGenreNamesByIds([
        ...new Set(rows.flatMap(({ genreId }) => (genreId === null ? [] : [genreId]))),
      ])
    ).map(({ id, name }) => [id, name]),
  )

  return rows.map(({ genreId, ...row }) => ({
    ...row,
    genreName: genreId === null ? null : genreNames.get(genreId) ?? null,
  }))
}

export async function getMyWork(userId: string, id: number) {
  const [row] = await db
    .select({
      work: work,
      projectTitle: project.title,
      projectArtworkUrl: project.artworkUrl,
    })
    .from(work)
    .leftJoin(project, eq(work.projectId, project.id))
    .where(and(eq(work.id, id), eq(work.userId, userId)))
    .limit(1)
  if (!row) return null
  const genreName = row.work.genreId === null ? null : await getGenreNameById(row.work.genreId)
  return { ...row, genreName }
}

export async function getMyStats(userId: string) {
  const [worksCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(work)
    .where(eq(work.userId, userId))
  const [projectsCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(project)
    .where(eq(project.userId, userId))
  return {
    totalWorks: worksCount?.count ?? 0,
    totalProjects: projectsCount?.count ?? 0,
  }
}
