import dotenv from "dotenv"
import { setTimeout as delay } from "node:timers/promises"

dotenv.config({ path: ".env.local" })

async function runWorker() {
  const [{ pool }, { processNextOutboxEvent, purgeCompletedOutboxEvents }] = await Promise.all([
    import("../lib/db"),
    import("../modules/admin"),
  ])
  const retentionIntervalMs = 24 * 60 * 60 * 1_000
  let stopping = false
  let nextRetentionRun = 0
  process.once("SIGINT", () => {
    stopping = true
  })
  process.once("SIGTERM", () => {
    stopping = true
  })

  console.info("Outbox worker started")

  try {
    while (!stopping) {
      if (Date.now() >= nextRetentionRun) {
        try {
          const purged = await purgeCompletedOutboxEvents()
          if (purged > 0) console.info(`Purged ${purged} completed outbox events`)
          nextRetentionRun = Date.now() + retentionIntervalMs
        } catch (error) {
          console.error("Outbox retention cleanup failed", error)
          nextRetentionRun = Date.now() + 60 * 60 * 1_000
        }
      }

      try {
        const processed = await processNextOutboxEvent()
        if (processed) console.info("Processed an outbox event")
        else await delay(1_000)
      } catch (error) {
        console.error("Outbox event failed and was scheduled for retry", error)
        await delay(1_000)
      }
    }
  } finally {
    await pool.end()
    console.info("Outbox worker stopped")
  }
}

void runWorker().catch((error: unknown) => {
  console.error("Outbox worker could not start", error)
  process.exitCode = 1
})
