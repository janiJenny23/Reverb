import Link from "next/link"
import {
  AlertTriangle,
  AudioLines,
  Disc3,
  FolderKanban,
  Headphones,
  Image,
  Music2,
  Tags,
  UsersRound,
} from "lucide-react"
import { getAdminStats, getRecentAdminWorks, getRecentReports } from "@/app/actions/admin"
import { requireRole } from "@/lib/session"

export default async function AdminPage() {
  const user = await requireRole(["SUPER_ADMIN"])
  const [stats, works, reports] = await Promise.all([
    getAdminStats(),
    getRecentAdminWorks(),
    getRecentReports(),
  ])

  const metrics = [
    { label: "Total users", value: stats.totalUsers, icon: UsersRound, color: "text-indigo-300", tint: "bg-indigo-400/15" },
    { label: "Total musicians", value: stats.totalMusicians, icon: Music2, color: "text-violet-300", tint: "bg-violet-400/15" },
    { label: "Total audiences", value: stats.totalAudiences, icon: Headphones, color: "text-emerald-300", tint: "bg-emerald-400/15" },
    { label: "Total works", value: stats.totalWorks, icon: AudioLines, color: "text-amber-300", tint: "bg-amber-400/15" },
    { label: "Total projects", value: stats.totalProjects, icon: FolderKanban, color: "text-cyan-300", tint: "bg-cyan-400/15" },
    { label: "Total genres", value: stats.totalGenres, icon: Tags, color: "text-pink-300", tint: "bg-pink-400/15" },
    { label: "Total reports", value: stats.totalReports, icon: Disc3, color: "text-rose-300", tint: "bg-rose-400/15" },
    { label: "Open reports", value: stats.openReports, icon: AlertTriangle, color: "text-orange-300", tint: "bg-orange-400/15" },
  ]

  return (
    <div className="mx-auto max-w-[1600px] space-y-7">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Platform overview</p>
          <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
            Welcome, <span className="text-sidebar-primary">{user.name}</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">Here&apos;s the current state of Reverb.</p>
        </div>
        <p className="text-sm text-muted-foreground">
          {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date())}
        </p>
      </div>

      <section aria-label="Platform statistics" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6">
        {metrics.map((metric) => {
          const Icon = metric.icon
          return (
            <div className="rounded-2xl border border-border bg-card p-4 sm:p-5" key={metric.label}>
              <div className="flex items-center gap-3">
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${metric.tint} ${metric.color}`}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <p className="text-sm text-muted-foreground">{metric.label}</p>
              </div>
              <p className="mt-4 font-serif text-3xl font-semibold tracking-tight">{metric.value}</p>
            </div>
          )
        })}
      </section>

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.85fr)]">
        <section className="rounded-2xl border border-border bg-card">
          <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
            <div>
              <div className="flex items-center gap-2">
                <AudioLines className="h-4 w-4 text-sidebar-primary" aria-hidden="true" />
                <h2 className="font-semibold">Recent works</h2>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Latest works added to the archive</p>
            </div>
            <Link className="text-xs font-medium text-sidebar-primary hover:underline" href="/admin/works">
              View all →
            </Link>
          </div>
          <div className="divide-y divide-border">
            {works.length ? works.map((work) => (
              <div className="flex items-center gap-3 px-5 py-4" key={work.id}>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted">
                  {work.artworkUrl
                    ? <img alt="" className="h-full w-full object-cover" src={work.artworkUrl} />
                    : <Music2 className="h-5 w-5 text-muted-foreground" aria-hidden="true" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{work.title}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {work.ownerName ?? work.artist}{work.genreName ? ` · ${work.genreName}` : ""}
                  </p>
                </div>
                <div className="hidden text-right sm:block">
                  <StatusBadge status={work.status} />
                  <p className="mt-1.5 text-[11px] text-muted-foreground">{formatDate(work.createdAt)}</p>
                </div>
                <div className="sm:hidden"><StatusBadge status={work.status} /></div>
              </div>
            )) : (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">No works have been added yet.</p>
            )}
          </div>
        </section>

        <div className="grid content-start gap-5 md:grid-cols-2 2xl:grid-cols-1">
          <section className="rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-300" aria-hidden="true" />
                <h2 className="font-semibold">Recent reports</h2>
              </div>
              <Link className="text-xs font-medium text-sidebar-primary hover:underline" href="/admin/reports">
                View all →
              </Link>
            </div>
            <div className="divide-y divide-border">
              {reports.length ? reports.map((report) => (
                <div className="flex items-start justify-between gap-3 px-5 py-4" key={report.id}>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{report.workTitle ?? `Work #${report.workId}`}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {report.reason}{report.workArtist ? ` · ${report.workArtist}` : ""}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{formatDate(report.createdAt)}</p>
                  </div>
                  <StatusBadge status={report.status} />
                </div>
              )) : (
                <p className="px-5 py-8 text-center text-sm text-muted-foreground">No reports have been submitted.</p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary/15 text-sidebar-primary">
                <FolderKanban className="h-4 w-4" aria-hidden="true" />
              </span>
              <h2 className="font-semibold">Quick actions</h2>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <QuickAction href="/admin/users" icon={UsersRound} label="Manage users" />
              <QuickAction href="/admin/works" icon={Music2} label="Manage works" />
              <QuickAction href="/admin/discover" icon={Image} label="Manage Discover" />
              <QuickAction href="/admin/genres" icon={Tags} label="Manage genres" />
              <QuickAction href="/admin/reports" icon={AlertTriangle} label="View reports" />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const tone = status === "OPEN"
    ? "bg-rose-400/15 text-rose-300"
    : status === "PUBLISHED"
      ? "bg-emerald-400/15 text-emerald-300"
      : status === "HIDDEN"
        ? "bg-amber-400/15 text-amber-300"
        : "bg-muted text-muted-foreground"

  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-medium ${tone}`}>{status}</span>
}

function QuickAction({
  href,
  icon: Icon,
  label,
}: {
  href: string
  icon: typeof UsersRound
  label: string
}) {
  return (
    <Link className="flex min-h-12 items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-medium transition-colors hover:border-sidebar-primary/50 hover:bg-sidebar-accent/50" href={href}>
      <Icon className="h-4 w-4 shrink-0 text-sidebar-primary" aria-hidden="true" />
      <span>{label}</span>
    </Link>
  )
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date)
}
