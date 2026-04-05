"use client"

import Link from "next/link"
import type { ComponentProps } from "react"
import {
  IconExternalLink,
  IconLayoutDashboard,
  IconPlus,
  IconShieldCheck,
} from "@tabler/icons-react"

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
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <Link href="/dashboard">
                <IconShieldCheck className="size-5! text-primary" />
                <span className="text-base font-semibold tracking-tight">
                  Focaccia
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <NavMain items={NAV_MAIN} />
        <NavSecondary items={NAV_SECONDARY} className="mt-auto" />
      </SidebarContent>

      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}
