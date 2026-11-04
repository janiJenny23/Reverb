import { auth } from "@/lib/auth"
import { getFreshSessionUserById, normalizeSessionUser, type SessionUser } from "@/lib/session"

export async function getMobileUser(request: Request): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: request.headers })
  const baseUser = normalizeSessionUser((session?.user ?? null) as Record<string, unknown> | null)
  if (!baseUser) return null

  return getFreshSessionUserById(baseUser.id)
}
