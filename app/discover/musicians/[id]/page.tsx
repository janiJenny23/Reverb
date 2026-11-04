import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Music2, UserRound } from "lucide-react"
import { getMusicianPublicProfile } from "@/modules/discovery"
import { getMyProfile } from "@/app/actions/profile"
import { MusicianNavigation } from "@/components/musician-navigation"
import { getSessionUser } from "@/lib/session"

export default async function MusicianPublicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [result, user] = await Promise.all([getMusicianPublicProfile(id), getSessionUser()])
  if (!result) notFound()

  const isMusician = user?.role === "MUSICIAN" || user?.role === "SUPER_ADMIN"
  const musicianProfile = isMusician ? await getMyProfile() : null
  const profileImage = musicianProfile?.profile?.imageUrl ?? musicianProfile?.account.image ?? null
  const roleLabel = user?.role === "SUPER_ADMIN" ? "Super admin" : "Musician"
  const displayName = result.profile.displayName ?? result.profile.accountName ?? "Musician"

  return (
    <main className={`min-h-svh text-[#30251e] ${isMusician ? "flex bg-[#f8f4ed]" : "bg-background text-foreground"}`}>
      {isMusician && user ? (
        <MusicianNavigation activeHref="/discover" name={user.name} roleLabel={roleLabel} imageUrl={profileImage} />
      ) : (
        <header className="border-b border-[#e6d9c9] bg-[#fbf8f2]">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8 sm:py-5">
            <Link href="/discover" className="font-serif text-2xl font-semibold tracking-tight">Reverb</Link>
            <Link href="/discover" className="text-sm text-[#78685b] transition-colors hover:text-[#923f29]">Discover</Link>
          </div>
        </header>
      )}

      <div className={`min-w-0 flex-1 ${isMusician ? "ml-16 md:ml-56 lg:ml-60" : ""}`}>
        <div className="mx-auto w-full max-w-[1200px] px-5 py-7 sm:px-8 sm:py-9 xl:px-11">
          {isMusician ? (
            <Link href="/discover" className="inline-flex items-center gap-2 text-sm font-medium text-[#78685b] transition-colors hover:text-[#923f29]">
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              Back to Discover
            </Link>
          ) : null}

          <section className={`relative isolate overflow-hidden rounded-[26px] border p-6 sm:p-8 ${
            isMusician
              ? "mt-6 border-[#ead8c5] bg-gradient-to-br from-[#fbf5eb] via-[#f5e7d8] to-[#eddbc8] shadow-[0_10px_35px_rgba(72,48,29,0.045)]"
              : "border-border bg-card"
          }`}>
            {isMusician ? <div aria-hidden="true" className="absolute -right-12 -top-16 h-56 w-56 rounded-full border border-[#d9bda5]/50" /> : null}
            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-7">
              <div className={`relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full ${
                isMusician ? "border-4 border-[#fffaf3] bg-[#ead4c0] text-[#995033] shadow-md" : "bg-muted text-muted-foreground"
              }`}>
                {result.profile.imageUrl ? (
                  <Image src={result.profile.imageUrl} alt="" fill unoptimized sizes="96px" className="object-cover" />
                ) : (
                  <UserRound aria-hidden="true" className="h-10 w-10 stroke-[1.4]" />
                )}
              </div>
              <div className="min-w-0">
                <p className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${
                  isMusician ? "text-[#a24e35]" : "text-muted-foreground"
                }`}>Musician profile</p>
                <h1 className={`mt-2 break-words font-serif text-3xl font-semibold tracking-tight sm:text-4xl ${
                  isMusician ? "text-[#30251e]" : ""
                }`}>{displayName}</h1>
                <p className={`mt-1 text-sm sm:text-base ${
                  isMusician ? "text-[#80553b]" : "text-muted-foreground"
                }`}>{result.profile.primaryGenre || "Independent musician"}</p>
                {result.profile.bio ? (
                  <p className={`mt-4 max-w-2xl whitespace-pre-wrap text-sm leading-6 ${
                    isMusician ? "text-[#6f6257]" : "text-muted-foreground"
                  }`}>{result.profile.bio}</p>
                ) : null}
              </div>
            </div>
          </section>

          <section className="mt-9 sm:mt-11">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                {isMusician ? <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#a24e35]">From the archive</p> : null}
                <h2 className={`font-serif text-2xl font-semibold tracking-tight sm:text-3xl ${isMusician ? "mt-1 text-[#30251e]" : ""}`}>
                  Published works
                </h2>
              </div>
              <span className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                isMusician ? "bg-[#f0dfce] text-[#80553b]" : "bg-muted text-muted-foreground"
              }`}>
                {result.works.length} {result.works.length === 1 ? "work" : "works"}
              </span>
            </div>

            {result.works.length === 0 ? (
              <div className={`rounded-[22px] border border-dashed p-8 text-center ${
                isMusician ? "border-[#ddc8b2] bg-[#fffdf8] text-[#78685b]" : "border-border text-muted-foreground"
              }`}>
                <Music2 aria-hidden="true" className={`mx-auto h-8 w-8 ${isMusician ? "text-[#a87352]" : ""}`} />
                <p className="mt-3 font-serif text-lg font-semibold">No published works yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
                {result.works.map((work) => (
                  <Link
                    key={work.id}
                    href={`/discover/works/${work.id}`}
                    className={`group overflow-hidden transition-all hover:-translate-y-0.5 ${
                      isMusician
                        ? "rounded-[18px] border border-[#e9dac8] bg-[#fffdf8] shadow-[0_8px_24px_rgba(72,48,29,0.035)] hover:border-[#c88d68] hover:shadow-[0_12px_30px_rgba(72,48,29,0.08)]"
                        : "rounded-xl border border-border bg-card hover:border-foreground/30"
                    }`}
                  >
                    <div className={`relative aspect-square overflow-hidden ${isMusician ? "bg-[#ead9c7]" : "bg-muted"}`}>
                      {work.artworkUrl ? (
                        <Image src={work.artworkUrl} alt="" fill unoptimized sizes="(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 25vw" className="object-cover transition-transform duration-300 group-hover:scale-105" />
                      ) : (
                        <div className={`flex h-full items-center justify-center ${isMusician ? "text-[#a87352]" : "text-muted-foreground"}`}>
                          <Music2 aria-hidden="true" className="h-8 w-8" strokeWidth={1.5} />
                        </div>
                      )}
                    </div>
                    <div className={isMusician ? "p-3 sm:p-3.5" : "p-4"}>
                      <h3 className={`truncate font-serif font-semibold transition-colors ${
                        isMusician ? "text-base text-[#30251e] group-hover:text-[#963f22] sm:text-lg" : "text-xl"
                      }`}>{work.title}</h3>
                      <p className={`truncate text-sm ${isMusician ? "text-[#78685b]" : "text-muted-foreground"}`}>{work.artist}</p>
                      {isMusician && work.genreName ? (
                        <span className="mt-2 inline-block max-w-full truncate rounded-full bg-[#f3e4d3] px-2.5 py-1 text-[10px] font-medium text-[#8a4b31]">
                          {work.genreName}
                        </span>
                      ) : null}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}
