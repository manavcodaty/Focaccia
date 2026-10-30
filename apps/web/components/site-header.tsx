"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";

import type { ShellEvent } from "@/components/layout/app-shell";
import { ModeToggle } from "@/components/mode-toggle";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

const sectionLabels: Record<string, string> = {
  edit: "Edit",
  logs: "Gate logs",
  provisioning: "Gate setup",
  revocations: "Revocations",
};

function crumbsFor(pathname: string, events: ShellEvent[]) {
  if (pathname === "/dashboard") return [{ label: "Overview" }];
  if (pathname === "/events/new") return [{ href: "/dashboard", label: "Events" }, { label: "New event" }];
  const [, root, rawId, section] = pathname.split("/");
  if (root === "events" && rawId) {
    const eventId = decodeURIComponent(rawId);
    const name = events.find((event) => event.event_id === eventId)?.name ?? eventId;
    const base = `/events/${rawId}`;
    return section
      ? [{ href: "/dashboard", label: "Events" }, { href: base, label: name }, { label: sectionLabels[section] ?? section }]
      : [{ href: "/dashboard", label: "Events" }, { label: name }];
  }
  return [{ label: "Organizer" }];
}

export function SiteHeader({ events }: { events: ShellEvent[] }) {
  const pathname = usePathname();
  const crumbs = crumbsFor(pathname, events);

  return (
    <header className="sticky top-0 z-10 flex h-(--header-height) shrink-0 items-center gap-2 rounded-t-xl border-b bg-background transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full min-w-0 items-center gap-2 px-4 lg:px-6">
        <SidebarTrigger aria-label="Toggle navigation" />
        <Separator className="mx-2 data-[orientation=vertical]:h-4" orientation="vertical" />
        <Breadcrumb className="min-w-0 flex-1">
          <BreadcrumbList className="flex-nowrap">
            {crumbs.map((crumb, index) => (
              <Fragment key={`${crumb.label}-${index}`}>
                {index > 0 ? <BreadcrumbSeparator className={index < crumbs.length - 1 ? "hidden md:block" : undefined} /> : null}
                <BreadcrumbItem className={index < crumbs.length - 1 && index > 0 ? "hidden min-w-0 md:inline-flex" : "min-w-0"}>
                  {"href" in crumb && crumb.href ? (
                    <BreadcrumbLink asChild><Link className="truncate" href={crumb.href}>{crumb.label}</Link></BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage className="truncate">{crumb.label}</BreadcrumbPage>
                  )}
                </BreadcrumbItem>
              </Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
        <div className="ml-auto flex items-center gap-2">
          <ModeToggle />
        </div>
      </div>
    </header>
  );
}
