"use server"

import { requireUser } from "@/lib/session"
import { revalidatePath } from "next/cache"
import {
  getFavoriteIdsForUser,
  getFavoritesForUser,
  toggleFavoriteForUser,
} from "@/modules/library"

export async function toggleFavorite(workId: number) {
  const user = await requireUser()
  const result = await toggleFavoriteForUser(user.id, workId)
  revalidatePath("/discover/library")
  revalidatePath(`/discover/works/${workId}`)
  return result
}

export async function getMyFavoriteIds() {
  const user = await requireUser()
  return getFavoriteIdsForUser(user.id)
}

export async function getMyFavorites() {
  const user = await requireUser()
  return getFavoritesForUser(user.id)
}
