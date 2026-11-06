import { adminDeleteWork, getAllWorks, retryWorkDeletion, setWorkStatus } from "@/app/actions/admin"
import { requireRole } from "@/lib/session"
import { ConfirmSubmitButton } from "@/components/confirm-submit-button"
import { WORK_DELETION_PENDING } from "@/modules/archive"

export default async function AdminWorksPage() {
  await requireRole(["SUPER_ADMIN"])
  const works = await getAllWorks()

  return (
    <div className="mx-auto max-w-[1500px]">
      <div className="mb-6">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Archive moderation</p>
        <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight">Works</h1>
        <p className="mt-2 text-sm text-muted-foreground">Review published works and manage their visibility.</p>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="divide-y divide-border">
          {works.map((work) => {
            const deletionPending = work.status === WORK_DELETION_PENDING
            const deletionFailure = deletionPending ? work.deletionFailure : null

            return (
              <div key={work.id} className="flex flex-col gap-4 p-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted">
                    {work.artworkUrl ? <img src={work.artworkUrl} alt="" className="h-full w-full object-cover" /> : <span className="text-muted-foreground">♪</span>}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{work.title}</p>
                    <p className="truncate text-sm text-muted-foreground">{work.artist}{work.ownerName ? ` · ${work.ownerName}` : ""}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${deletionFailure ? "bg-destructive/15 text-destructive" : work.status === "PUBLISHED" ? "bg-emerald-400/15 text-emerald-300" : "bg-amber-400/15 text-amber-300"}`}>
                    {deletionFailure ? "DELETION FAILED" : deletionPending ? "DELETION QUEUED" : work.status}
                  </span>
                  <span className="mr-2 text-xs text-muted-foreground">{work.genreName ?? "Uncategorized"}</span>
                  <form
                    action={async () => {
                      "use server"
                      await setWorkStatus(work.id, work.status === "PUBLISHED" ? "HIDDEN" : "PUBLISHED")
                    }}
                  >
                    <button type="submit" disabled={deletionPending} className="rounded-lg border border-border px-3 py-2 text-xs font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50">
                      {work.status === "PUBLISHED" ? "Hide" : "Publish"}
                    </button>
                  </form>
                  {deletionFailure ? (
                    <div className="flex flex-col items-start gap-2 sm:items-end">
                      <p className="max-w-md text-xs text-destructive">
                        Failed after {deletionFailure.attempts} attempts: {deletionFailure.lastError ?? "Unknown error"}
                      </p>
                      <form
                        action={async () => {
                          "use server"
                          await retryWorkDeletion(work.id)
                        }}
                      >
                        <ConfirmSubmitButton
                          message="Queue this deletion for another set of attempts?"
                          className="rounded-lg border border-destructive/40 px-3 py-2 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
                        >
                          Retry deletion
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                  ) : deletionPending ? (
                    <span className="px-3 py-2 text-xs text-muted-foreground">Cleanup is queued and retries automatically</span>
                  ) : (
                    <form
                      action={async () => {
                        "use server"
                        await adminDeleteWork(work.id)
                      }}
                    >
                      <ConfirmSubmitButton
                        message="Delete this work permanently? This action cannot be undone."
                        className="rounded-lg border border-destructive/40 px-3 py-2 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
                      >
                        Delete
                      </ConfirmSubmitButton>
                    </form>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        {works.length === 0 ? <p className="px-5 py-10 text-center text-sm text-muted-foreground">No works have been published.</p> : null}
      </div>
    </div>
  )
}
