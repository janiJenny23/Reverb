import { db } from "@/lib/db"
import { project, work } from "@/lib/db/schema"
import { validateRequiredTitle } from "@/lib/domain-rules"
import { and, desc, eq, sql } from "drizzle-orm"

export type ProjectInput = {
  title: string
  description?: string | null
  artworkUrl?: string | null
  createdDate?: string | null
  releaseDate?: string | null
}

function clean(value?: string | null): string | null {
  if (value == null) return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

export async function createProject(userId: string, input: ProjectInput) {
  const title = validateRequiredTitle(input.title ?? "")
  const [created] = await db
    .insert(project)
    .values({
      userId,
      title,
      description: clean(input.description),
      artworkUrl: clean(input.artworkUrl),
      createdDate: clean(input.createdDate),
      releaseDate: clean(input.releaseDate),
    })
    .returning({ id: project.id })
  return created.id
}

export async function updateProject(userId: string, id: number, input: ProjectInput) {
  const title = validateRequiredTitle(input.title ?? "")
  const [updated] = await db
    .update(project)
    .set({
      title,
      description: clean(input.description),
      artworkUrl: clean(input.artworkUrl),
      createdDate: clean(input.createdDate),
      releaseDate: clean(input.releaseDate),
      updatedAt: new Date(),
    })
    .where(and(eq(project.id, id), eq(project.userId, userId)))
    .returning({ id: project.id })
  if (!updated) throw new Error("Project was not found or is not owned by this account")
}

export async function deleteProject(userId: string, id: number) {
  const [ownedProject] = await db
    .select({ artworkUrl: project.artworkUrl })
    .from(project)
    .where(and(eq(project.id, id), eq(project.userId, userId)))
    .limit(1)
  if (!ownedProject) throw new Error("Project was not found or is not owned by this account")

  const detachValues = ownedProject.artworkUrl
    ? { projectId: null, artworkUrl: ownedProject.artworkUrl }
    : { projectId: null }
  await db.transaction(async (tx) => {
    await tx.update(work).set(detachValues).where(and(eq(work.projectId, id), eq(work.userId, userId)))
    await tx.delete(project).where(and(eq(project.id, id), eq(project.userId, userId)))
  })
}

export async function getMyProject(userId: string, id: number) {
  const [result] = await db
    .select({
      id: project.id,
      title: project.title,
      description: project.description,
      artworkUrl: project.artworkUrl,
      createdDate: project.createdDate,
      releaseDate: project.releaseDate,
    })
    .from(project)
    .where(and(eq(project.id, id), eq(project.userId, userId)))
    .limit(1)
  if (!result) return null

  const works = await db
    .select({
      id: work.id,
      title: work.title,
      artist: work.artist,
      status: work.status,
      releasedDate: work.releasedDate,
      artworkUrl: sql<string | null>`coalesce(${project.artworkUrl}, ${work.artworkUrl})`,
    })
    .from(work)
    .leftJoin(project, eq(work.projectId, project.id))
    .where(and(eq(work.projectId, id), eq(work.userId, userId)))
    .orderBy(desc(work.createdAt))

  return { project: result, works }
}

export async function getMyProjects(userId: string) {
  return db
    .select({
      id: project.id,
      title: project.title,
      description: project.description,
      artworkUrl: project.artworkUrl,
      createdDate: project.createdDate,
      releaseDate: project.releaseDate,
      workCount: sql<number>`count(${work.id})::int`,
    })
    .from(project)
    .leftJoin(work, and(eq(work.projectId, project.id), eq(work.userId, userId)))
    .where(eq(project.userId, userId))
    .groupBy(project.id, project.title, project.description, project.artworkUrl, project.createdDate, project.releaseDate, project.createdAt)
    .orderBy(desc(project.createdAt))
}

export async function getMyProjectsSimple(userId: string) {
  return db
    .select({ id: project.id, title: project.title, artworkUrl: project.artworkUrl })
    .from(project)
    .where(eq(project.userId, userId))
    .orderBy(desc(project.createdAt))
}
