"use server"

import { requireRole } from "@/lib/session"
import { revalidatePath } from "next/cache"
import {
  adminDeleteWork as adminDeleteWorkInModule,
  deleteGenre as deleteGenreInModule,
  getAdminStats as getAdminStatsFromModule,
  getAllMusicians as getAllMusiciansFromModule,
  getAllUsers as getAllUsersFromModule,
  getAllWorks as getAllWorksFromModule,
  getRecentAdminWorks as getRecentAdminWorksFromModule,
  getGenresWithCounts as getGenresWithCountsFromModule,
  setWorkStatus as setWorkStatusInModule,
} from "@/modules/admin"
import {
  getAdminDiscoverHeroImage as getAdminDiscoverHeroImageFromModule,
  setDiscoverHeroImage as setDiscoverHeroImageInModule,
} from "@/modules/discovery-content"
import { createGenre as createGenreInModule } from "@/modules/genres"
import {
  getRecentReports as getRecentReportsFromModule,
  getReports as getReportsFromModule,
  hideReportedWork as hideReportedWorkInModule,
  resolveReport as resolveReportInModule,
} from "@/modules/moderation"
import { setUserBanned as setUserBannedInModule, setUserRole as setUserRoleInModule } from "@/modules/identity"

export async function getAdminStats() {
  await requireRole(["SUPER_ADMIN"])
  return getAdminStatsFromModule()
}

export async function getRecentAdminWorks(limit = 4) {
  await requireRole(["SUPER_ADMIN"])
  return getRecentAdminWorksFromModule(limit)
}

export async function getRecentReports(limit = 3) {
  await requireRole(["SUPER_ADMIN"])
  return getRecentReportsFromModule(limit)
}

export async function getAllUsers(query?: string, roleFilter?: string) {
  await requireRole(["SUPER_ADMIN"])
  return getAllUsersFromModule(query, roleFilter)
}

export async function setUserRole(userId: string, role: string) {
  const admin = await requireRole(["SUPER_ADMIN"])
  await setUserRoleInModule(admin.id, userId, role)
  revalidatePath("/admin/users")
}

export async function setUserBanned(userId: string, banned: boolean) {
  const admin = await requireRole(["SUPER_ADMIN"])
  await setUserBannedInModule(admin.id, userId, banned)
  revalidatePath("/admin/users")
}

export async function getAllMusicians() {
  await requireRole(["SUPER_ADMIN"])
  return getAllMusiciansFromModule()
}

export async function getAllWorks(query?: string) {
  await requireRole(["SUPER_ADMIN"])
  return getAllWorksFromModule(query)
}

export async function setWorkStatus(workId: number, status: string) {
  await requireRole(["SUPER_ADMIN"])
  await setWorkStatusInModule(workId, status)
  revalidatePath("/admin/works")
}

export async function adminDeleteWork(workId: number) {
  await requireRole(["SUPER_ADMIN"])
  await adminDeleteWorkInModule(workId)
  revalidatePath("/admin/works")
  revalidatePath("/admin/genres")
}

export async function getGenresWithCounts() {
  await requireRole(["SUPER_ADMIN"])
  return getGenresWithCountsFromModule()
}

export async function createGenre(name: string) {
  await requireRole(["SUPER_ADMIN"])
  await createGenreInModule(name)
  revalidatePath("/admin/genres")
}

export async function deleteGenre(id: number) {
  await requireRole(["SUPER_ADMIN"])
  await deleteGenreInModule(id)
  revalidatePath("/admin/genres")
}

export async function getReports() {
  await requireRole(["SUPER_ADMIN"])
  return getReportsFromModule()
}

export async function resolveReport(id: number) {
  await requireRole(["SUPER_ADMIN"])
  await resolveReportInModule(id)
  revalidatePath("/admin/reports")
}

export async function hideReportedWork(reportId: number) {
  await requireRole(["SUPER_ADMIN"])
  const workId = await hideReportedWorkInModule(reportId)
  revalidatePath("/admin/reports")
  revalidatePath("/admin/works")
  revalidatePath("/discover")
  revalidatePath(`/discover/works/${workId}`)
}

export async function getAdminDiscoverHeroImage() {
  await requireRole(["SUPER_ADMIN"])
  return getAdminDiscoverHeroImageFromModule()
}

export async function setDiscoverHeroImage(imageUrl: string | null) {
  await requireRole(["SUPER_ADMIN"])
  await setDiscoverHeroImageInModule(imageUrl)
  revalidatePath("/admin/discover")
  revalidatePath("/discover")
}
