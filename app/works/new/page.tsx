import { Disc3 } from "lucide-react"
import { getGenres } from "@/modules/genres"
import { getMyProjectsSimple } from "@/app/actions/projects"
import { getMyProfile } from "@/app/actions/profile"
import { MusicianNavigation } from "@/components/musician-navigation"
import { requireRole } from "@/lib/session"
import { WorkForm } from "./work-form"

export default async function NewWorkPage() {
  const user = await requireRole(["MUSICIAN", "SUPER_ADMIN"])
  const [genres, projects, musicianProfile] = await Promise.all([getGenres(), getMyProjectsSimple(), getMyProfile()])
  const roleLabel = user.role === "SUPER_ADMIN" ? "Super admin" : "Musician"
  const profileImage = musicianProfile.profile?.imageUrl ?? musicianProfile.account.image ?? null

  return (
    <main className="flex min-h-svh bg-[#f8f4ed] text-[#30251e]">
      <MusicianNavigation activeHref="/works/new" name={user.name} roleLabel={roleLabel} imageUrl={profileImage} />
      <div className="ml-16 min-w-0 flex-1 md:ml-56 lg:ml-60">
        <div className="mx-auto w-full max-w-[1500px] px-5 py-6 sm:px-8 sm:py-8 xl:px-11">
          <div className="grid items-start gap-5 xl:grid-cols-[0.7fr_1.6fr]">
            <aside className="flex min-h-[240px] flex-col justify-between rounded-[26px] border border-[#ead8c5] bg-[#f3e4d3] p-6 shadow-[0_10px_35px_rgba(72,48,29,0.04)] sm:min-h-[260px] sm:p-8 xl:sticky xl:top-8">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-[#ead8c5] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#78442f]">
                  <Disc3 aria-hidden="true" className="h-3.5 w-3.5" />
                  Add to your archive
                </div>
                <h1 className="mt-7 max-w-sm font-serif text-4xl font-semibold leading-[1.08] tracking-tight text-[#30251e] sm:text-5xl">
                  Create a new work
                </h1>
                <p className="mt-5 max-w-sm text-sm leading-6 text-[#604939] sm:text-base sm:leading-7">
                  Add your finished audio and the details that make its story part of the archive. Project works inherit their cover from the project.
                </p>
              </div>
              <div className="mt-8 border-t border-[#d9c4ad] pt-4">
                <p className="font-serif text-lg font-semibold text-[#442d20]">Capture your music.<br />Keep its story.</p>
              </div>
            </aside>
            <section className="min-w-0 rounded-[26px] border border-[#e9dac8] bg-[#fffdf8] p-5 shadow-[0_10px_35px_rgba(72,48,29,0.05)] sm:p-7 xl:p-8">
              <div className="mb-6 border-b border-[#eee3d7] pb-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a24e35]">Finished work</p>
                <h2 className="mt-2 font-serif text-2xl font-semibold tracking-tight sm:text-3xl">Work details</h2>
                <p className="mt-1.5 text-sm leading-5 text-[#78685b]">Required fields are marked with an asterisk.</p>
              </div>
              <WorkForm genres={genres} projects={projects} />
            </section>
          </div>
        </div>
      </div>
    </main>
  )
}
