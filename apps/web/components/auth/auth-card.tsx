"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ComponentProps, FormEvent } from "react";
import { useState } from "react";

import { getFriendlyAuthErrorMessage, getPostAuthSuccessState, type AuthMode } from "@/lib/auth-feedback";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "./ui/field";
import { Input } from "./ui/input";

const modeCopy: Record<AuthMode, { cta: string; description: string; title: string }> = {
  signin: {
    cta: "Sign in",
    description: "Enter your organizer email and password to open the secure dashboard.",
    title: "Welcome back",
  },
  signup: {
    cta: "Create organizer",
    description: "Create the organizer account that will own event keys and provisioning state.",
    title: "Create organizer access",
  },
};

export function AuthCard({ className, ...props }: ComponentProps<"div">) {
  const router = useRouter();
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

      router.push(nextState.href);
      router.refresh();
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
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Check your email</CardTitle>
            <CardDescription>
              We sent a confirmation link to <span className="font-medium text-foreground">{pendingConfirmationEmail}</span>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <FieldDescription className="text-center">
                Confirm the address, then return here to sign in to the organizer dashboard.
              </FieldDescription>
              <Button className="w-full" type="button" variant="outline" onClick={() => switchMode("signin")}>
                Back to sign in
              </Button>
            </div>
          </CardContent>
        </Card>
        <FieldDescription className="px-6 text-center">
          By continuing, you agree to the organizer terms and privacy expectations for event access.
        </FieldDescription>
      </div>
    );
  }

  const copy = modeCopy[mode];

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">{copy.title}</CardTitle>
          <CardDescription>{copy.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
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
              </Field>
              <Field>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input
                  id="password"
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  disabled={isSubmitting}
                  minLength={8}
                  placeholder={mode === "signin" ? "Enter your password" : "Create a password"}
                  required
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <FieldDescription>
                  {mode === "signin"
                    ? "Use the organizer account attached to the event inventory."
                    : "Use at least 8 characters for the organizer account password."}
                </FieldDescription>
              </Field>
              {errorMessage ? (
                <FieldDescription className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-center text-destructive">
                  {errorMessage}
                </FieldDescription>
              ) : null}
              <Field>
                <Button className="w-full" disabled={isSubmitting} type="submit">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="animate-spin" />
                      {mode === "signin" ? "Signing in..." : "Creating account..."}
                    </>
                  ) : (
                    copy.cta
                  )}
                </Button>
                <FieldDescription className="text-center">
                  {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
                  <button
                    disabled={isSubmitting}
                    type="button"
                    onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}
                  >
                    {mode === "signin" ? "Sign up" : "Sign in"}
                  </button>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center">
        By continuing, you agree to the organizer terms and privacy expectations for event access.
      </FieldDescription>
    </div>
  );
}
