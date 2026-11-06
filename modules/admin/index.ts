import { db } from "@/lib/db"
import { outboxEvent } from "@/lib/db/schema"
import { and, eq, gte, lt, lte, or } from "drizzle-orm"
import {
  clearWorkGenreReferences,
  deleteWorkForAdmin,
  getAdminWorks as getArchiveAdminWorks,
  getArchiveCounts,
  getWorkCountsByGenre,
  getWorkCountsByUserIds,
  getRecentAdminWorks as getArchiveRecentAdminWorks,
  markWorkDeletionPending,
  setWorkStatus as setArchiveWorkStatus,
} from "@/modules/archive"
import { deleteFavoritesForWork } from "@/modules/library"
import { deleteReportsForWork, getReportCounts } from "@/modules/moderation"
import { deleteGenreRecord, getGenreCount, getGenres } from "@/modules/genres"
import { getAccountCounts, getAdminUsers, getMusicianAccounts } from "@/modules/identity"
import { getMusicianProfilesByUserIds } from "@/modules/profiles"

export const MAX_OUTBOX_ATTEMPTS = 5
export const COMPLETED_OUTBOX_RETENTION_DAYS = 30

export async function getGenresWithCounts() {
  const [genres, workCounts] = await Promise.all([getGenres(), getWorkCountsByGenre()])
  const countsByGenreId = new Map(workCounts.map(({ genreId, count }) => [genreId, count]))

  return genres.map((item) => ({
    ...item,
    workCount: countsByGenreId.get(item.id) ?? 0,
  }))
}

export async function deleteGenre(id: number) {
  await db.transaction(async (transaction) => {
    await clearWorkGenreReferences(id, transaction)
    await deleteGenreRecord(id, transaction)
  })
}

export async function getAdminStats() {
  const [accountCounts, archiveCounts, totalGenres, reportCounts] = await Promise.all([
    getAccountCounts(),
    getArchiveCounts(),
    getGenreCount(),
    getReportCounts(),
  ])
  return {
    ...accountCounts,
    ...archiveCounts,
    totalGenres,
    totalReports: reportCounts.totalReports,
    openReports: reportCounts.openReports,
  }
}

export async function getRecentAdminWorks(limit = 4) {
  return getArchiveRecentAdminWorks(limit)
}

export async function getAllUsers(query?: string, roleFilter?: string) {
  return getAdminUsers(query, roleFilter)
}

export async function getAllMusicians() {
  const accounts = await getMusicianAccounts()
  const userIds = accounts.map(({ id }) => id)
  const [profiles, workCounts] = await Promise.all([
    getMusicianProfilesByUserIds(userIds),
    getWorkCountsByUserIds(userIds),
  ])
  const profilesByUserId = new Map(profiles.map((profile) => [profile.userId, profile]))
  const workCountsByUserId = new Map(workCounts.map(({ userId, count }) => [userId, count]))

  return accounts.map((account) => {
    const profile = profilesByUserId.get(account.id)
    return {
      ...account,
      displayName: profile?.displayName ?? null,
      primaryGenre: profile?.primaryGenre ?? null,
      imageUrl: profile?.imageUrl ?? null,
      workCount: workCountsByUserId.get(account.id) ?? 0,
    }
  })
}

export async function getAllWorks(query?: string) {
  const [works, failedDeletions] = await Promise.all([
    getArchiveAdminWorks(query),
    db
      .select({
        workId: outboxEvent.aggregateId,
        attempts: outboxEvent.attempts,
        lastError: outboxEvent.lastError,
      })
      .from(outboxEvent)
      .where(and(
        eq(outboxEvent.eventType, "WORK_DELETION_REQUESTED"),
        eq(outboxEvent.status, "FAILED"),
      )),
  ])
  const failuresByWorkId = new Map(failedDeletions.map(({ workId, ...failure }) => [workId, failure]))

  return works.map((work) => ({
    ...work,
    deletionFailure: failuresByWorkId.get(work.id) ?? null,
  }))
}

export async function setWorkStatus(workId: number, status: string) {
  await setArchiveWorkStatus(workId, status)
}

export async function adminDeleteWork(workId: number) {
  await db.transaction(async (transaction) => {
    const marked = await markWorkDeletionPending(workId, transaction)
    if (!marked) return

    await transaction
      .insert(outboxEvent)
      .values({ eventType: "WORK_DELETION_REQUESTED", aggregateId: workId })
      .onConflictDoNothing()
  })
}

export async function retryWorkDeletion(workId: number) {
  const [retried] = await db
    .update(outboxEvent)
    .set({
      status: "PENDING",
      attempts: 0,
      availableAt: new Date(),
      lockedAt: null,
      lastError: null,
      updatedAt: new Date(),
    })
    .where(and(
      eq(outboxEvent.eventType, "WORK_DELETION_REQUESTED"),
      eq(outboxEvent.aggregateId, workId),
      eq(outboxEvent.status, "FAILED"),
    ))
    .returning({ id: outboxEvent.id })
  if (!retried) throw new Error("No failed deletion was found for this work")
}

export async function purgeCompletedOutboxEvents() {
  const cutoff = new Date(Date.now() - COMPLETED_OUTBOX_RETENTION_DAYS * 24 * 60 * 60 * 1_000)
  const deleted = await db
    .delete(outboxEvent)
    .where(and(eq(outboxEvent.status, "COMPLETED"), lt(outboxEvent.updatedAt, cutoff)))
    .returning({ id: outboxEvent.id })
  return deleted.length
}

export async function processNextOutboxEvent() {
  const now = new Date()
  const staleLockBefore = new Date(now.getTime() - 60_000)
  const claimed = await db.transaction(async (transaction) => {
    await transaction
      .update(outboxEvent)
      .set({
        status: "FAILED",
        lockedAt: null,
        lastError: "Worker lease expired after maximum attempts",
        updatedAt: now,
      })
      .where(and(
        eq(outboxEvent.status, "PROCESSING"),
        gte(outboxEvent.attempts, MAX_OUTBOX_ATTEMPTS),
        lt(outboxEvent.lockedAt, staleLockBefore),
      ))
    await transaction
      .update(outboxEvent)
      .set({
        status: "FAILED",
        lockedAt: null,
        lastError: "Maximum retry attempts reached",
        updatedAt: now,
      })
      .where(and(
        eq(outboxEvent.status, "PENDING"),
        gte(outboxEvent.attempts, MAX_OUTBOX_ATTEMPTS),
      ))

    const [event] = await transaction
      .select()
      .from(outboxEvent)
      .where(
        or(
          and(
            eq(outboxEvent.status, "PENDING"),
            lt(outboxEvent.attempts, MAX_OUTBOX_ATTEMPTS),
            lte(outboxEvent.availableAt, now),
          ),
          and(
            eq(outboxEvent.status, "PROCESSING"),
            lt(outboxEvent.attempts, MAX_OUTBOX_ATTEMPTS),
            lt(outboxEvent.lockedAt, staleLockBefore),
          ),
        ),
      )
      .orderBy(outboxEvent.id)
      .limit(1)
      .for("update", { skipLocked: true })
    if (!event) return null

    const [locked] = await transaction
      .update(outboxEvent)
      .set({
        status: "PROCESSING",
        attempts: event.attempts + 1,
        lockedAt: now,
        updatedAt: now,
      })
      .where(eq(outboxEvent.id, event.id))
      .returning()
    return locked
  })

  if (!claimed) return false

  try {
    if (claimed.eventType !== "WORK_DELETION_REQUESTED") {
      throw new Error(`Unsupported outbox event type: ${claimed.eventType}`)
    }

    await deleteFavoritesForWork(claimed.aggregateId)
    await deleteReportsForWork(claimed.aggregateId)
    await deleteWorkForAdmin(claimed.aggregateId)
    const [completed] = await db
      .update(outboxEvent)
      .set({ status: "COMPLETED", lockedAt: null, lastError: null, updatedAt: new Date() })
      .where(eq(outboxEvent.id, claimed.id))
      .returning({ id: outboxEvent.id })
    if (!completed) throw new Error(`Could not complete outbox event ${claimed.id}`)
    return true
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const failed = claimed.attempts >= MAX_OUTBOX_ATTEMPTS
    const retryDelayMs = Math.min(60_000 * 2 ** Math.min(claimed.attempts - 1, 10), 3_600_000)
    const [retryScheduled] = await db
      .update(outboxEvent)
      .set({
        status: failed ? "FAILED" : "PENDING",
        ...(failed ? {} : { availableAt: new Date(Date.now() + retryDelayMs) }),
        lockedAt: null,
        lastError: message.slice(0, 2_000),
        updatedAt: new Date(),
      })
      .where(eq(outboxEvent.id, claimed.id))
      .returning({ id: outboxEvent.id })
    if (!retryScheduled) {
      throw new AggregateError([error], `Could not reschedule failed outbox event ${claimed.id}`)
    }
    if (failed) {
      console.error(`Outbox event ${claimed.id} failed after ${claimed.attempts} attempts`, error)
    }
    throw error
  }
}
