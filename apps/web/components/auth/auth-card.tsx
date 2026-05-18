"use client";

import { Loader2 } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";

import { getFriendlyAuthErrorMessage, getPostAuthSuccessState, type AuthMode } from "@/lib/auth-feedback";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const modeCopy: Record<AuthMode, { cta: string; description: string; title: string }> = {
  signin: {
    cta: "Sign in",
    description: "Enter your organizer credentials to access the event console.",
    title: "Welcome back",
  },
  signup: {
    cta: "Create organizer",
    description: "Set up the organizer account that will own event keys and provisioning.",
    title: "Create organizer access",
  },
};

export function AuthCard({ className, ...props }: React.ComponentProps<"div">) {
  const supabase = createBrowserSupabaseClient();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setPendingConfirmationEmail(null);
    setIsSubmitting(true);

    try {
      const response =
        mode === "signin"
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({ email, password });

      if (response.error) {
        setErrorMessage(getFriendlyAuthErrorMessage(response.error.message, mode));
        return;
      }

      const nextState = getPostAuthSuccessState(mode, Boolean(response.data.session));

      if (nextState.kind === "confirm-email") {
        setPendingConfirmationEmail(email);
        setPassword("");
        return;
      }

      window.location.assign(nextState.href);
    } finally {
      setIsSubmitting(false);
    }
  }

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setErrorMessage(null);
    setPendingConfirmationEmail(null);
    setPassword("");
  }

  if (pendingConfirmationEmail) {
    return (
      <div className={cn("flex w-full max-w-sm flex-col gap-5", className)} {...props}>
        <Card className="glass-panel border-white/40 shadow-2xl">
          <CardHeader className="text-center">
            <CardTitle>Check your email</CardTitle>
            <CardDescription>
              We sent a confirmation link to{" "}
              <span className="font-medium text-[var(--color-ink)]">
                {pendingConfirmationEmail}
              </span>
              .
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-center text-[13px] text-[var(--color-muted-stone)]">
                Confirm the address, then return here to sign in.
              </p>
              <Button
                className="w-full"
                type="button"
                variant="outline"
                onClick={() => switchMode("signin")}
              >
                Back to sign in
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const copy = modeCopy[mode];

  return (
    <div className={cn("flex w-full max-w-sm flex-col gap-5", className)} {...props}>
      <Card className="glass-panel border-white/40 shadow-2xl">
        <CardHeader className="text-center">
          {/* Logo */}
          <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-[12px] bg-[var(--color-ink)]">
            <svg viewBox="0 0 16 16" fill="none" className="size-5">
              <path
                d="M8 2.5a5 5 0 00-5 5v1.75C3 12.6 5.4 14.7 8 15.5c2.6-.8 5-2.9 5-6.25V7.5a5 5 0 00-5-5z"
                fill="rgba(255,255,255,0.15)"
                stroke="white"
                strokeWidth="1.2"
              />
              <path
                d="M6 8.5l1.5 1.5 3-3.5"
                stroke="white"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          </div>
          <CardTitle>{copy.title}</CardTitle>
          <CardDescription>{copy.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                autoComplete="email"
                disabled={isSubmitting}
                placeholder="organizer@example.com"
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                disabled={isSubmitting}
                minLength={8}
                placeholder={mode === "signin" ? "Enter your password" : "Create a password (8+ characters)"}
                required
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <p className="text-[12px] text-[var(--color-hint-of-grey)]">
                {mode === "signin"
                  ? "Use the organizer account attached to this event inventory."
                  : "Use at least 8 characters for the organizer password."}
              </p>
            </div>

            {errorMessage && (
              <div className="rounded-[16px] border border-[var(--danger)]/20 bg-[var(--danger-soft)] px-4 py-3 text-center text-[13px] text-[var(--danger)]">
                {errorMessage}
              </div>
            )}

            <Button className="w-full" disabled={isSubmitting} type="submit">
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" />
                  {mode === "signin" ? "Signing in…" : "Creating account…"}
                </>
              ) : (
                copy.cta
              )}
            </Button>

            <p className="text-center text-[13px] text-[var(--color-muted-stone)]">
              {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
              <button
                disabled={isSubmitting}
                type="button"
                className="font-medium text-[var(--color-ink)] underline underline-offset-2 hover:text-[var(--color-terracotta)]"
                onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}
              >
                {mode === "signin" ? "Sign up" : "Sign in"}
              </button>
            </p>
          </form>
        </CardContent>
      </Card>
      <p className="px-4 text-center text-[12px] text-[var(--color-hint-of-grey)]">
        By continuing, you agree to the organizer terms and privacy expectations for event access.
      </p>
    </div>
  );
}
