"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

export function UserMenu() {
  const router = useRouter();
  const { supabase, user } = useAuth();
  const [isPending, setIsPending] = useState(false);

  async function handleSignOut() {
    setIsPending(true);

    const { error } = await supabase.auth.signOut();

    setIsPending(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Signed out.");
    router.push("/login");
    router.refresh();
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
