"use server"

import { revalidatePath } from "next/cache"
import { requireRole } from "@/lib/session"
import {
  createWork as createWorkInModule,
  deleteWork as deleteWorkInModule,
  getMyStats as getMyStatsFromModule,
  getMyWork as getMyWorkFromModule,
  getMyWorks as getMyWorksFromModule,
  updateWork as updateWorkInModule,
  type WorkInput,
} from "@/modules/archive"

export type { WorkInput }

function revalidateWorkCollection() {
  revalidatePath("/works")
  revalidatePath("/projects")
  revalidatePath("/dashboard")
  revalidatePath("/discover")
  revalidatePath("/discover/library")
  revalidatePath("/admin/genres")
  revalidatePath("/admin/works")
}

export async function createWork(input: WorkInput) {
  const user = await requireRole(["MUSICIAN", "SUPER_ADMIN"])
  const id = await createWorkInModule(user.id, input)
  revalidateWorkCollection()
  return id
}

export async function updateWork(id: number, input: WorkInput) {
  const user = await requireRole(["MUSICIAN", "SUPER_ADMIN"])
  await updateWorkInModule(user.id, id, input)
  revalidateWorkCollection()
  revalidatePath(`/works/${id}`)
  revalidatePath("/projects/[id]", "page")
  revalidatePath("/discover/works/[id]", "page")
  revalidatePath("/discover/musicians/[id]", "page")
}

export async function deleteWork(id: number) {
  const user = await requireRole(["MUSICIAN", "SUPER_ADMIN"])
  await deleteWorkInModule(user.id, id)
  revalidateWorkCollection()
  revalidatePath("/discover/works/[id]", "page")
  revalidatePath("/discover/musicians/[id]", "page")
}

export async function getMyWorks() {
  const user = await requireRole(["MUSICIAN", "SUPER_ADMIN"])
  return getMyWorksFromModule(user.id)
}

export async function getMyWork(id: number) {
  const user = await requireRole(["MUSICIAN", "SUPER_ADMIN"])
  return getMyWorkFromModule(user.id, id)
}

export async function getMyStats() {
  const user = await requireRole(["MUSICIAN", "SUPER_ADMIN"])
  return getMyStatsFromModule(user.id)
}
