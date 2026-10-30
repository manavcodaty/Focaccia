"use client";

import { MailCheckIcon } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";

import { PrivatePassMark } from "@/components/brand";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { getFriendlyAuthErrorMessage, getPostAuthSuccessState, type AuthMode } from "@/lib/auth-feedback";
import { invokeEdgeFunction } from "@/lib/functions";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

const modeCopy: Record<AuthMode, { cta: string; title: string }> = {
  signin: {
    cta: "Sign in",
    title: "Sign in",
  },
  signup: {
    cta: "Create account",
    title: "Create organizer account",
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
      let response:
        | Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>
        | Awaited<ReturnType<typeof supabase.auth.signUp>>;

      try {
        response =
          mode === "signin"
            ? await supabase.auth.signInWithPassword({ email, password })
            : await supabase.auth.signUp({ email, password });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to fetch";
        setErrorMessage(getFriendlyAuthErrorMessage(message, mode));
        return;
      }

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

      const session = response.data.session;

      if (!session) {
        setErrorMessage("Sign in again to verify organizer access.");
        return;
      }

      try {
        await invokeEdgeFunction({
          accessToken: session.access_token,
          body: {},
          name: "ensure-organizer",
        });
      } catch {
        await supabase.auth.signOut();
        setErrorMessage("This email is not approved for organizer access.");
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
      <div className={cn("flex w-full max-w-sm flex-col gap-6", className)} {...props}>
        <Card>
          <CardHeader className="items-center text-center">
            <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full bg-muted"><MailCheckIcon className="size-5" /></div>
            <CardTitle className="text-xl">Check your email</CardTitle>
            <CardDescription>{pendingConfirmationEmail}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => switchMode("signin")} type="button" variant="outline">Back to sign in</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const copy = modeCopy[mode];

  return (
    <div className={cn("flex w-full max-w-sm flex-col gap-6", className)} {...props}>
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground"><PrivatePassMark /></span>
        <h1 className="text-xl font-semibold tracking-tight">{copy.title}</h1>
      </div>
      <Card>
        <CardContent>
          <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  autoComplete="email"
                  disabled={isSubmitting}
                  id="email"
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  type="email"
                  value={email}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  disabled={isSubmitting}
                  id="password"
                  minLength={8}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  type="password"
                  value={password}
                />
              </Field>
            </FieldGroup>

            {errorMessage ? <Alert role="alert" variant="destructive"><AlertDescription>{errorMessage}</AlertDescription></Alert> : null}

            <Button className="w-full" disabled={isSubmitting} size="lg" type="submit">
              {isSubmitting ? <Spinner data-icon="inline-start" /> : null}
              {isSubmitting ? (mode === "signin" ? "Signing in…" : "Creating account…") : copy.cta}
            </Button>
          </form>
        </CardContent>
      </Card>
      <p className="text-center text-sm text-muted-foreground">
        <Button
          className="h-auto p-0 align-baseline text-muted-foreground hover:text-foreground"
          disabled={isSubmitting}
          onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}
          type="button"
          variant="link"
        >
          {mode === "signin" ? "Create account" : "Sign in"}
        </Button>
      </p>
    </div>
  );
}
