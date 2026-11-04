import { db } from "@/lib/db"
import type { DbExecutor } from "@/lib/db"
import { session as authSession, user } from "@/lib/db/schema"
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm"

export async function getSessionIdentity(userId: string) {
  const [identity] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      image: user.image,
      banned: user.banned,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)

  return identity ?? null
}

export async function isIdentityUserBanned(userId: string) {
  const [identity] = await db
    .select({ banned: user.banned })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
  return identity?.banned ?? false
}

export async function getAccountCounts() {
  const rows = await db
    .select({ role: user.role, count: sql<number>`count(*)::int` })
    .from(user)
    .groupBy(user.role)
  const countsByRole = new Map(rows.map(({ role, count }) => [role, count]))

  return {
    totalUsers: rows.reduce((total, { count }) => total + count, 0),
    totalMusicians: countsByRole.get("MUSICIAN") ?? 0,
    totalAudiences: countsByRole.get("AUDIENCE") ?? 0,
  }
}

export async function getAdminUsers(query?: string, roleFilter?: string) {
  const base = db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      banned: user.banned,
      createdAt: user.createdAt,
    })
    .from(user)
  const filters = []
  if (query?.trim()) filters.push(or(ilike(user.name, `%${query}%`), ilike(user.email, `%${query}%`))!)
  if (roleFilter && ["SUPER_ADMIN", "MUSICIAN", "AUDIENCE"].includes(roleFilter)) {
    filters.push(eq(user.role, roleFilter))
  }
  return (filters.length ? base.where(and(...filters)) : base).orderBy(desc(user.createdAt))
}

export async function getMusicianAccounts() {
  return db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      banned: user.banned,
    })
    .from(user)
    .where(eq(user.role, "MUSICIAN"))
    .orderBy(desc(user.createdAt))
}

export async function getAccountNamesByIds(ids: string[]) {
  if (ids.length === 0) return []

  return db
    .select({ id: user.id, name: user.name })
    .from(user)
    .where(inArray(user.id, ids))
}

export async function setUserDisplayName(userId: string, name: string, executor: DbExecutor = db) {
  await executor.update(user).set({ name, updatedAt: new Date() }).where(eq(user.id, userId))
}

export async function getAccountImage(userId: string) {
  const [account] = await db
    .select({ image: user.image })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
  return account?.image ?? null
}

export async function setAccountImage(userId: string, imageUrl: string | null) {
  await db.update(user).set({ image: imageUrl, updatedAt: new Date() }).where(eq(user.id, userId))
}

export async function setUserRole(adminId: string, userId: string, role: string) {
  if (userId === adminId) throw new Error("You cannot change your own role")
  if (!["SUPER_ADMIN", "MUSICIAN", "AUDIENCE"].includes(role)) throw new Error("Invalid role")
  await db.transaction(async (tx) => {
    const [updatedUser] = await tx
      .update(user)
      .set({ role, updatedAt: new Date() })
      .where(eq(user.id, userId))
      .returning({ id: user.id })
    if (!updatedUser) throw new Error("User not found")
    await tx.delete(authSession).where(eq(authSession.userId, userId))
  })
}

export async function setUserBanned(adminId: string, userId: string, banned: boolean) {
  if (userId === adminId) throw new Error("You cannot ban yourself")
  await db.transaction(async (tx) => {
    const [updatedUser] = await tx
      .update(user)
      .set({ banned, updatedAt: new Date() })
      .where(eq(user.id, userId))
      .returning({ id: user.id })
    if (!updatedUser) throw new Error("User not found")
    await tx.delete(authSession).where(eq(authSession.userId, userId))
  })
}
