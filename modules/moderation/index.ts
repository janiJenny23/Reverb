import { db } from "@/lib/db"
import type { DbExecutor } from "@/lib/db"
import { report } from "@/lib/db/schema"
import { canReportWork, hasOpenReportForReporter } from "@/lib/domain-rules"
import { getPublishedWorkReporterId, getWorkLabelsByIds, setWorkStatus } from "@/modules/archive"
import { and, desc, eq, sql } from "drizzle-orm"

async function getReportsWithWorkLabels(limit?: number) {
  const query = db
    .select({
      id: report.id,
      reason: report.reason,
      details: report.details,
      status: report.status,
      createdAt: report.createdAt,
      workId: report.workId,
    })
    .from(report)
    .orderBy(desc(report.createdAt))
  const reportRows = limit === undefined ? await query : await query.limit(limit)

  const workLabels = new Map(
    (await getWorkLabelsByIds([...new Set(reportRows.map(({ workId }) => workId))])).map((work) => [work.id, work]),
  )

  return reportRows.map((row) => {
    const work = workLabels.get(row.workId)
    return {
      ...row,
      workTitle: work?.title ?? null,
      workArtist: work?.artist ?? null,
    }
  })
}

export async function getReportCounts() {
  const [total] = await db.select({ count: sql<number>`count(*)::int` }).from(report)
  const [open] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(report)
    .where(eq(report.status, "OPEN"))
  return {
    totalReports: total?.count ?? 0,
    openReports: open?.count ?? 0,
  }
}

export async function getRecentReports(limit = 3) {
  return getReportsWithWorkLabels(limit)
}

export async function getReports() {
  return getReportsWithWorkLabels()
}

export async function submitReport(workId: number, reporterId: string | null, reason: string, details?: string) {
  if (!canReportWork("PUBLISHED", reason ?? "")) throw new Error("Reason is required")
  const ownerId = await getPublishedWorkReporterId(workId)
  if (ownerId === null) throw new Error("This work is not available for reporting")
  if (reporterId === ownerId) throw new Error("You cannot report your own work")
  if (reporterId) {
    const [existingReport] = await db
      .select({ id: report.id, workId: report.workId, reporterId: report.reporterId, status: report.status })
      .from(report)
      .where(and(eq(report.workId, workId), eq(report.reporterId, reporterId), eq(report.status, "OPEN")))
      .limit(1)
    if (existingReport && hasOpenReportForReporter([existingReport], workId, reporterId)) {
      throw new Error("You already reported this work")
    }
  }
  await db.insert(report).values({
    workId,
    reporterId,
    reason: reason.trim(),
    details: details?.trim() || null,
  })
  return { ok: true }
}

export async function deleteReportsForWork(workId: number, executor: DbExecutor = db) {
  await executor.delete(report).where(eq(report.workId, workId))
}

export async function resolveReport(id: number) {
  await db.update(report).set({ status: "RESOLVED", updatedAt: new Date() }).where(eq(report.id, id))
}

export async function hideReportedWork(reportId: number) {
  return db.transaction(async (transaction) => {
    const [reported] = await transaction
      .select({ workId: report.workId })
      .from(report)
      .where(eq(report.id, reportId))
      .limit(1)
    if (!reported) throw new Error("Report not found")
    await setWorkStatus(reported.workId, "HIDDEN", transaction)
    await transaction
      .update(report)
      .set({ status: "RESOLVED", updatedAt: new Date() })
      .where(eq(report.id, reportId))
    return reported.workId
  })
}
