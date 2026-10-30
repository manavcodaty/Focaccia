"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ModeToggle() {
  const { setTheme, theme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label="Change colour theme" size="icon-sm" variant="ghost">
          <SunIcon className="scale-100 rotate-0 opacity-100 transition-[transform,opacity] duration-200 ease-out dark:scale-75 dark:-rotate-90 dark:opacity-0" />
          <MoonIcon className="absolute scale-75 rotate-90 opacity-0 transition-[transform,opacity] duration-200 ease-out dark:scale-100 dark:rotate-0 dark:opacity-100" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        <DropdownMenuGroup>
          <DropdownMenuRadioGroup onValueChange={setTheme} value={theme ?? "system"}>
            <DropdownMenuRadioItem value="light"><SunIcon />Light</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark"><MoonIcon />Dark</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="system"><MonitorIcon />System</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
