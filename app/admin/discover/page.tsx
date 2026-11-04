import Image from "next/image"
import { getAdminDiscoverHeroImage } from "@/app/actions/admin"
import { requireRole } from "@/lib/session"
import { DiscoverHeroForm } from "./hero-form"

export const dynamic = "force-dynamic"

export default async function AdminDiscoverPage() {
  await requireRole(["SUPER_ADMIN"])
  const imageUrl = await getAdminDiscoverHeroImage()

  return (
    <section className="mx-auto max-w-4xl rounded-2xl border border-border bg-card p-5 sm:p-7">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Audience experience</p>
      <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight">Discover background</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Choose the photo used behind the Discover hero. The existing archive artwork remains as the web fallback; mobile uses its bundled default photo.
      </p>
      {imageUrl ? (
        <div className="relative mt-6 aspect-[2.2/1] overflow-hidden rounded-xl border border-border bg-muted">
          <Image src={imageUrl} alt="Current Discover background" fill unoptimized sizes="(max-width: 896px) 100vw, 896px" className="object-cover" />
          <span className="absolute left-3 top-3 rounded-full bg-background/90 px-3 py-1.5 text-xs font-medium">Current photo</span>
        </div>
      ) : (
        <div className="mt-6 rounded-xl border border-dashed border-border bg-muted/30 px-5 py-8 text-sm text-muted-foreground">
          No admin photo is set. Discover will use its default background.
        </div>
      )}
      <div className="mt-6">
        <DiscoverHeroForm initialImageUrl={imageUrl} />
      </div>
    </section>
  )
}
