import { betterAuth } from "better-auth"
import { pool } from "@/lib/db"
import { ensureSuperAdminBootstrap } from "@/lib/bootstrap-admin"
import { getAuthTrustedOrigins } from "@/lib/auth-origins"
import { isIdentityUserBanned } from "@/modules/identity"

const baseUrl =
  process.env.BETTER_AUTH_URL ??
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.V0_RUNTIME_URL ?? "http://localhost:3000")
const authSecret = process.env.BETTER_AUTH_SECRET
const trustedOrigins = getAuthTrustedOrigins({
  baseUrl,
  nodeEnv: process.env.NODE_ENV,
  vercelUrl: process.env.VERCEL_URL,
  vercelProductionUrl: process.env.VERCEL_PROJECT_PRODUCTION_URL,
  trustedOrigins: process.env.BETTER_AUTH_TRUSTED_ORIGINS,
  mobileWebOrigin: process.env.MOBILE_WEB_ORIGIN,
  v0Origins: [
    process.env.V0_RUNTIME_URL,
    process.env.V0_DEV_APP_URL,
    process.env.V0_BUILD_URL,
    process.env.V0_SANDBOX_URL,
  ].filter((origin): origin is string => Boolean(origin)),
})

if (process.env.NODE_ENV === "production" && !authSecret) {
  throw new Error("BETTER_AUTH_SECRET must be configured in production")
}

if (process.env.NODE_ENV !== "test" && process.env.NEXT_PHASE !== "phase-production-build") {
  void ensureSuperAdminBootstrap()
}

export const auth = betterAuth({
  database: pool,
  ...(authSecret ? { secret: authSecret } : {}),
  baseURL: baseUrl,
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 8,
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "MUSICIAN",
        input: true,
      },
      banned: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,
      },
    },
  },
  trustedOrigins,
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          return (await isIdentityUserBanned(session.userId)) ? false : undefined
        },
      },
    },
    user: {
      create: {
        before: async (userData) => {
          // Never let a client self-assign a privileged role at sign-up.
          // Only MUSICIAN and AUDIENCE may be chosen; SUPER_ADMIN is granted manually.
          const requested = (userData as { role?: string }).role
          const role = requested === "AUDIENCE" ? "AUDIENCE" : "MUSICIAN"
          return { data: { ...userData, role, banned: false } }
        },
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  ...(process.env.NODE_ENV === "development"
    ? {
        advanced: {
          // Required by the cross-site v0 preview iframe. Without these
          // attributes, login succeeds but the next request appears signed out.
          defaultCookieAttributes: {
            sameSite: "none" as const,
            secure: true,
          },
        },
      }
    : {}),
})
