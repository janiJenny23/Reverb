import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"
import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/session"

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        // Only authenticated musicians and super admins may upload files.
        const user = await getSessionUser()
        if (!user || (user.role !== "MUSICIAN" && user.role !== "SUPER_ADMIN")) {
          throw new Error("Unauthorized")
        }
        return {
          allowedContentTypes: [
            "audio/mpeg",
            "audio/mp3",
            "audio/wav",
            "audio/x-wav",
            "audio/flac",
            "audio/x-flac",
            "audio/mp4",
            "audio/x-m4a",
            "audio/m4a",
            "image/jpeg",
            "image/png",
            "image/webp",
          ],
          maximumSizeInBytes: 100 * 1024 * 1024, // 100 MB
          addRandomSuffix: true,
          callbackUrl: new URL("/api/upload", request.url).toString(),
        }
      },
      onUploadCompleted: async () => {
        // No-op; the client persists the returned URL via a server action.
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 },
    )
  }
}
