"use server"

import { requireRole } from "@/lib/session"
import { revalidatePath } from "next/cache"
import { getMusicianProfile, saveMusicianProfile, type ProfileInput } from "@/modules/profiles"

export type { ProfileInput }

export async function getMyProfile() {
  const account = await requireRole(["MUSICIAN", "SUPER_ADMIN"])
  const profile = await getMusicianProfile(account.id)
  return { profile, account }
}

export async function saveMyProfile(input: ProfileInput) {
  const user = await requireRole(["MUSICIAN", "SUPER_ADMIN"])
  await saveMusicianProfile(user.id, input)
  revalidatePath("/profile")
}
