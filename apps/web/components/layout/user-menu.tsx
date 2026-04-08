"use client";

import { useState } from "react";
import { ChevronDown, LogOut } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/components/providers/auth-provider";
import { getPostSignOutState } from "@/lib/auth-feedback";
import { performSecureSignOut } from "@/lib/sign-out";

export function UserMenu() {
  const { supabase, user } = useAuth();
  const [isPending, setIsPending] = useState(false);

  async function handleSignOut() {
    setIsPending(true);

    try {
      await performSecureSignOut(supabase);
    } catch (error) {
      setIsPending(false);
      toast.error(error instanceof Error ? error.message : "Unable to sign out.");
      return;
    }

    setIsPending(false);
    const nextState = getPostSignOutState();
    toast.success(nextState.message);
    window.location.replace(nextState.href);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="gap-3 px-4" variant="outline">
          <span className="flex flex-col items-start leading-tight">
            <span className="text-[10px] uppercase tracking-[0.24em] text-[color:var(--muted-foreground)]">
              Organizer
            </span>
            <span className="max-w-[180px] truncate text-sm text-[color:var(--foreground)]">
              {user?.email ?? "Signed in"}
            </span>
          </span>
          <ChevronDown className="size-4 text-[color:var(--muted-foreground)]" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem
          className="justify-between"
          disabled={isPending}
          onClick={handleSignOut}
        >
          Sign out
          <LogOut className="size-4" />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
