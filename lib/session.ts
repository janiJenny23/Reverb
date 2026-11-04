import { auth } from "@/lib/auth"
import { getSessionIdentity } from "@/modules/identity"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

export type Role = "SUPER_ADMIN" | "MUSICIAN" | "AUDIENCE"

export type SessionUser = {
  id: string
  name: string
  email: string
  role: Role
  image?: string | null
}

const VALID_ROLES = new Set<Role>(["SUPER_ADMIN", "MUSICIAN", "AUDIENCE"])

export function normalizeSessionUser(input: {
  id?: string | null
  name?: string | null
  email?: string | null
  role?: string | null
  image?: string | null
  banned?: boolean | null
} | null): SessionUser | null {
  if (!input?.id || !input.email || !input.name) return null
  if (input.banned) return null

  const role = (input.role ?? "MUSICIAN") as string
  if (!VALID_ROLES.has(role as Role)) return null

  return {
    id: input.id,
    name: input.name,
    email: input.email,
    role: role as Role,
    image: input.image ?? null,
  }
}

export async function getFreshSessionUserById(userId: string): Promise<SessionUser | null> {
  const freshUser = await getSessionIdentity(userId)
  if (!freshUser || freshUser.banned) return null

  return normalizeSessionUser({
    id: freshUser.id,
    name: freshUser.name,
    email: freshUser.email,
    role: freshUser.role,
    image: freshUser.image,
    banned: freshUser.banned,
  })
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null

  const baseUser = normalizeSessionUser(session.user as Record<string, unknown>)
  if (!baseUser) return null

  return getFreshSessionUserById(baseUser.id)
}

export function getProtectedRouteRedirect(pathname: string, role: Role | null): string | null {
  const normalizedPath = pathname.replace(/\/+$/, "") || "/"

  if (normalizedPath === "/admin" || normalizedPath.startsWith("/admin/")) {
    if (!role) return "/sign-in"
    return role === "SUPER_ADMIN" ? null : role === "AUDIENCE" ? "/discover" : "/dashboard"
  }

  if (
    normalizedPath === "/dashboard" ||
    normalizedPath.startsWith("/dashboard/") ||
    normalizedPath === "/projects" ||
    normalizedPath.startsWith("/projects/") ||
    normalizedPath === "/works" ||
    normalizedPath.startsWith("/works/") ||
    normalizedPath === "/profile"
  ) {
    if (!role) return "/sign-in"
    return role === "MUSICIAN" || role === "SUPER_ADMIN" ? null : "/discover"
  }

  if (normalizedPath === "/discover/library") {
    if (!role) return "/sign-in"
    return role === "AUDIENCE" ? null : role === "SUPER_ADMIN" ? "/admin" : "/dashboard"
  }

  return null
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) redirect("/sign-in")
  return user
}

export async function requireRole(roles: Role[]): Promise<SessionUser> {
  const user = await requireUser()
  if (!roles.includes(user.role)) {
    // Send each role to the surface it belongs to.
    if (user.role === "AUDIENCE") redirect("/discover")
    if (user.role === "SUPER_ADMIN") redirect("/admin")
    redirect("/dashboard")
  }
  return user
}

export function homePathForRole(role: Role): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "/admin"
    case "AUDIENCE":
      return "/discover"
    default:
      return "/dashboard"
  }
}
