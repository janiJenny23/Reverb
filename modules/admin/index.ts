import { db } from "@/lib/db"
import {
  clearWorkGenreReferences,
  deleteWorkForAdmin,
  getAdminWorks as getArchiveAdminWorks,
  getArchiveCounts,
  getWorkCountsByGenre,
  getWorkCountsByUserIds,
  getRecentAdminWorks as getArchiveRecentAdminWorks,
  setWorkStatus as setArchiveWorkStatus,
} from "@/modules/archive"
import { deleteFavoritesForWork } from "@/modules/library"
import { deleteReportsForWork, getReportCounts } from "@/modules/moderation"
import { deleteGenreRecord, getGenreCount, getGenres } from "@/modules/genres"
import { getAccountCounts, getAdminUsers, getMusicianAccounts } from "@/modules/identity"
import { getMusicianProfilesByUserIds } from "@/modules/profiles"

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
  return getArchiveAdminWorks(query)
}

export async function setWorkStatus(workId: number, status: string) {
  await setArchiveWorkStatus(workId, status)
}

export async function adminDeleteWork(workId: number) {
  await db.transaction(async (transaction) => {
    await deleteFavoritesForWork(workId, transaction)
    await deleteReportsForWork(workId, transaction)
    await deleteWorkForAdmin(workId, transaction)
  })
}
