import * as SecureStore from "expo-secure-store"
import { Platform } from "react-native"

export type PublicWork = {
  id: number
  title: string
  artist: string
  artworkUrl: string | null
  audioUrl: string
  duration: number | null
  genreName: string | null
  projectTitle: string | null
  musicianName: string | null
  musicianId: string
}

type WorksResponse = {
  data: PublicWork[]
}

export type PublicWorkDetail = PublicWork & {
  composer: string | null
  lyricist: string | null
  producer: string | null
  recording: string | null
  version: string | null
  lyrics: string | null
  releasedDate: string | null
  createdDate: string | null
  format: string | null
  musicianImage: string | null
}

export type PublicMusician = {
  profile: {
    userId: string
    displayName: string | null
    bio: string | null
    primaryGenre: string | null
    imageUrl: string | null
    accountName: string
  }
  works: PublicWork[]
}

export type MobileSession = {
  session: { id: string; expiresAt: string }
  user: { id: string; name: string; email: string; image?: string | null; role?: string }
}

const DEFAULT_API_HOST = Platform.OS === "android" ? "10.0.2.2" : "localhost"
const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL

if (process.env.NODE_ENV === "production") {
  if (!configuredApiUrl) {
    throw new Error("EXPO_PUBLIC_API_URL must point to the deployed API before building the mobile app")
  }
  const productionApiUrl = new URL(configuredApiUrl)
  if (productionApiUrl.protocol !== "https:") {
    throw new Error("EXPO_PUBLIC_API_URL must use HTTPS in production")
  }
  if (
    productionApiUrl.pathname.replace(/\/+$/, "") !== "/api/v1" ||
    productionApiUrl.search ||
    productionApiUrl.hash
  ) {
    throw new Error("EXPO_PUBLIC_API_URL must end with /api/v1 and must not include a query or fragment")
  }
}

const API_URL = (configuredApiUrl ?? `http://${DEFAULT_API_HOST}:3000/api/v1`).replace(/\/+$/, "")
const AUTH_URL = API_URL.replace(/\/api\/v1\/?$/, "/api/auth")
const API_ORIGIN = new URL(API_URL).origin
const SESSION_KEY = "reverb.auth.session"

type AuthResponse = {
  error?: { message?: string }
  message?: string
  code?: string
  token?: string
}

async function readSessionCookie() {
  if (Platform.OS === "web") return globalThis.localStorage.getItem(SESSION_KEY)
  return SecureStore.getItemAsync(SESSION_KEY)
}

async function writeSessionCookie(value: string) {
  if (Platform.OS === "web") {
    globalThis.localStorage.setItem(SESSION_KEY, value)
    return
  }
  await SecureStore.setItemAsync(SESSION_KEY, value)
}

async function clearSessionCookie() {
  if (Platform.OS === "web") {
    globalThis.localStorage.removeItem(SESSION_KEY)
    return
  }
  await SecureStore.deleteItemAsync(SESSION_KEY)
}

async function authRequest(path: string, body?: Record<string, string>, cookie?: string) {
  const response = await fetch(`${AUTH_URL}/${path}`, {
    method: body ? "POST" : "GET",
    credentials: Platform.OS === "web" ? "include" : "omit",
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(body ? { Origin: API_ORIGIN } : {}),
      ...(cookie && Platform.OS !== "web" ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const payload = (await response.json().catch(() => ({}))) as AuthResponse
  if (!response.ok) throw new Error(payload.error?.message ?? payload.message ?? "Authentication failed")
  return { response, payload }
}

function getSessionCookie(response: Response, payload: AuthResponse) {
  const setCookie = response.headers.get("set-cookie")
  const cookie = setCookie?.split(";")[0]
  if (cookie) return cookie
  if (payload.token) return `better-auth.session_token=${payload.token}`
  throw new Error("Authentication succeeded but no session was returned")
}

export async function signIn(email: string, password: string) {
  const { response, payload } = await authRequest("sign-in/email", { email, password })
  await writeSessionCookie(getSessionCookie(response, payload))
}

export async function signUp(name: string, email: string, password: string) {
  const { response, payload } = await authRequest("sign-up/email", {
    name,
    email,
    password,
    role: "AUDIENCE",
  })
  await writeSessionCookie(getSessionCookie(response, payload))
}

export async function signOut() {
  const cookie = await readSessionCookie()
  if (cookie) {
    await fetch(`${AUTH_URL}/sign-out`, {
      method: "POST",
      credentials: Platform.OS === "web" ? "include" : "omit",
      headers: {
        "Content-Type": "application/json",
        Origin: API_ORIGIN,
        ...(Platform.OS !== "web" ? { Cookie: cookie } : {}),
      },
      body: JSON.stringify({}),
    })
  }
  await clearSessionCookie()
}

export async function getSession() {
  const cookie = await readSessionCookie()
  if (!cookie) return null
  const response = await fetch(`${API_URL}/session`, {
    credentials: Platform.OS === "web" ? "include" : "omit",
    headers: {
      ...(Platform.OS !== "web" ? { Cookie: cookie } : {}),
    },
  })
  const payload = (await response.json().catch(() => ({}))) as { data?: MobileSession; error?: string }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      await clearSessionCookie()
      return null
    }
    throw new Error(payload.error ?? "Unable to refresh session")
  }
  return payload.data ?? null
}

async function authenticatedApiRequest(path: string, init?: RequestInit) {
  const cookie = await readSessionCookie()
  if (!cookie) throw new Error("Authentication required")
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: Platform.OS === "web" ? "include" : "omit",
    headers: {
      ...(init?.headers ?? {}),
      ...(Platform.OS !== "web" ? { Cookie: cookie } : {}),
    },
  })
  const payload = (await response.json().catch(() => ({}))) as { data?: unknown; error?: string }
  if (!response.ok) throw new Error(payload.error ?? "Request failed")
  return payload
}

export async function fetchLibrary(): Promise<PublicWork[]> {
  const payload = await authenticatedApiRequest("/library")
  return payload.data as PublicWork[]
}

export async function toggleFavorite(workId: number): Promise<boolean> {
  const payload = await authenticatedApiRequest("/favorites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workId }),
  })
  return Boolean((payload.data as { favorited: boolean }).favorited)
}

export async function getFavoriteStatus(workId: number): Promise<boolean> {
  const payload = await authenticatedApiRequest(`/favorites?workId=${encodeURIComponent(workId)}`)
  return Boolean((payload.data as { favorited: boolean }).favorited)
}

export async function fetchWorks(query?: string): Promise<PublicWork[]> {
  const url = new URL(`${API_URL}/works`)
  if (query?.trim()) url.searchParams.set("q", query.trim())
  const response = await fetch(url)
  if (!response.ok) throw new Error("Unable to load works")
  const body = (await response.json()) as WorksResponse
  return body.data
}

export async function fetchDiscoverHeroImage(): Promise<string | null> {
  const response = await fetch(`${API_URL}/discover/hero`)
  if (!response.ok) throw new Error(`Unable to load Discover background (HTTP ${response.status})`)
  const body = (await response.json()) as { data: { imageUrl: string | null } }
  return body.data.imageUrl
}

export async function updateProfileImage(base64: string, mimeType: string) {
  const cookie = await readSessionCookie()
  if (!cookie) throw new Error("Authentication required")
  const response = await fetch(`${API_URL}/profile`, { method: "PATCH", headers: { "Content-Type": "application/json", ...(Platform.OS !== "web" ? { Cookie: cookie } : {}) }, body: JSON.stringify({ base64, mimeType }) })
  const payload = (await response.json().catch(() => ({}))) as { data?: { image?: string }; error?: string }
  if (!response.ok) throw new Error(payload.error ?? "Unable to update profile image")
  return payload.data?.image ?? null
}

export async function deleteProfileImage() {
  const cookie = await readSessionCookie()
  if (!cookie) throw new Error("Authentication required")
  const response = await fetch(`${API_URL}/profile`, { method: "DELETE", headers: { ...(Platform.OS !== "web" ? { Cookie: cookie } : {}) } })
  const payload = (await response.json().catch(() => ({}))) as { error?: string }
  if (!response.ok) throw new Error(payload.error ?? "Unable to remove profile image")
}

export async function fetchWork(id: string): Promise<PublicWorkDetail> {
  const response = await fetch(`${API_URL}/works/${encodeURIComponent(id)}`)
  if (!response.ok) throw new Error(response.status === 404 ? "Work not found" : "Unable to load work")
  const body = (await response.json()) as { data: PublicWorkDetail }
  return body.data
}

export async function isWorkAvailable(id: number) {
  const response = await fetch(`${API_URL}/works/${encodeURIComponent(String(id))}`)
  if (response.status === 404) return false
  if (!response.ok) throw new Error("Unable to verify work availability")
  return true
}

export async function fetchMusician(id: string): Promise<PublicMusician> {
  const response = await fetch(`${API_URL}/musicians/${encodeURIComponent(id)}`)
  if (!response.ok) throw new Error(response.status === 404 ? "Musician not found" : "Unable to load musician")
  const body = (await response.json()) as { data: PublicMusician }
  return body.data
}
