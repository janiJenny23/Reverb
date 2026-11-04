import Image from "next/image"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft, Music2 } from "lucide-react"
import { getWorkDetail } from "@/modules/discovery"
import { getMyFavoriteIds } from "@/app/actions/favorites"
import { getMyProfile } from "@/app/actions/profile"
import { MusicianNavigation } from "@/components/musician-navigation"
import { getSessionUser } from "@/lib/session"
import { FavoriteButton } from "./favorite-button"
import { AudioPlayer } from "./audio-player"
import { ReportForm } from "./report-form"

export default async function PublicWorkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const workId = Number(id)
  if (!Number.isInteger(workId)) notFound()
  const [item, user] = await Promise.all([getWorkDetail(workId), getSessionUser()])
  if (!item) redirect("/discover")
  if (!user) redirect("/sign-in")

  const isMusician = user.role === "MUSICIAN" || user.role === "SUPER_ADMIN"
  const isOwnWork = item.musicianId === user.id
  const favoriteIdsPromise: Promise<number[]> = getMyFavoriteIds().catch(() => [])
  const [favoriteIds, musicianProfile] = await Promise.all([
    favoriteIdsPromise,
    isMusician ? getMyProfile() : Promise.resolve(null),
  ])
  const profileImage = musicianProfile?.profile?.imageUrl ?? musicianProfile?.account.image ?? null
  const roleLabel = user.role === "SUPER_ADMIN" ? "Super admin" : "Musician"

  return (
    <main className={`min-h-svh text-[#30251e] ${isMusician ? "flex bg-[#f8f4ed]" : "bg-background text-foreground"}`}>
      {isMusician ? (
        <MusicianNavigation activeHref="/discover" name={user.name} roleLabel={roleLabel} imageUrl={profileImage} />
      ) : (
        <header className="border-b border-border bg-background">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4 sm:px-8 sm:py-5">
            <Link href="/discover" className="font-serif text-2xl font-semibold tracking-tight">Reverb</Link>
            <Link href="/discover" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Back to discover</Link>
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

          <section className={`grid items-center gap-7 md:grid-cols-[minmax(240px,0.8fr)_minmax(0,1.2fr)] lg:gap-10 ${isMusician ? "mt-6" : ""}`}>
            <div className={`relative mx-auto aspect-square w-full max-w-[460px] overflow-hidden ${
              isMusician
                ? "rounded-[26px] border border-[#e4d6c8] bg-[#f1e5d8] shadow-[0_18px_45px_rgba(65,42,27,0.1)]"
                : "rounded-xl bg-muted"
            }`}>
              {item.artworkUrl ? (
                <Image src={item.artworkUrl} alt={`${item.title} artwork`} fill unoptimized loading="eager" sizes="(max-width: 768px) 100vw, 460px" className="object-cover" />
              ) : (
                <div className={`flex h-full flex-col items-center justify-center gap-3 ${isMusician ? "bg-gradient-to-br from-[#f6eadc] via-[#eed9c6] to-[#e8c7af] text-[#9c5b3f]" : "text-sm text-muted-foreground"}`}>
                  <Music2 aria-hidden="true" className={isMusician ? "h-12 w-12 stroke-[1.2]" : "h-8 w-8"} />
                  <span>{isMusician ? "Reverb archive" : "No artwork"}</span>
                </div>
              )}
            </div>

            <section className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <span className={`inline-flex rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                  isMusician ? "border border-[#d7a58d] bg-[#f5e3d8] text-[#923f29]" : "font-mono tracking-[0.2em] text-muted-foreground"
                }`}>
                  Published work
                </span>
                {item.genreName ? <span className={isMusician ? "text-sm text-[#85766b]" : "text-sm text-muted-foreground"}>{item.genreName}</span> : null}
              </div>
              <h1 className={`mt-4 break-words font-serif font-semibold leading-[1.08] tracking-tight ${
                isMusician ? "text-4xl text-[#2c211c] sm:text-5xl lg:text-[3.5rem]" : "text-4xl sm:text-5xl"
              }`}>{item.title}</h1>
              <Link
                href={isOwnWork ? "/profile" : `/discover/musicians/${item.musicianId}`}
                className={`mt-3 inline-block text-lg transition-colors ${
                  isMusician ? "text-[#78685b] hover:text-[#923f29] sm:text-xl" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.artist}{isOwnWork ? " · Your profile" : ""}
              </Link>
              {item.projectTitle ? (
                <p className={`mt-2 text-sm ${isMusician ? "text-[#85766b]" : "text-muted-foreground"}`}>
                  From <span className={isMusician ? "font-medium text-[#594638]" : ""}>{item.projectTitle}</span>
                </p>
              ) : null}

              <div className={`mt-7 rounded-[20px] p-4 sm:p-5 ${
                isMusician ? "border border-[#e4d6c8] bg-[#fffcf7] shadow-[0_8px_24px_rgba(72,48,29,0.04)]" : "border border-border bg-card"
              }`}>
                {isMusician ? <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9b6a51]">Listen to this work</p> : null}
                <AudioPlayer workId={item.id} audioUrl={item.audioUrl} musicianStyle={isMusician} />
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2.5">
                <FavoriteButton workId={item.id} initialFavorited={favoriteIds.includes(item.id)} musicianStyle={isMusician} />
                <Link
                  href={isOwnWork ? "/profile" : `/discover/musicians/${item.musicianId}`}
                  className={`inline-flex min-h-10 items-center justify-center rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    isMusician
                      ? "border border-[#d9bda5] bg-[#fffdf8] text-[#80553b] hover:border-[#bd825e] hover:bg-[#f8eee3]"
                      : "rounded-md border border-border hover:bg-muted"
                  }`}
                >
                  {isOwnWork ? "View your profile" : "View musician"}
                </Link>
                {!isOwnWork ? <ReportForm workId={item.id} musicianStyle={isMusician} /> : null}
              </div>
            </section>
          </section>

          <section className={`mt-10 rounded-[24px] p-5 sm:p-7 ${
            isMusician ? "border border-[#e4d6c8] bg-[#fffcf7] shadow-[0_10px_35px_rgba(72,48,29,0.045)]" : "border border-border bg-card"
          }`}>
            <div className={`mb-5 border-b pb-4 ${isMusician ? "border-[#eee2d7]" : "border-border"}`}>
              {isMusician ? <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#ad5034]">Archive notes</p> : null}
              <h2 className={`font-serif text-2xl font-semibold tracking-tight ${isMusician ? "mt-1 sm:text-3xl" : ""}`}>About this work</h2>
            </div>
            <div className="grid gap-x-8 sm:grid-cols-2">
              <Meta label="Genre" value={item.genreName} musicianStyle={isMusician} />
              <Meta label="Project" value={item.projectTitle} musicianStyle={isMusician} />
              <Meta label="Created" value={item.createdDate} musicianStyle={isMusician} />
              <Meta label="Released" value={item.releasedDate} musicianStyle={isMusician} />
              <Meta label="Version" value={item.version} musicianStyle={isMusician} />
              <Meta label="Composer" value={item.composer} musicianStyle={isMusician} />
              <Meta label="Lyricist" value={item.lyricist} musicianStyle={isMusician} />
              <Meta label="Producer" value={item.producer} musicianStyle={isMusician} />
              <Meta label="Recording" value={item.recording} musicianStyle={isMusician} />
              <Meta label="Format" value={item.format} musicianStyle={isMusician} />
            </div>
          </section>

          <section className={`mt-6 rounded-[24px] p-5 sm:p-7 ${
            isMusician ? "border border-[#e4d6c8] bg-[#f3e8dc]" : "border border-border bg-muted/30"
          }`}>
            <h2 className={`font-serif text-2xl font-semibold tracking-tight ${isMusician ? "text-[#30251e]" : ""}`}>Lyrics</h2>
            {item.lyrics ? (
              <p className={`mt-4 whitespace-pre-wrap break-words text-sm leading-7 ${
                isMusician ? "text-[#594638] sm:text-base sm:leading-8" : "text-foreground"
              }`}>{item.lyrics}</p>
            ) : (
              <p className={`mt-3 text-sm ${isMusician ? "text-[#78685b]" : "text-muted-foreground"}`}>No lyrics have been added to this work.</p>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}

function Meta({ label, value, musicianStyle }: { label: string; value: string | null; musicianStyle: boolean }) {
  return (
    <div className={`py-3 ${musicianStyle ? "border-b border-[#eee2d7] sm:[&:nth-last-child(-n+2)]:border-b-0" : ""}`}>
      <p className={`text-xs uppercase tracking-wider ${musicianStyle ? "text-[#9b6a51]" : "text-muted-foreground"}`}>{label}</p>
      <p className={`mt-1 break-words text-sm ${musicianStyle ? "text-[#3b2d26]" : ""}`}>{value || "—"}</p>
    </div>
  )
}
