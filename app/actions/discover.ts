"use server"

import { getSessionUser } from "@/lib/session"
import { incrementPlayCount as incrementPlayCountInModule } from "@/modules/archive"
import { submitReport as submitReportInModule } from "@/modules/moderation"

export async function incrementPlayCount(workId: number) {
  await incrementPlayCountInModule(workId)
}

export async function submitReport(workId: number, reason: string, details?: string) {
  const user = await getSessionUser()
  return submitReportInModule(workId, user?.id ?? null, reason, details)
}
