"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { setDiscoverHeroImage } from "@/app/actions/admin"
import { FileUploader } from "@/components/file-uploader"

export function DiscoverHeroForm({ initialImageUrl }: { initialImageUrl: string | null }) {
  const router = useRouter()
  const [imageUrl, setImageUrl] = useState(initialImageUrl)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setError(null)
    try {
      await setDiscoverHeroImage(imageUrl)
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update the Discover background")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-1.5 text-sm font-medium">Discover background photo</p>
        <p className="mb-3 text-sm text-muted-foreground">
          This photo appears behind the Discover introduction on web and mobile. Replacing it updates both.
        </p>
        <FileUploader
          variant="archive"
          kind="image"
          label="Discover background"
          value={imageUrl}
          onUploaded={(result) => setImageUrl(result.url)}
          onCleared={() => setImageUrl(null)}
        />
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <button
        type="button"
        onClick={() => void save()}
        disabled={saving || imageUrl === initialImageUrl}
        className="min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? "Saving..." : imageUrl ? "Save background photo" : "Restore default background"}
      </button>
    </div>
  )
}
