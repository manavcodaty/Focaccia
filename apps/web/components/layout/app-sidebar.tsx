"use client"

import Link from "next/link"
import type { ComponentProps } from "react"
import {
  IconExternalLink,
  IconLayoutDashboard,
  IconPlus,
} from "@tabler/icons-react"

import { Logo } from "@/components/landing/logo"
import { NavMain } from "@/components/layout/nav-main"
import { NavSecondary } from "@/components/layout/nav-secondary"
import { NavUser } from "@/components/layout/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"

const NAV_MAIN = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: IconLayoutDashboard,
  },
  {
    title: "Create Event",
    url: "/events/new",
    icon: IconPlus,
  },
]

const NAV_SECONDARY = [
  {
    title: "Public Site",
    url: "/",
    icon: IconExternalLink,
  },
]

export function AppSidebar({ ...props }: ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader className="p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-0 h-auto"
            >
              <Link href="/dashboard" className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-lg bg-[color:var(--sidebar-primary)] shadow-[0_1px_3px_rgba(0,102,255,0.3)]">
                  <svg viewBox="0 0 16 16" fill="none" className="size-4">
                    <path d="M8 2.5a5 5 0 00-5 5v1.75C3 12.6 5.4 14.7 8 15.5c2.6-.8 5-2.9 5-6.25V7.5a5 5 0 00-5-5z" fill="rgba(255,255,255,0.2)" stroke="white" strokeWidth="1.2"/>
                    <path d="M6 8.5l1.5 1.5 3-3.5" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  </svg>
                </div>
                <span className="text-[0.9375rem] font-semibold tracking-[-0.01em] text-[color:var(--sidebar-foreground)]">
                  Focaccia
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarSeparator className="opacity-30" />

      <SidebarContent className="px-2 pt-2">
        <NavMain items={NAV_MAIN} />
        <NavSecondary items={NAV_SECONDARY} className="mt-auto" />
      </SidebarContent>

      <SidebarSeparator className="opacity-30" />

      <SidebarFooter className="p-3">
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}
