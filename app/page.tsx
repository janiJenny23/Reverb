import { redirect } from "next/navigation"
import Link from "next/link"
import { getSessionUser, homePathForRole } from "@/lib/session"
import { getFeaturedWorks } from "@/modules/discovery"
import { Mic2, Headphones, Library, ArrowRight } from "lucide-react"

export default async function HomePage() {
  const user = await getSessionUser()
  if (user) redirect(homePathForRole(user.role))

  const featured = await getFeaturedWorks(6)

  return (
    <main className="min-h-svh bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="font-serif text-2xl font-semibold tracking-tight">Reverb</span>
        <nav className="flex items-center gap-2">
          <Link
            href="/sign-in"
            className="inline-flex h-8 items-center justify-center rounded-lg px-2.5 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
          >
            Get started
          </Link>
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-16 pt-12 md:pt-20">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent">
          A digital music archive
        </p>
        <h1 className="mt-4 max-w-3xl text-balance font-serif text-5xl font-semibold leading-[1.05] tracking-tight md:text-7xl">
          Where musicians catalog their work and listeners discover it.
        </h1>
        <p className="mt-6 max-w-xl text-pretty text-lg text-muted-foreground">
          Reverb is a living archive. Publish tracks with full credits and metadata, organize them into
          projects, and let an audience explore, stream, and collect.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/sign-up"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
          >
            Start your archive
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/discover"
            className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-2.5 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground"
          >
            Browse the catalog
          </Link>
        </div>
      </section>

      <section className="border-y border-border bg-card/50">
        <div className="mx-auto grid max-w-6xl gap-px sm:grid-cols-3">
          <Feature
            icon={<Mic2 className="h-5 w-5" />}
            title="For musicians"
            body="Upload audio and artwork, capture composer, lyricist, and producer credits, and group work into projects."
          />
          <Feature
            icon={<Headphones className="h-5 w-5" />}
            title="For listeners"
            body="Discover new music by genre, stream instantly, follow artists, and build a personal library of favorites."
          />
          <Feature
            icon={<Library className="h-5 w-5" />}
            title="A real archive"
            body="Every release is documented with rich metadata, so the catalog stays searchable and complete over time."
          />
        </div>
      </section>

      {featured.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 py-16">
          <div className="mb-8 flex items-end justify-between">
            <h2 className="font-serif text-3xl font-semibold tracking-tight">Recently added</h2>
            <Link
              href="/discover"
              className="font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
            >
              View all
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
            {featured.map((w) => (
              <Link key={w.id} href="/discover" className="group">
                <div className="aspect-square overflow-hidden rounded-md border border-border bg-muted">
                  {w.artworkUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={w.artworkUrl || "/placeholder.svg"}
                      alt={`Artwork for ${w.title}`}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      <Library className="h-6 w-6" />
                    </div>
                  )}
                </div>
                <p className="mt-2 truncate text-sm font-medium">{w.title}</p>
                <p className="truncate font-mono text-xs text-muted-foreground">{w.artist}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-8 text-sm text-muted-foreground sm:flex-row">
          <span className="font-serif text-lg font-semibold text-foreground">Reverb</span>
          <span className="font-mono text-xs uppercase tracking-widest">Digital Music Archive</span>
        </div>
      </footer>
    </main>
  )
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="bg-background p-8">
      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent/15 text-accent-foreground">
        {icon}
      </div>
      <h3 className="mt-4 font-serif text-xl font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  )
}
