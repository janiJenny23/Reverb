"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  AudioLines,
  ChevronRight,
  Flag,
  Image,
  LayoutDashboard,
  Menu,
  Music2,
  Tags,
  UsersRound,
  X,
} from "lucide-react"
import { SignOutButton } from "@/components/sign-out-button"

const navigation = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: UsersRound },
  { href: "/admin/works", label: "Works", icon: Music2 },
  { href: "/admin/discover", label: "Discover", icon: Image },
  { href: "/admin/genres", label: "Genres", icon: Tags },
  { href: "/admin/reports", label: "Reports", icon: Flag },
]

export function AdminShell({
  children,
  adminName,
}: {
  children: React.ReactNode
  adminName: string
}) {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const currentPage = navigation.find((item) => item.href === pathname) ?? navigation[0]
  const initials = adminName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")

  useEffect(() => {
    setDrawerOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!drawerOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false)
    }
    document.addEventListener("keydown", closeOnEscape)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", closeOnEscape)
      document.body.style.overflow = ""
    }
  }, [drawerOpen])

  return (
    <div className="dark min-h-svh bg-background text-foreground">
      {drawerOpen ? (
        <button
          aria-label="Close admin navigation"
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setDrawerOpen(false)}
          type="button"
        />
      ) : null}

      <aside
        aria-label="Admin sidebar"
        className={`fixed inset-y-0 left-0 z-50 hidden w-[252px] flex-col border-r border-sidebar-border bg-sidebar px-4 py-6 text-sidebar-foreground ${
          drawerOpen ? "!flex" : ""
        } lg:flex`}
      >
        <Link
          className="mb-9 flex items-center gap-2.5 px-2"
          href="/admin"
          onClick={() => setDrawerOpen(false)}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
            <AudioLines className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="font-serif text-xl font-semibold tracking-tight">
            Reverb <span className="font-sans text-xs font-normal text-muted-foreground">Admin</span>
          </span>
        </Link>
        <button
          aria-label="Close admin navigation"
          className="absolute right-5 top-7 inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-sidebar-accent lg:hidden"
          onClick={() => setDrawerOpen(false)}
          type="button"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        <nav aria-label="Admin sections" className="space-y-1">
          {navigation.map((item) => {
            const active = item.href === "/admin"
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`)
            const Icon = item.icon
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm transition-colors ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"
                }`}
                href={item.href}
                key={item.href}
                onClick={() => setDrawerOpen(false)}
              >
                <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                <span>{item.label}</span>
                {active ? <ChevronRight className="ml-auto h-4 w-4 opacity-70" aria-hidden="true" /> : null}
              </Link>
            )
          })}
        </nav>

        <div className="mt-auto border-t border-sidebar-border px-2 pt-5">
          <p className="max-w-[180px] text-xs leading-5 text-muted-foreground">
            Preserving music, for what&apos;s next.
          </p>
          <div className="mt-5 flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold">
              {initials || "SA"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-sidebar-foreground">{adminName}</p>
              <p className="text-xs text-muted-foreground">Super Admin</p>
            </div>
            <SignOutButton />
          </div>
        </div>
      </aside>

      <div className="min-h-svh lg:pl-[252px]">
        <header className="sticky top-0 z-30 flex h-[68px] items-center justify-between border-b border-border/80 bg-background/95 px-4 backdrop-blur sm:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <button
              aria-expanded={drawerOpen}
              aria-label="Open admin navigation"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border text-foreground hover:bg-accent/10 lg:hidden"
              onClick={() => setDrawerOpen(true)}
              type="button"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
            <div className="min-w-0">
              <p className="truncate text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Reverb / Admin
              </p>
              <p className="truncate text-sm font-semibold">{currentPage.label}</p>
            </div>
          </div>
          <div className="ml-4 flex shrink-0 items-center gap-3">
            <span className="hidden h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-xs font-semibold sm:flex">
              {initials || "SA"}
            </span>
            <div className="hidden text-right sm:block">
              <p className="max-w-40 truncate text-sm font-medium">{adminName}</p>
              <p className="text-xs text-muted-foreground">Super Admin</p>
            </div>
            <div className="sm:hidden">
              <SignOutButton />
            </div>
          </div>
        </header>
        <main className="min-w-0 px-4 py-6 sm:px-7 sm:py-8 lg:px-9 lg:py-9">
          {children}
        </main>
      </div>
    </div>
  )
}
