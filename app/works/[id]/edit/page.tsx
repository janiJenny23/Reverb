import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft, Disc3 } from "lucide-react"
import { getMyProfile } from "@/app/actions/profile"
import { getGenres } from "@/modules/genres"
import { getMyProjectsSimple } from "@/app/actions/projects"
import { getMyWork, updateWork } from "@/app/actions/works"
import { MusicianNavigation } from "@/components/musician-navigation"
import { requireRole } from "@/lib/session"
import { ProjectSelector } from "../../project-selector"

export default async function EditWorkPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["MUSICIAN", "SUPER_ADMIN"])
  const { id } = await params
  const workId = Number(id)
  if (!Number.isInteger(workId)) notFound()
  const result = await getMyWork(workId)
  if (!result) notFound()
  const item = result.work
  const [genres, projects, musicianProfile] = await Promise.all([getGenres(), getMyProjectsSimple(), getMyProfile()])
  const roleLabel = user.role === "SUPER_ADMIN" ? "Super admin" : "Musician"
  const profileImage = musicianProfile.profile?.imageUrl ?? musicianProfile.account.image ?? null

  return (
    <main className="flex min-h-svh bg-[#f8f4ed] text-[#30251e]">
      <MusicianNavigation activeHref="/works" name={user.name} roleLabel={roleLabel} imageUrl={profileImage} />
      <div className="ml-16 min-w-0 flex-1 md:ml-56 lg:ml-60">
        <div className="mx-auto w-full max-w-[1200px] px-5 py-7 sm:px-8 sm:py-9 xl:px-11">
          <Link
            href={`/works/${workId}`}
            className="inline-flex items-center gap-2 text-sm font-medium text-[#78685b] transition-colors hover:text-[#923f29]"
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            Cancel and return to work
          </Link>

          <div className="mt-6 grid items-start gap-5 xl:grid-cols-[0.7fr_1.6fr]">
            <aside className="rounded-[26px] border border-[#ead8c5] bg-[#f3e4d3] p-6 shadow-[0_10px_35px_rgba(72,48,29,0.04)] sm:p-8 xl:sticky xl:top-8">
              <span className="inline-flex items-center gap-2 rounded-full bg-[#ead8c5] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#78442f]">
                <Disc3 aria-hidden="true" className="h-3.5 w-3.5" />
                Archive details
              </span>
              <h1 className="mt-6 break-words font-serif text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
                Edit this work
              </h1>
              <p className="mt-3 break-words font-serif text-xl text-[#80553b]">{item.title}</p>
              <p className="mt-4 text-sm leading-6 text-[#604939]">
                Keep the credits and release information for your work accurate and complete.
              </p>
              <div className="mt-7 border-t border-[#d9c4ad] pt-4">
                <p className="text-xs leading-5 text-[#78685b]">
                  The existing audio and artwork will be kept while you update these details.
                </p>
              </div>
            </aside>

            <section className="min-w-0 rounded-[26px] border border-[#e9dac8] bg-[#fffdf8] p-5 shadow-[0_10px_35px_rgba(72,48,29,0.05)] sm:p-7 xl:p-8">
              <div className="mb-6 border-b border-[#eee3d7] pb-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a24e35]">Work archive</p>
                <h2 className="mt-2 font-serif text-2xl font-semibold tracking-tight sm:text-3xl">Edit work details</h2>
                <p className="mt-1.5 text-sm leading-5 text-[#78685b]">Required fields are marked with an asterisk.</p>
              </div>
              <form action={async (formData) => {
                "use server"
                await updateWork(workId, {
                  title: String(formData.get("title") ?? ""),
                  artist: String(formData.get("artist") ?? ""),
                  genreId: Number(formData.get("genreId") ?? "") || null,
                  projectId: Number(formData.get("projectId") ?? "") || null,
                  createdDate: String(formData.get("createdDate") ?? "") || null,
                  releasedDate: String(formData.get("releasedDate") ?? "") || null,
                  duration: item.duration,
                  composer: String(formData.get("composer") ?? "") || null,
                  lyricist: String(formData.get("lyricist") ?? "") || null,
                  producer: String(formData.get("producer") ?? "") || null,
                  recording: String(formData.get("recording") ?? "") || null,
                  version: String(formData.get("version") ?? "") || null,
                  audioUrl: item.audioUrl,
                  artworkUrl: item.artworkUrl,
                  lyrics: String(formData.get("lyrics") ?? "") || null,
                  fileSize: item.fileSize,
                  format: item.format,
                })
                redirect(`/works/${workId}`)
              }} className="space-y-5">
                <div className="grid gap-5 md:grid-cols-2">
                  <Field label="Title" name="title" defaultValue={item.title} required />
                  <Field label="Artist" name="artist" defaultValue={item.artist} required />
                </div>
                <div className="grid gap-5 md:grid-cols-2">
                  <SelectField label="Genre" name="genreId" value={item.genreId} options={genres.map((genre) => ({ value: genre.id, label: genre.name }))} required />
                  <ProjectSelector
                    projects={projects}
                    defaultValue={item.projectId ? String(item.projectId) : ""}
                    standaloneArtworkUrl={item.artworkUrl}
                  />
                </div>
                <div className="grid gap-5 md:grid-cols-2">
                  <Field label="Created date" name="createdDate" type="date" defaultValue={item.createdDate ?? ""} required />
                  <Field label="Released date" name="releasedDate" type="date" defaultValue={item.releasedDate ?? ""} required />
                </div>
                <div className="grid gap-5 md:grid-cols-3">
                  <Field label="Composer" name="composer" defaultValue={item.composer ?? ""} />
                  <Field label="Lyricist" name="lyricist" defaultValue={item.lyricist ?? ""} />
                  <Field label="Producer" name="producer" defaultValue={item.producer ?? ""} />
                </div>
                <div className="grid gap-5 md:grid-cols-3">
                  <Field label="Recording" name="recording" defaultValue={item.recording ?? ""} />
                  <Field label="Version" name="version" defaultValue={item.version ?? ""} />
                </div>
                <div className="rounded-2xl border border-[#e4d6c8] bg-[#f7f2ea] p-4 text-sm text-[#78685b]">
                  Current audio:{" "}
                  <a href={item.audioUrl} target="_blank" rel="noreferrer" className="font-medium text-[#923f29] underline underline-offset-2">
                    {item.format ?? "audio file"}
                  </a>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#594638]" htmlFor="lyrics">Lyrics</label>
                  <textarea
                    id="lyrics"
                    name="lyrics"
                    rows={6}
                    defaultValue={item.lyrics ?? ""}
                    className="w-full rounded-xl border border-[#e4d6c8] bg-[#fffcf7] px-3.5 py-3 text-sm leading-6 text-[#30251e] outline-none transition focus:border-[#a24e35] focus:ring-2 focus:ring-[#a24e35]/15"
                  />
                </div>
                <button
                  type="submit"
                  className="min-h-11 w-full rounded-full bg-[#a24e35] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#833d2a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a24e35] focus-visible:ring-offset-2"
                >
                  Save changes
                </button>
              </form>
            </section>
          </div>
        </div>
      </div>
    </main>
  )
}

function Field({ label, name, defaultValue, type = "text", required }: { label: string; name: string; defaultValue?: string | number; type?: string; required?: boolean }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-[#594638]" htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        className="min-h-11 w-full rounded-xl border border-[#e4d6c8] bg-[#fffcf7] px-3.5 py-2 text-sm text-[#30251e] outline-none transition focus:border-[#a24e35] focus:ring-2 focus:ring-[#a24e35]/15"
      />
    </div>
  )
}

function SelectField({ label, name, value, options, emptyLabel = "Select genre", required }: { label: string; name: string; value: number | null; options: { value: number; label: string }[]; emptyLabel?: string; required?: boolean }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-[#594638]" htmlFor={name}>{label}</label>
      <select
        id={name}
        name={name}
        required={required}
        defaultValue={value ?? ""}
        className="min-h-11 w-full rounded-xl border border-[#e4d6c8] bg-[#fffcf7] px-3.5 py-2 text-sm text-[#30251e] outline-none transition focus:border-[#a24e35] focus:ring-2 focus:ring-[#a24e35]/15"
      >
        <option value="">{emptyLabel}</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div>
  )
}
