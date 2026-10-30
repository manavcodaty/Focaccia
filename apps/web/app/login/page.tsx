import { ArrowLeftIcon, ShieldAlertIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthCard } from "@/components/auth/auth-card";
import { ModeToggle } from "@/components/mode-toggle";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");
  const { error } = await searchParams;

  return (
    <div className="flex min-h-svh flex-col bg-muted/40">
      <Button asChild className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-3 focus-visible:left-3 focus-visible:z-50">
        <a href="#main-content">Skip to sign in</a>
      </Button>
      <header className="flex h-16 items-center justify-between px-5 md:px-8">
        <Button asChild size="sm" variant="ghost">
          <Link href="/"><ArrowLeftIcon data-icon="inline-start" />Home</Link>
        </Button>
        <ModeToggle />
      </header>
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 pb-16" id="main-content">
        {error === "organizer_required" ? (
          <Alert className="max-w-sm" variant="destructive">
            <ShieldAlertIcon />
            <AlertTitle>Organizer access required</AlertTitle>
                      </Alert>
        ) : null}
        <AuthCard />
      </main>
    </div>
  );
}
