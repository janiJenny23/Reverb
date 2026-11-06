import {
  pgTable,
  text,
  timestamp,
  boolean,
  serial,
  integer,
  date,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core"

// ---------------------------------------------------------------------------
// Better Auth tables (camelCase columns to match Better Auth defaults)
// ---------------------------------------------------------------------------

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  role: text("role").notNull().default("MUSICIAN"),
  banned: boolean("banned").notNull().default(false),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
})

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
})

// ---------------------------------------------------------------------------
// Application tables (plain userId columns for scoping, no FK constraints)
// ---------------------------------------------------------------------------

export const genre = pgTable("genre", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const musicianProfile = pgTable("musician_profile", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull().unique(),
  displayName: text("displayName").notNull(),
  bio: text("bio"),
  primaryGenre: text("primaryGenre"),
  imageUrl: text("imageUrl"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const project = pgTable("project", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  artworkUrl: text("artworkUrl"),
  createdDate: date("createdDate"),
  releaseDate: date("releaseDate"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const work = pgTable("work", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  projectId: integer("projectId"),
  genreId: integer("genreId"),
  title: text("title").notNull(),
  artist: text("artist").notNull(),
  createdDate: date("createdDate"),
  releasedDate: date("releasedDate"),
  duration: integer("duration"),
  composer: text("composer"),
  lyricist: text("lyricist"),
  producer: text("producer"),
  recording: text("recording"),
  version: text("version"),
  audioUrl: text("audioUrl").notNull(),
  artworkUrl: text("artworkUrl"),
  lyrics: text("lyrics"),
  fileSize: integer("fileSize"),
  format: text("format"),
  status: text("status").notNull().default("PUBLISHED"),
  playCount: integer("playCount").notNull().default(0),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const favorite = pgTable("favorite", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  workId: integer("workId").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("favorite_user_work_unique").on(table.userId, table.workId),
])

export const report = pgTable("report", {
  id: serial("id").primaryKey(),
  workId: integer("workId").notNull(),
  reporterId: text("reporterId"),
  reason: text("reason").notNull(),
  details: text("details"),
  status: text("status").notNull().default("OPEN"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const discoverHero = pgTable("discover_content", {
  id: serial("id").primaryKey(),
  title: text("title").notNull().default("Discover background"),
  description: text("description"),
  imageUrl: text("imageUrl").notNull(),
  status: text("status").notNull().default("PUBLISHED"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const outboxEvent = pgTable("outbox_event", {
  id: serial("id").primaryKey(),
  eventType: text("eventType").notNull(),
  aggregateId: integer("aggregateId").notNull(),
  status: text("status").notNull().default("PENDING"),
  attempts: integer("attempts").notNull().default(0),
  availableAt: timestamp("availableAt", { withTimezone: true }).notNull().defaultNow(),
  lockedAt: timestamp("lockedAt", { withTimezone: true }),
  lastError: text("lastError"),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("outbox_event_type_aggregate_unique").on(table.eventType, table.aggregateId),
  index("outbox_status_available_idx").on(table.status, table.availableAt),
])

export type Work = typeof work.$inferSelect
export type Project = typeof project.$inferSelect
export type Genre = typeof genre.$inferSelect
export type MusicianProfile = typeof musicianProfile.$inferSelect
export type User = typeof user.$inferSelect
export type Report = typeof report.$inferSelect
export type DiscoverHero = typeof discoverHero.$inferSelect
export type OutboxEvent = typeof outboxEvent.$inferSelect
