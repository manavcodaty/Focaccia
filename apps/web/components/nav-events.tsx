"use client";

import { MoreHorizontalIcon, PencilIcon, QrCodeIcon, SquareArrowOutUpRightIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { ShellEvent } from "@/components/layout/app-shell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const VISIBLE_EVENTS = 7;

const phaseDot = {
  active: "bg-success",
  ended: "bg-muted-foreground/40",
  upcoming: "bg-chart-2",
} as const;

export function NavEvents({ events }: { events: ShellEvent[] }) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const close = () => { if (isMobile) setOpenMobile(false); };
  const currentId = pathname.startsWith("/events/") ? decodeURIComponent(pathname.split("/")[2] ?? "") : null;
  const ordered = [...events].sort((a, b) => Number(b.phase === "active") - Number(a.phase === "active"));
  const visible = ordered.slice(0, VISIBLE_EVENTS);
  if (currentId && !visible.some((event) => event.event_id === currentId)) {
    const current = events.find((event) => event.event_id === currentId);
    if (current) visible.push(current);
  }

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Events</SidebarGroupLabel>
      <SidebarMenu>
        {visible.map((event) => {
          const active = currentId === event.event_id;
          return (
            <SidebarMenuItem key={event.event_id}>
              <SidebarMenuButton asChild isActive={active}>
                <Link aria-current={active ? "page" : undefined} href={`/events/${encodeURIComponent(event.event_id)}`} onClick={close}>
                  <span aria-hidden="true" className="flex size-4 items-center justify-center">
                    <span className={cn("size-1.5 rounded-full", phaseDot[event.phase])} />
                  </span>
                  <span className="truncate">{event.name}</span>
                  <span className="sr-only">, {event.phase === "active" ? "live" : event.phase}</span>
                </Link>
              </SidebarMenuButton>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuAction className="rounded-sm data-[state=open]:bg-accent" showOnHover>
                    <MoreHorizontalIcon />
                    <span className="sr-only">More for {event.name}</span>
                  </SidebarMenuAction>
                </DropdownMenuTrigger>
                <DropdownMenuContent align={isMobile ? "end" : "start"} className="w-44" side={isMobile ? "bottom" : "right"}>
                  <DropdownMenuGroup>
                    <DropdownMenuItem asChild><Link href={`/events/${encodeURIComponent(event.event_id)}`} onClick={close}><SquareArrowOutUpRightIcon />Open workspace</Link></DropdownMenuItem>
                    <DropdownMenuItem asChild><Link href={`/events/${encodeURIComponent(event.event_id)}/provisioning`} onClick={close}><QrCodeIcon />Gate setup</Link></DropdownMenuItem>
                    <DropdownMenuItem asChild><Link href={`/events/${encodeURIComponent(event.event_id)}/edit`} onClick={close}><PencilIcon />Edit event</Link></DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          );
        })}
        {events.length === 0 ? (
          <SidebarMenuItem><span className="px-2 py-1.5 text-xs text-muted-foreground">No events yet</span></SidebarMenuItem>
        ) : null}
        {events.length > VISIBLE_EVENTS ? (
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="text-sidebar-foreground/70">
              <Link href="/dashboard#events" onClick={close}>
                <MoreHorizontalIcon className="text-sidebar-foreground/70" />
                <span>All {events.length} events</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ) : null}
      </SidebarMenu>
    </SidebarGroup>
  );
}
