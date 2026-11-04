import { randomUUID } from "node:crypto"
import { expect, test, type Page } from "@playwright/test"
import { getPayloadFromClientToken } from "@vercel/blob/client"

const password = process.env.E2E_PASSWORD
const adminEmail = process.env.E2E_ADMIN_EMAIL
const adminPassword = process.env.E2E_ADMIN_PASSWORD
const audienceEmail = process.env.E2E_AUDIENCE_EMAIL
const audiencePassword = process.env.E2E_AUDIENCE_PASSWORD
const workId = process.env.E2E_WORK_ID

if (!password || !adminEmail || !adminPassword || !audienceEmail || !audiencePassword || !workId) {
  throw new Error("The isolated E2E runner must provide the E2E credentials and fixture work ID")
}

test.describe.configure({ mode: "serial" })

async function submitAndWaitForPost(page: Page, buttonName: string, path: string) {
  const responsePromise = page.waitForResponse((response) =>
    new URL(response.url()).pathname === path && response.request().method() === "POST",
  )
  await page.getByRole("button", { name: buttonName }).click()
  const response = await responsePromise
  expect(response.ok(), `${path} returned HTTP ${response.status()}`).toBe(true)
}

async function expectSessionRole(page: Page, role: string) {
  const response = await page.request.get("/api/auth/get-session")
  expect(response.status()).toBe(200)
  const session = await response.json()
  expect(session.user?.role, JSON.stringify(session)).toBe(role)
}

test("musician can sign up, create a project, and save a profile", async ({ page }) => {
  const email = `musician-${randomUUID()}@e2e.musikapp.test`

  await page.goto("/sign-up")
  await page.getByRole("button", { name: /Musician/ }).click()
  await page.getByLabel("Name").fill("E2E Musician")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(password)
  await submitAndWaitForPost(page, "Create account", "/api/auth/sign-up/email")
  await expectSessionRole(page, "MUSICIAN")
  await expect(page).toHaveURL(/\/dashboard\/?$/)

  await page.goto("/projects")
  await expect(page.getByRole("heading", { name: "Your projects" })).toBeVisible()
  await page.getByLabel("Title").fill("E2E Project")
  await page.getByLabel("Description").fill("Created by the isolated browser test.")
  await submitAndWaitForPost(page, "Save project", "/projects")
  await expect(page.getByRole("heading", { name: "E2E Project" })).toBeVisible()

  await page.goto("/profile")
  await page.getByLabel("Display name").fill("E2E Stage Name")
  await page.getByLabel("Primary genre").fill("E2E Genre")
  await page.getByLabel("Bio").fill("Profile saved by the isolated browser test.")
  await submitAndWaitForPost(page, "Save profile", "/profile")
  await expect(page).toHaveURL(/\/dashboard\/?$/)

  await page.goto("/profile")
  await expect(page.getByLabel("Display name")).toHaveValue("E2E Stage Name")
  await expect(page.getByLabel("Primary genre")).toHaveValue("E2E Genre")

  const tokenResponse = await page.request.post("/api/upload", {
    data: {
      type: "blob.generate-client-token",
      payload: { pathname: "e2e-document.pdf", clientPayload: null, multipart: false },
    },
  })
  expect(tokenResponse.status()).toBe(200)
  const { clientToken } = await tokenResponse.json()
  const uploadPolicy = getPayloadFromClientToken(clientToken)
  expect(uploadPolicy.allowedContentTypes).toContain("audio/mpeg")
  expect(uploadPolicy.allowedContentTypes).toContain("image/png")
  expect(uploadPolicy.allowedContentTypes).not.toContain("application/pdf")
  expect(uploadPolicy.maximumSizeInBytes).toBe(100 * 1024 * 1024)

  const blobUploads: string[] = []
  await page.route("https://vercel.com/api/blob**", async (route) => {
    const request = route.request()
    expect(request.method()).toBe("PUT")
    expect(request.headers().authorization).toMatch(/^Bearer vercel_blob_client_/)
    const pathname = new URL(request.url()).searchParams.get("pathname")
    expect(pathname).toBeTruthy()
    const contentType = pathname?.endsWith(".mp3")
      ? "audio/mpeg"
      : pathname?.endsWith(".png")
        ? "image/png"
        : undefined
    if (!contentType) throw new Error(`Unexpected E2E upload path: ${pathname}`)
    expect(Number(request.headers()["x-content-length"])).toBeGreaterThan(0)
    blobUploads.push(contentType)

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        url: `https://e2e-public.blob.vercel-storage.com/${pathname}`,
        downloadUrl: `https://e2e-public.blob.vercel-storage.com/${pathname}`,
        pathname,
        contentType,
        contentDisposition: "attachment",
        etag: "isolated-e2e",
      }),
    })
  })

  await page.goto("/works/new")
  await page.getByLabel("Title").fill("E2E Uploaded Work")
  await page.getByLabel("Artist").fill("E2E Stage Name")
  await page.getByLabel("Genre").selectOption({ label: "E2E Genre" })
  await page.getByLabel("Created date").fill("2026-01-01")
  await page.getByLabel("Released date").fill("2026-02-01")
  await page.locator('input[type="file"]').nth(0).setInputFiles({
    name: "e2e-track.mp3",
    mimeType: "audio/mpeg",
    buffer: Buffer.from("isolated audio fixture"),
  })
  await expect(page.getByText("e2e-track.mp3")).toBeVisible()
  await page.locator('input[type="file"]').nth(1).setInputFiles({
    name: "e2e-cover.png",
    mimeType: "image/png",
    buffer: Buffer.from("isolated image fixture"),
  })
  await expect(page.getByRole("img", { name: "Selected artwork" })).toBeVisible()
  await page.getByRole("button", { name: "Save and publish" }).click()
  await expect(page).toHaveURL(/\/dashboard\/?$/)
  expect(blobUploads.sort()).toEqual(["audio/mpeg", "image/png"])

  await page.goto("/works")
  await expect(page.getByText("E2E Uploaded Work", { exact: true })).toBeVisible()
})

test("listener can report a discovered work", async ({ page }) => {
  await page.goto("/sign-in")
  await page.getByLabel("Email").fill(audienceEmail)
  await page.getByLabel("Password").fill(audiencePassword)
  await submitAndWaitForPost(page, "Sign in", "/api/auth/sign-in/email")
  await expectSessionRole(page, "AUDIENCE")
  await expect(page).toHaveURL(/\/discover\/?$/)

  const uploadResponse = await page.request.post("/api/upload", {
    data: {
      type: "blob.generate-client-token",
      payload: { pathname: "unauthorized.mp3", clientPayload: null, multipart: false },
    },
  })
  expect(uploadResponse.status()).toBe(400)
  expect(await uploadResponse.json()).toEqual({ error: "Unauthorized" })

  await page.goto(`/discover/works/${workId}`)
  await expect(page.getByRole("button", { name: "Report work" })).toBeVisible()
  await page.getByRole("button", { name: "Report work" }).click()
  await page.getByLabel("Reason").selectOption({ label: "Copyright concern" })
  await page.locator("textarea").last().fill("Isolated E2E moderation fixture.")
  await page.getByRole("button", { name: "Submit report" }).click()
  await expect(page.getByRole("status")).toContainText("Report submitted")
})

test("admin can hide a reported work from public API discovery", async ({ page }) => {
  await page.goto("/sign-in")
  await page.getByLabel("Email").fill(adminEmail)
  await page.getByLabel("Password").fill(adminPassword)
  await submitAndWaitForPost(page, "Sign in", "/api/auth/sign-in/email")
  await expectSessionRole(page, "SUPER_ADMIN")
  await expect(page).toHaveURL(/\/admin\/?$/)

  await page.goto("/admin/reports")
  await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible()
  await expect(page.getByText("E2E Isolated Work", { exact: true })).toBeVisible()
  page.once("dialog", (dialog) => dialog.accept())
  await submitAndWaitForPost(page, "Hide work", "/admin/reports")
  await expect(page.getByText("RESOLVED", { exact: true })).toBeVisible()

  const response = await page.request.get(`/api/v1/works/${workId}`)
  expect(response.status()).toBe(404)
})
