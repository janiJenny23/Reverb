import { randomUUID } from "node:crypto"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { eq } from "drizzle-orm"

const databaseIntegrationEnabled = process.env.RUN_DATABASE_INTEGRATION_TESTS === "1"
const databaseDescribe = databaseIntegrationEnabled ? describe : describe.skip
if (databaseIntegrationEnabled) {
  const testDatabaseUrl = process.env.TEST_DATABASE_URL
  if (!testDatabaseUrl) {
    throw new Error("TEST_DATABASE_URL is required when RUN_DATABASE_INTEGRATION_TESTS=1")
  }
  const databaseName = decodeURIComponent(new URL(testDatabaseUrl).pathname.slice(1))
  if (!databaseName.endsWith("_test")) {
    throw new Error("TEST_DATABASE_URL must point to a database whose name ends with _test")
  }
  process.env.DATABASE_URL = testDatabaseUrl
}

databaseDescribe("Cross-module database mutations", () => {
  let database: typeof import("@/lib/db").db
  let pool: typeof import("@/lib/db").pool
  let tables: typeof import("@/lib/db/schema")
  let adminDeleteWork: typeof import("@/modules/admin").adminDeleteWork
  let deleteGenre: typeof import("@/modules/admin").deleteGenre
  let hideReportedWork: typeof import("@/modules/moderation").hideReportedWork
  let saveMusicianProfile: (typeof import("@/modules/profiles"))["saveMusicianProfile"]
  let deleteProject: (typeof import("@/modules/archive"))["deleteProject"]
  let setUserRole: (typeof import("@/modules/identity"))["setUserRole"]
  let setUserBanned: (typeof import("@/modules/identity"))["setUserBanned"]
  const workIds: number[] = []
  const genreIds: number[] = []
  const projectIds: number[] = []
  const guardTables: string[] = []
  const reportConstraints: string[] = []
  const userConstraints: string[] = []
  const userIds: string[] = []

  beforeAll(async () => {
    const [
      databaseModule,
      schemaModule,
      adminModule,
      moderationModule,
      profilesModule,
      archiveModule,
      identityModule,
    ] = await Promise.all([
      import("@/lib/db"),
      import("@/lib/db/schema"),
      import("@/modules/admin"),
      import("@/modules/moderation"),
      import("@/modules/profiles"),
      import("@/modules/archive"),
      import("@/modules/identity"),
    ])
    database = databaseModule.db
    pool = databaseModule.pool
    tables = schemaModule
    adminDeleteWork = adminModule.adminDeleteWork
    deleteGenre = adminModule.deleteGenre
    hideReportedWork = moderationModule.hideReportedWork
    saveMusicianProfile = profilesModule.saveMusicianProfile
    deleteProject = archiveModule.deleteProject
    setUserRole = identityModule.setUserRole
    setUserBanned = identityModule.setUserBanned
  })

  afterEach(async () => {
    for (const constraintName of userConstraints.splice(0)) {
      await pool.query(`ALTER TABLE public."user" DROP CONSTRAINT IF EXISTS "${constraintName}"`)
    }
    for (const constraintName of reportConstraints.splice(0)) {
      await pool.query(`ALTER TABLE public."report" DROP CONSTRAINT IF EXISTS "${constraintName}"`)
    }
    for (const tableName of guardTables.splice(0)) {
      await pool.query(`DROP TABLE IF EXISTS public."${tableName}"`)
    }
    for (const workId of workIds.splice(0)) {
      await database.delete(tables.favorite).where(eq(tables.favorite.workId, workId))
      await database.delete(tables.report).where(eq(tables.report.workId, workId))
      await database.delete(tables.work).where(eq(tables.work.id, workId))
    }
    for (const projectId of projectIds.splice(0)) {
      await database.delete(tables.project).where(eq(tables.project.id, projectId))
    }
    for (const genreId of genreIds.splice(0)) {
      await database.delete(tables.genre).where(eq(tables.genre.id, genreId))
    }
    for (const userId of userIds.splice(0)) {
      await database.delete(tables.musicianProfile).where(eq(tables.musicianProfile.userId, userId))
      await database.delete(tables.user).where(eq(tables.user.id, userId))
    }
  })

  afterAll(async () => {
    if (pool) await pool.end()
  })

  it("deletes a work together with its favorites and reports", async () => {
    const workId = await createWork()
    await database.insert(tables.favorite).values({
      userId: `integration-${randomUUID()}`,
      workId,
    })
    await database.insert(tables.report).values({
      workId,
      reason: "Integration test fixture",
    })

    await adminDeleteWork(workId)

    const [works, favorites, reports] = await Promise.all([
      database.select({ id: tables.work.id }).from(tables.work).where(eq(tables.work.id, workId)),
      database
        .select({ id: tables.favorite.id })
        .from(tables.favorite)
        .where(eq(tables.favorite.workId, workId)),
      database
        .select({ id: tables.report.id })
        .from(tables.report)
        .where(eq(tables.report.workId, workId)),
    ])

    expect(works).toEqual([])
    expect(favorites).toEqual([])
    expect(reports).toEqual([])
  })

  it("rolls back favorite deletion when report cleanup fails", async () => {
    const workId = await createWork()
    await database.insert(tables.favorite).values({
      userId: `integration-${randomUUID()}`,
      workId,
    })
    const [createdReport] = await database
      .insert(tables.report)
      .values({ workId, reason: "Integration rollback test" })
      .returning({ id: tables.report.id })
    const guardTable = createGuardTableName()
    await createReportDeleteGuard(guardTable, createdReport.id)

    await expect(adminDeleteWork(workId)).rejects.toBeDefined()

    const [works, favorites, reports] = await Promise.all([
      database.select({ id: tables.work.id }).from(tables.work).where(eq(tables.work.id, workId)),
      database
        .select({ id: tables.favorite.id })
        .from(tables.favorite)
        .where(eq(tables.favorite.workId, workId)),
      database
        .select({ id: tables.report.id })
        .from(tables.report)
        .where(eq(tables.report.id, createdReport.id)),
    ])

    expect(works).toHaveLength(1)
    expect(favorites).toHaveLength(1)
    expect(reports).toHaveLength(1)
  })

  it("removes a genre and clears its references from existing works", async () => {
    const [createdGenre] = await database
      .insert(tables.genre)
      .values({
        name: `Integration ${randomUUID()}`,
        slug: `integration-${randomUUID()}`,
      })
      .returning({ id: tables.genre.id })
    genreIds.push(createdGenre.id)
    const workId = await createWork(createdGenre.id)

    await deleteGenre(createdGenre.id)

    const [genres, works] = await Promise.all([
      database
        .select({ id: tables.genre.id })
        .from(tables.genre)
        .where(eq(tables.genre.id, createdGenre.id)),
      database
        .select({ genreId: tables.work.genreId })
        .from(tables.work)
        .where(eq(tables.work.id, workId)),
    ])

    expect(genres).toEqual([])
    expect(works).toEqual([{ genreId: null }])
  })

  it("rolls back cleared work references when genre deletion fails", async () => {
    const [createdGenre] = await database
      .insert(tables.genre)
      .values({
        name: `Integration ${randomUUID()}`,
        slug: `integration-${randomUUID()}`,
      })
      .returning({ id: tables.genre.id })
    genreIds.push(createdGenre.id)
    const workId = await createWork(createdGenre.id)
    const guardTable = createGuardTableName()
    await createGenreDeleteGuard(guardTable, createdGenre.id)

    await expect(deleteGenre(createdGenre.id)).rejects.toBeDefined()

    const [genres, works] = await Promise.all([
      database
        .select({ id: tables.genre.id })
        .from(tables.genre)
        .where(eq(tables.genre.id, createdGenre.id)),
      database
        .select({ genreId: tables.work.genreId })
        .from(tables.work)
        .where(eq(tables.work.id, workId)),
    ])

    expect(genres).toHaveLength(1)
    expect(works).toEqual([{ genreId: createdGenre.id }])
  })

  it("hides reported work and resolves the report together", async () => {
    const workId = await createWork()
    const [createdReport] = await database
      .insert(tables.report)
      .values({ workId, reason: "Integration moderation test" })
      .returning({ id: tables.report.id })

    await expect(hideReportedWork(createdReport.id)).resolves.toBe(workId)

    const [works, reports] = await Promise.all([
      database
        .select({ status: tables.work.status })
        .from(tables.work)
        .where(eq(tables.work.id, workId)),
      database
        .select({ status: tables.report.status })
        .from(tables.report)
        .where(eq(tables.report.id, createdReport.id)),
    ])

    expect(works).toEqual([{ status: "HIDDEN" }])
    expect(reports).toEqual([{ status: "RESOLVED" }])
  })

  it("rolls back work hiding when report resolution fails", async () => {
    const workId = await createWork()
    const [createdReport] = await database
      .insert(tables.report)
      .values({ workId, reason: "Integration moderation rollback test" })
      .returning({ id: tables.report.id })
    const constraintName = `integration_report_status_${randomUUID().replaceAll("-", "")}`
    reportConstraints.push(constraintName)
    await pool.query(
      `ALTER TABLE public."report" ADD CONSTRAINT "${constraintName}" CHECK ("id" <> ${createdReport.id} OR "status" <> 'RESOLVED')`,
    )

    await expect(hideReportedWork(createdReport.id)).rejects.toBeDefined()

    const [works, reports] = await Promise.all([
      database
        .select({ status: tables.work.status })
        .from(tables.work)
        .where(eq(tables.work.id, workId)),
      database
        .select({ status: tables.report.status })
        .from(tables.report)
        .where(eq(tables.report.id, createdReport.id)),
    ])

    expect(works).toEqual([{ status: "PUBLISHED" }])
    expect(reports).toEqual([{ status: "OPEN" }])
  })

  it("creates and updates a profile together with the account display name", async () => {
    const userId = await createMusicianAccount()

    await saveMusicianProfile(userId, {
      displayName: "  Profile Artist  ",
      bio: "First bio",
      primaryGenre: "Jazz",
    })

    const [createdProfile] = await database
      .select({
        displayName: tables.musicianProfile.displayName,
        bio: tables.musicianProfile.bio,
        primaryGenre: tables.musicianProfile.primaryGenre,
      })
      .from(tables.musicianProfile)
      .where(eq(tables.musicianProfile.userId, userId))
    const [createdAccount] = await database
      .select({ name: tables.user.name })
      .from(tables.user)
      .where(eq(tables.user.id, userId))

    expect(createdProfile).toEqual({
      displayName: "Profile Artist",
      bio: "First bio",
      primaryGenre: "Jazz",
    })
    expect(createdAccount.name).toBe("Profile Artist")

    await saveMusicianProfile(userId, {
      displayName: "Updated Artist",
      bio: "Updated bio",
      primaryGenre: "Soul",
    })

    const [updatedProfile] = await database
      .select({
        displayName: tables.musicianProfile.displayName,
        bio: tables.musicianProfile.bio,
        primaryGenre: tables.musicianProfile.primaryGenre,
      })
      .from(tables.musicianProfile)
      .where(eq(tables.musicianProfile.userId, userId))
    const [updatedAccount] = await database
      .select({ name: tables.user.name })
      .from(tables.user)
      .where(eq(tables.user.id, userId))

    expect(updatedProfile).toEqual({
      displayName: "Updated Artist",
      bio: "Updated bio",
      primaryGenre: "Soul",
    })
    expect(updatedAccount.name).toBe("Updated Artist")
  })

  it("rolls back profile changes when account display-name update fails", async () => {
    const userId = await createMusicianAccount()
    const constraintName = `integration_user_name_${randomUUID().replaceAll("-", "")}`
    userConstraints.push(constraintName)
    await pool.query(
      `ALTER TABLE public."user" ADD CONSTRAINT "${constraintName}" CHECK ("id" <> '${userId}' OR "name" <> 'Rejected Name')`,
    )

    await expect(
      saveMusicianProfile(userId, {
        displayName: "Rejected Name",
        bio: "Should roll back",
        primaryGenre: "Should roll back",
      }),
    ).rejects.toBeDefined()

    const [profiles] = await Promise.all([
      database
        .select({ id: tables.musicianProfile.id })
        .from(tables.musicianProfile)
        .where(eq(tables.musicianProfile.userId, userId)),
    ])
    const [account] = await database
      .select({ name: tables.user.name })
      .from(tables.user)
      .where(eq(tables.user.id, userId))

    expect(profiles).toEqual([])
    expect(account.name).toBe("Integration musician")
  })

  it("deletes a project while preserving its artwork on attached works", async () => {
    const project = await createProject()
    const workId = await createWork(undefined, project.id, project.userId)

    await deleteProject(project.userId, project.id)

    const [projects, works] = await Promise.all([
      database
        .select({ id: tables.project.id })
        .from(tables.project)
        .where(eq(tables.project.id, project.id)),
      database
        .select({ projectId: tables.work.projectId, artworkUrl: tables.work.artworkUrl })
        .from(tables.work)
        .where(eq(tables.work.id, workId)),
    ])

    expect(projects).toEqual([])
    expect(works).toEqual([{ projectId: null, artworkUrl: project.artworkUrl }])
  })

  it("rolls back project work detachment when project deletion fails", async () => {
    const project = await createProject()
    const workId = await createWork(undefined, project.id, project.userId)
    const guardTable = createGuardTableName()
    await pool.query(
      `CREATE TABLE public."${guardTable}" (project_id integer NOT NULL REFERENCES public."project"("id") ON DELETE RESTRICT)`,
    )
    await pool.query(`INSERT INTO public."${guardTable}" (project_id) VALUES ($1)`, [project.id])

    await expect(deleteProject(project.userId, project.id)).rejects.toBeDefined()

    const [projects, works] = await Promise.all([
      database
        .select({ id: tables.project.id })
        .from(tables.project)
        .where(eq(tables.project.id, project.id)),
      database
        .select({ projectId: tables.work.projectId })
        .from(tables.work)
        .where(eq(tables.work.id, workId)),
    ])

    expect(projects).toHaveLength(1)
    expect(works).toEqual([{ projectId: project.id }])
  })

  it("changes account roles and bans while revoking active sessions", async () => {
    const userId = await createMusicianAccount()
    const roleSessionId = await createSession(userId)

    await setUserRole("integration-admin", userId, "AUDIENCE")

    const [roleAccount, roleSessions] = await Promise.all([
      database.select({ role: tables.user.role }).from(tables.user).where(eq(tables.user.id, userId)),
      database
        .select({ id: tables.session.id })
        .from(tables.session)
        .where(eq(tables.session.id, roleSessionId)),
    ])
    expect(roleAccount).toEqual([{ role: "AUDIENCE" }])
    expect(roleSessions).toEqual([])

    const banSessionId = await createSession(userId)
    await setUserBanned("integration-admin", userId, true)

    const [bannedAccount, banSessions] = await Promise.all([
      database.select({ banned: tables.user.banned }).from(tables.user).where(eq(tables.user.id, userId)),
      database
        .select({ id: tables.session.id })
        .from(tables.session)
        .where(eq(tables.session.id, banSessionId)),
    ])
    expect(bannedAccount).toEqual([{ banned: true }])
    expect(banSessions).toEqual([])
  })

  it("rolls back a role change when session revocation fails", async () => {
    const userId = await createMusicianAccount()
    const sessionId = await createSession(userId)
    const guardTable = createGuardTableName()
    await pool.query(
      `CREATE TABLE public."${guardTable}" (session_id text NOT NULL REFERENCES public."session"("id") ON DELETE RESTRICT)`,
    )
    await pool.query(`INSERT INTO public."${guardTable}" (session_id) VALUES ($1)`, [sessionId])

    await expect(setUserRole("integration-admin", userId, "AUDIENCE")).rejects.toBeDefined()

    const [accounts, sessions] = await Promise.all([
      database.select({ role: tables.user.role }).from(tables.user).where(eq(tables.user.id, userId)),
      database
        .select({ id: tables.session.id })
        .from(tables.session)
        .where(eq(tables.session.id, sessionId)),
    ])
    expect(accounts).toEqual([{ role: "MUSICIAN" }])
    expect(sessions).toHaveLength(1)
  })

  async function createProject() {
    const userId = `integration-${randomUUID()}`
    const artworkUrl = "https://example.test/integration-project-artwork.png"
    const [createdProject] = await database
      .insert(tables.project)
      .values({
        userId,
        title: `Integration ${randomUUID()}`,
        artworkUrl,
      })
      .returning({ id: tables.project.id })
    projectIds.push(createdProject.id)
    return { ...createdProject, userId, artworkUrl }
  }

  async function createWork(genreId?: number, projectId?: number, userId = `integration-${randomUUID()}`) {
    const [createdWork] = await database
      .insert(tables.work)
      .values({
        userId,
        title: `Integration ${randomUUID()}`,
        artist: "Integration test",
        audioUrl: "https://example.test/integration-audio.mp3",
        status: "PUBLISHED",
        genreId,
        projectId,
      })
      .returning({ id: tables.work.id })
    workIds.push(createdWork.id)
    return createdWork.id
  }

  async function createMusicianAccount() {
    const userId = `integration-${randomUUID()}`
    userIds.push(userId)
    await database.insert(tables.user).values({
      id: userId,
      name: "Integration musician",
      email: `${userId}@example.test`,
      role: "MUSICIAN",
      banned: false,
    })
    return userId
  }

  async function createSession(userId: string) {
    const id = randomUUID()
    await database.insert(tables.session).values({
      id,
      userId,
      token: randomUUID(),
      expiresAt: new Date(Date.now() + 60_000),
    })
    return id
  }

  function createGuardTableName() {
    const tableName = `integration_guard_${randomUUID().replaceAll("-", "")}`
    guardTables.push(tableName)
    return tableName
  }

  async function createReportDeleteGuard(tableName: string, reportId: number) {
    await pool.query(
      `CREATE TABLE public."${tableName}" (report_id integer NOT NULL REFERENCES public."report"("id") ON DELETE RESTRICT)`,
    )
    await pool.query(`INSERT INTO public."${tableName}" (report_id) VALUES ($1)`, [reportId])
  }

  async function createGenreDeleteGuard(tableName: string, genreId: number) {
    await pool.query(
      `CREATE TABLE public."${tableName}" (genre_id integer NOT NULL REFERENCES public."genre"("id") ON DELETE RESTRICT)`,
    )
    await pool.query(`INSERT INTO public."${tableName}" (genre_id) VALUES ($1)`, [genreId])
  }
})
