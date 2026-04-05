"use client"

import { usePathname } from "next/navigation"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

// Map URL paths to human-readable page titles
const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/events/create": "Create Event",
  "/events/gate-provisioning": "Gate Provisioning",
  "/events/logs": "Revocations & Logs",
  "/settings": "Settings",
  "/help": "Help",
}

export function SiteHeader() {
  const pathname = usePathname()
  const title = PAGE_TITLES[pathname] ?? "Focaccia"

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-semibold">{title}</h1>
      </div>
    </header>
  )
}
