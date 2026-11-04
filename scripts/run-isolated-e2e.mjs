import { randomBytes, randomUUID } from "node:crypto"
import { createServer } from "node:net"
import { spawn } from "node:child_process"
import { setTimeout as delay } from "node:timers/promises"
import dotenv from "dotenv"
import { hashPassword } from "better-auth/crypto"
import pg from "pg"

dotenv.config({ path: ".env.local", quiet: true })

const { Pool } = pg
const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to create a disposable local E2E database")
}

const sourceUrl = new URL(databaseUrl)
const localHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"])
if (!localHosts.has(sourceUrl.hostname)) {
  throw new Error("Isolated E2E tests only support a local PostgreSQL server; remote hosts are refused")
}

const databaseName = `musikapp_e2e_${process.pid}_${randomBytes(4).toString("hex")}_test`
if (!/^[a-z0-9_]+$/.test(databaseName)) {
  throw new Error("Generated E2E database name is invalid")
}

const adminUrl = new URL(sourceUrl)
adminUrl.pathname = "/postgres"
const testUrl = new URL(sourceUrl)
testUrl.pathname = `/${databaseName}`
const adminEmail = `admin-${randomUUID()}@e2e.musikapp.test`
const audienceEmail = `listener-${randomUUID()}@e2e.musikapp.test`
const adminPassword = `${randomBytes(18).toString("base64url")}A1!`
const testPassword = `${randomBytes(18).toString("base64url")}A1!`
const adminPool = new Pool({ connectionString: adminUrl.toString(), max: 1 })
let databaseCreated = false
let server
let serverStartError

function run(command, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: process.cwd(), env, stdio: "inherit" })
    child.once("error", reject)
    child.once("exit", (code, signal) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} exited with ${signal ?? `code ${code}`}`))
    })
  })
}

async function findAvailablePort() {
  const listener = createServer()
  await new Promise((resolve, reject) => {
    listener.once("error", reject)
    listener.listen(0, "127.0.0.1", resolve)
  })
  const address = listener.address()
  if (!address || typeof address === "string") {
    listener.close()
    throw new Error("Could not determine a local E2E server port")
  }
  await new Promise((resolve, reject) => listener.close((error) => error ? reject(error) : resolve()))
  return address.port
}

async function seedDatabase(audienceEmail) {
  const pool = new Pool({ connectionString: testUrl.toString(), max: 1 })
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    const userId = randomUUID()
    const audienceId = randomUUID()
    const now = new Date()
    const hashedPassword = await hashPassword(adminPassword)
    const audiencePassword = await hashPassword(testPassword)
    await client.query(
      `INSERT INTO "user" ("id", "name", "email", "emailVerified", "role", "banned", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, true, 'SUPER_ADMIN', false, $4, $4)`,
      [userId, "E2E Admin", adminEmail, now],
    )
    await client.query(
      `INSERT INTO "user" ("id", "name", "email", "emailVerified", "role", "banned", "createdAt", "updatedAt")
       VALUES ($1, 'E2E Listener', $2, true, 'AUDIENCE', false, $3, $3)`,
      [audienceId, audienceEmail, now],
    )
    await client.query(
      `INSERT INTO "account" ("id", "accountId", "providerId", "userId", "password", "createdAt", "updatedAt")
       VALUES ($1, $2, 'credential', $2, $3, $4, $4)`,
      [randomUUID(), userId, hashedPassword, now],
    )
    await client.query(
      `INSERT INTO "account" ("id", "accountId", "providerId", "userId", "password", "createdAt", "updatedAt")
       VALUES ($1, $2, 'credential', $2, $3, $4, $4)`,
      [randomUUID(), audienceId, audiencePassword, now],
    )
    const genre = await client.query(
      `INSERT INTO "genre" ("name", "slug") VALUES ('E2E Genre', 'e2e-genre') RETURNING "id"`,
    )
    const work = await client.query(
      `INSERT INTO "work" ("userId", "genreId", "title", "artist", "audioUrl", "format", "status")
       VALUES ($1, $2, 'E2E Isolated Work', 'E2E Admin', 'https://example.test/e2e-fixture.mp3', 'mp3', 'PUBLISHED')
       RETURNING "id"`,
      [userId, genre.rows[0].id],
    )
    await client.query("COMMIT")
    return String(work.rows[0].id)
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

async function waitForServer(baseUrl) {
  let lastStatus = "not started"
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (serverStartError) throw serverStartError
    if (server.exitCode !== null) {
      throw new Error(`Next.js E2E server exited early with code ${server.exitCode}`)
    }
    try {
      const response = await fetch(`${baseUrl}/api/v1/works`, { signal: AbortSignal.timeout(2000) })
      lastStatus = String(response.status)
      if (response.status === 200) return
    } catch (error) {
      lastStatus = error instanceof Error ? error.message : "request failed"
    }
    await delay(1000)
  }
  throw new Error(`Next.js E2E server did not become ready (last response: ${lastStatus})`)
}

async function stopServer() {
  if (!server?.pid || server.exitCode !== null || server.signalCode !== null) return
  const exited = new Promise((resolve) => server.once("exit", resolve))
  if (process.platform === "win32") server.kill("SIGTERM")
  else process.kill(-server.pid, "SIGTERM")
  const timeout = delay(10000).then(() => false)
  const didExit = await Promise.race([exited.then(() => true), timeout])
  if (!didExit && server.exitCode === null && server.signalCode === null) {
    if (process.platform === "win32") server.kill("SIGKILL")
    else process.kill(-server.pid, "SIGKILL")
    await exited
  }
}

try {
  const existing = await adminPool.query("SELECT 1 FROM pg_database WHERE datname = $1", [databaseName])
  if (existing.rowCount) throw new Error("Refusing to overwrite an existing E2E database")
  await adminPool.query(`CREATE DATABASE "${databaseName}"`)
  databaseCreated = true
  console.log(`Created isolated database ${databaseName}`)

  const environment = {
    ...process.env,
    DATABASE_URL: testUrl.toString(),
    SUPER_ADMIN_EMAIL: adminEmail,
    SUPER_ADMIN_PASSWORD: adminPassword,
  }
  await run("pnpm", ["db:migrate"], environment)
  const workId = await seedDatabase(audienceEmail)
  const port = await findAvailablePort()
  const baseUrl = `http://localhost:${port}`
  const serverEnvironment = {
    ...environment,
    BETTER_AUTH_URL: baseUrl,
    BETTER_AUTH_TRUSTED_ORIGINS: baseUrl,
    BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_e2e_fake_secret",
    NEXT_TELEMETRY_DISABLED: "1",
  }

  server = spawn("pnpm", ["exec", "next", "dev", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: process.cwd(),
    env: serverEnvironment,
    stdio: "inherit",
    detached: process.platform !== "win32",
  })
  server.once("error", (error) => {
    serverStartError = error
  })

  await waitForServer(baseUrl)
  console.log("Running isolated mobile API E2E")
  await run("bash", ["scripts/mobile-api-e2e.sh"], {
    ...serverEnvironment,
    BASE_URL: baseUrl,
    PASSWORD: testPassword,
  })
  console.log("Running isolated browser E2E")
  await run("pnpm", ["exec", "playwright", "test"], {
    ...serverEnvironment,
    E2E_BASE_URL: baseUrl,
    E2E_WORK_ID: workId,
    E2E_ADMIN_EMAIL: adminEmail,
    E2E_ADMIN_PASSWORD: adminPassword,
    E2E_AUDIENCE_EMAIL: audienceEmail,
    E2E_AUDIENCE_PASSWORD: testPassword,
    E2E_PASSWORD: testPassword,
  })
} finally {
  try {
    await stopServer()
  } finally {
    try {
      if (databaseCreated) {
        await adminPool.query(
          "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
          [databaseName],
        )
        await adminPool.query(`DROP DATABASE "${databaseName}"`)
        console.log(`Dropped isolated database ${databaseName}`)
      }
    } finally {
      await adminPool.end()
    }
  }
}
