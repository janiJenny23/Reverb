"use server"

import { requireRole } from "@/lib/session"
import { revalidatePath } from "next/cache"
import {
  createProject as createProjectInModule,
  deleteProject as deleteProjectInModule,
  getMyProject as getMyProjectFromModule,
  getMyProjects as getMyProjectsFromModule,
  getMyProjectsSimple as getMyProjectsSimpleFromModule,
  updateProject as updateProjectInModule,
  type ProjectInput,
} from "@/modules/archive"

export type { ProjectInput }

export async function createProject(input: ProjectInput) {
  const user = await requireRole(["MUSICIAN", "SUPER_ADMIN"])
  const id = await createProjectInModule(user.id, input)
  revalidatePath("/projects")
  revalidatePath("/projects/[id]", "page")
  revalidatePath("/dashboard")
  revalidatePath("/admin")
  revalidatePath("/admin/works")
  revalidatePath("/discover")
  revalidatePath("/discover/library")
  revalidatePath("/discover/works/[id]", "page")
  revalidatePath("/discover/musicians/[id]", "page")
  return id
}

export async function updateProject(id: number, input: ProjectInput) {
  const user = await requireRole(["MUSICIAN", "SUPER_ADMIN"])
  await updateProjectInModule(user.id, id, input)
  revalidatePath("/projects")
  revalidatePath(`/projects/${id}`)
  revalidatePath(`/projects/${id}/edit`)
  revalidatePath("/works")
  revalidatePath("/dashboard")
  revalidatePath("/admin")
  revalidatePath("/admin/works")
  revalidatePath("/discover")
  revalidatePath("/discover/library")
  revalidatePath("/discover/works/[id]", "page")
  revalidatePath("/discover/musicians/[id]", "page")
}

export async function deleteProject(id: number) {
  const user = await requireRole(["MUSICIAN", "SUPER_ADMIN"])
  await deleteProjectInModule(user.id, id)
  revalidatePath("/projects")
  revalidatePath(`/projects/${id}`)
  revalidatePath("/works")
  revalidatePath("/dashboard")
  revalidatePath("/admin")
  revalidatePath("/admin/works")
  revalidatePath("/discover")
  revalidatePath("/discover/library")
  revalidatePath("/discover/works/[id]", "page")
  revalidatePath("/discover/musicians/[id]", "page")
}

export async function getMyProject(id: number) {
  const user = await requireRole(["MUSICIAN", "SUPER_ADMIN"])
  return getMyProjectFromModule(user.id, id)
}

export async function getMyProjects() {
  const user = await requireRole(["MUSICIAN", "SUPER_ADMIN"])
  return getMyProjectsFromModule(user.id)
}

export async function getMyProjectsSimple() {
  const user = await requireRole(["MUSICIAN", "SUPER_ADMIN"])
  return getMyProjectsSimpleFromModule(user.id)
}
