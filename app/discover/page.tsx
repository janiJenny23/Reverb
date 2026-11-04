import Image from "next/image"
import Link from "next/link"
import { Music2 } from "lucide-react"
import { getFeaturedWorks, searchWorks } from "@/modules/discovery"
import { getDiscoverHeroImage } from "@/modules/discovery-content"
import { getGenres } from "@/modules/genres"
import { getMyProfile } from "@/app/actions/profile"
import { getSessionUser } from "@/lib/session"
import { MusicianNavigation } from "@/components/musician-navigation"
import { SignOutButton } from "@/components/sign-out-button"
import { SearchForm } from "./search-form"

export default async function DiscoverPage({ searchParams }: { searchParams: Promise<{ q?: string; genre?: string }> }) {
  const user = await getSessionUser()
  const params = await searchParams
  const isSearching = Boolean(params.q || params.genre)
  const isMusician = user?.role === "MUSICIAN" || user?.role === "SUPER_ADMIN"
  const [genres, works, featuredWorks, musicianProfile, discoverHeroImage] = await Promise.all([
    getGenres(),
    isSearching ? searchWorks(params.q ?? "", Number(params.genre) || undefined) : getFeaturedWorks(12),
    isSearching ? getFeaturedWorks(1) : Promise.resolve([]),
    isMusician ? getMyProfile() : Promise.resolve(null),
    getDiscoverHeroImage(),
  ])
  const heroArtwork = discoverHeroImage ?? (isSearching ? featuredWorks : works).find((work) => work.artworkUrl)?.artworkUrl
  const profileImage = musicianProfile?.profile?.imageUrl ?? musicianProfile?.account.image ?? null
  const roleLabel = user?.role === "SUPER_ADMIN" ? "Super admin" : "Musician"

  return (
    <main className={`min-h-svh bg-[#f8f4ed] text-[#30251e] ${isMusician ? "flex" : ""}`}>
      {isMusician ? (
        <MusicianNavigation activeHref="/discover" name={user.name} roleLabel={roleLabel} imageUrl={profileImage} />
      ) : (
        <header className="border-b border-[#e6d9c9] bg-[#fbf8f2]">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-6">
            <Link href="/" className="font-serif text-2xl font-semibold tracking-tight">Reverb</Link>
            <nav aria-label="Main navigation" className="flex items-center gap-2 text-xs text-[#78685b] sm:gap-4 sm:text-sm">
              <Link href="/discover" aria-current="page" className="rounded-full bg-[#f0dfce] px-3 py-2 font-semibold text-[#963f22]">Discover</Link>
              {user ? (
                <>
                  <Link href="/discover/library" className="rounded-full px-2 py-2 transition-colors hover:bg-[#f0dfce] hover:text-[#963f22] sm:px-3">My library</Link>
                  <SignOutButton />
                </>
              ) : (
                <>
                  <Link href="/sign-in" className="rounded-full px-2 py-2 transition-colors hover:bg-[#f0dfce] sm:px-3">Sign in</Link>
                  <Link href="/sign-up" className="rounded-full bg-[#a24e35] px-3 py-2 font-semibold text-white transition-colors hover:bg-[#833d2a]">Get started</Link>
                </>
              )}
            </nav>
          </div>
        </header>
      )}

      <div className={`min-w-0 flex-1 ${isMusician ? "ml-16 md:ml-56 lg:ml-60" : ""}`}>
        <div className="mx-auto w-full max-w-[1500px] px-5 py-6 sm:px-8 sm:py-8 xl:px-11">
          <section className="relative isolate overflow-hidden rounded-[28px] border border-[#ead8c5] bg-gradient-to-br from-[#fbf3e8] via-[#f2dfca] to-[#e9c5a6] px-5 pb-6 pt-7 shadow-[0_10px_35px_rgba(72,48,29,0.05)] sm:px-8 sm:pb-8 sm:pt-9">
            {heroArtwork ? (
              <>
                <Image src={heroArtwork} alt="" fill unoptimized loading="eager" sizes="(max-width: 1024px) 100vw, 1200px" className="absolute inset-0 -z-20 object-cover object-[65%_center] opacity-30" />
                <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-r from-[#fbf5eb] via-[#fbf5eb]/90 to-[#fbf5eb]/25" />
              </>
            ) : null}
            <div className="relative">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#a64c2a]">Digital archive</p>
              <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight text-[#30251e] sm:text-4xl lg:text-5xl">Discover finished works</h1>
              <p className="mt-3 text-sm leading-6 text-[#6f6257] sm:text-base">Browse, search, and listen to the archive.</p>
              <SearchForm genres={genres} />
            </div>
          </section>

          <section className="mt-8 sm:mt-10">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="font-serif text-2xl font-semibold tracking-tight sm:text-3xl">{isSearching ? "Search results" : "Recently added"}</h2>
              <span className="shrink-0 rounded-full bg-[#f0dfce] px-3 py-1.5 text-xs font-medium text-[#80553b]">
                {works.length} {works.length === 1 ? "work" : "works"}
              </span>
            </div>
            {works.length === 0 ? (
              <div className="rounded-[22px] border border-dashed border-[#ddc8b2] bg-[#fffdf8] p-8 text-center text-sm text-[#78685b]">
                No published works match your search.
              </div>
            ) : (
              <div className={`grid grid-cols-2 ${
                isMusician
                  ? "gap-2.5 sm:gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
                  : "gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6"
              }`}>
                {works.map((work, index) => (
                  <Link
                    key={work.id}
                    href={user ? `/discover/works/${work.id}` : "/sign-in"}
                    aria-label={user ? `Open ${work.title} by ${work.artist}` : `Sign in to listen to ${work.title} by ${work.artist}`}
                    className={`group overflow-hidden border border-[#e9dac8] bg-[#fffdf8] shadow-[0_8px_24px_rgba(72,48,29,0.035)] transition-all hover:-translate-y-0.5 hover:border-[#c88d68] hover:shadow-[0_12px_30px_rgba(72,48,29,0.08)] ${
                      isMusician ? "rounded-[16px]" : "rounded-[20px]"
                    }`}
                  >
                    <div className="aspect-[1.15/1] overflow-hidden bg-[#ead9c7] sm:aspect-square">
                      {work.artworkUrl ? (
                        <Image src={work.artworkUrl} alt="" width={480} height={480} unoptimized loading={index === 0 ? "eager" : "lazy"} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[#a87352]">
                          <Music2 aria-hidden="true" className="h-8 w-8" strokeWidth={1.5} />
                        </div>
                      )}
                    </div>
                    <div className={isMusician ? "p-2.5 sm:p-3" : "p-3 sm:p-3.5"}>
                      <p className={`truncate font-serif font-semibold group-hover:text-[#963f22] ${
                        isMusician ? "text-xs sm:text-sm" : "text-sm sm:text-base"
                      }`}>{work.title}</p>
                      <p className={`truncate text-[#78685b] ${isMusician ? "text-[10px] sm:text-xs" : "text-xs sm:text-sm"}`}>{work.artist}</p>
                      <div className={`${isMusician ? "mt-1.5" : "mt-2"} flex items-center justify-between gap-2`}>
                        <span className={`max-w-[75%] truncate rounded-full bg-[#f3e4d3] font-medium text-[#8a4b31] ${
                          isMusician ? "px-2 py-0.5 text-[9px] sm:text-[10px]" : "px-2.5 py-1 text-[10px] sm:text-xs"
                        }`}>{work.genreName ?? "Independent"}</span>
                        <span className={`shrink-0 text-[#a24e35] ${isMusician ? "text-[9px] sm:text-[10px]" : "text-[10px] sm:text-xs"}`}>{user ? "Listen" : "Sign in"}</span>
                      </div>
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
