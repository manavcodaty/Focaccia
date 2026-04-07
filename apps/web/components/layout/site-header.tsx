"use client"

import { usePathname } from "next/navigation"

import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

function getPageTitle(pathname: string) {
  if (pathname === "/dashboard") {
    return "Dashboard";
  }

  if (pathname === "/events/new") {
    return "Create Event";
  }

  if (pathname.endsWith("/provisioning")) {
    return "Gate Provisioning";
  }

  if (pathname.endsWith("/revocations")) {
    return "Revocations";
  }

  if (pathname.endsWith("/logs")) {
    return "Gate Logs";
  }

  if (pathname.startsWith("/events/")) {
    return "Event Overview";
  }

  return "Focaccia";
}

function getBreadcrumb(pathname: string) {
  if (pathname === "/dashboard") return null;
  if (pathname === "/events/new") return "Events";
  if (pathname.startsWith("/events/")) return "Events";
  return null;
}

export function SiteHeader() {
  const pathname = usePathname()
  const title = getPageTitle(pathname)
  const breadcrumb = getBreadcrumb(pathname)

  return (
    <header className="flex h-(--header-height) shrink-0 items-center border-b border-[color:var(--border)]/60 bg-[color:var(--card)]/40 backdrop-blur-xl transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-2 px-5 md:px-8">
        <SidebarTrigger className="-ml-1.5" />
        <Separator
          orientation="vertical"
          className="mx-1.5 data-[orientation=vertical]:h-4 opacity-30"
        />
        <div className="flex items-center gap-1.5">
          {breadcrumb ? (
            <>
              <span className="text-sm text-[color:var(--muted-foreground)]">{breadcrumb}</span>
              <span className="text-sm text-[color:var(--muted-foreground)]/50">/</span>
            </>
          ) : null}
          <h1 className="text-sm font-medium text-[color:var(--foreground)]">{title}</h1>
        </div>
      </div>
    </header>
  )
}
