"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, ArrowRight, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

const authSchema = z.object({
  email: z.string().email("Enter a valid organizer email."),
  password: z.string().min(8, "Use at least 8 characters."),
});

type AuthValues = z.infer<typeof authSchema>;

export function AuthCard() {
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  const form = useForm<AuthValues>({
    defaultValues: {
      email: "",
      password: "",
    },
    resolver: zodResolver(authSchema),
  });

  async function onSubmit(values: AuthValues) {
    setErrorMessage(null);

    const response = mode === "signin"
      ? await supabase.auth.signInWithPassword(values)
      : await supabase.auth.signUp(values);

    if (response.error) {
      setErrorMessage(response.error.message);
      return;
    }

    toast.success(mode === "signin" ? "Signed in." : "Organizer account created.");
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <Card className="relative w-full max-w-xl overflow-hidden border-[color:var(--border-strong)] bg-[color:var(--card)]/94 shadow-[0_40px_120px_-52px_rgba(31,24,18,0.62)]">
      <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(178,91,54,0.7),transparent)]" />
      <CardHeader className="space-y-5 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-2xl border border-[color:var(--border)] bg-[color:var(--accent)]">
            <ShieldCheck className="size-5 text-[color:var(--primary)]" />
          </div>
          <div>
            <div className="font-[family:var(--font-display)] text-3xl leading-none">
              One-Time Face Pass
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.28em] text-[color:var(--muted-foreground)]">
              Organizer access
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <CardTitle className="text-3xl font-medium leading-tight text-[color:var(--foreground)]">
            Set the entry window. Keep the biometric proof event-scoped.
          </CardTitle>
          <CardDescription className="max-w-md">
            Organizers control event keys and provisioning state. Face images never touch this dashboard.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs
          className="space-y-6"
          defaultValue="signin"
          onValueChange={(value) => {
            setMode(value as "signin" | "signup");
            setErrorMessage(null);
          }}
        >
          <TabsList className="w-full justify-start">
            <TabsTrigger value="signin">Sign in</TabsTrigger>
            <TabsTrigger value="signup">Create organizer</TabsTrigger>
          </TabsList>
          <TabsContent value="signin">
            <Form {...form}>
              <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input autoComplete="email" placeholder="organizer@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input autoComplete="current-password" placeholder="••••••••" type="password" {...field} />
                      </FormControl>
                      <FormDescription>
                        Use the organizer account you will keep attached to the event inventory.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {errorMessage ? (
                  <Alert variant="destructive">
                    <AlertCircle className="size-4" />
                    <AlertTitle>Authentication failed</AlertTitle>
                    <AlertDescription>{errorMessage}</AlertDescription>
                  </Alert>
                ) : null}
                <Button className="w-full justify-center" disabled={form.formState.isSubmitting} type="submit">
                  {form.formState.isSubmitting ? "Signing in..." : "Sign in"}
                  <ArrowRight className="size-4" />
                </Button>
              </form>
            </Form>
          </TabsContent>
          <TabsContent value="signup">
            <Form {...form}>
              <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Organizer email</FormLabel>
                      <FormControl>
                        <Input autoComplete="email" placeholder="organizer@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Create password</FormLabel>
                      <FormControl>
                        <Input autoComplete="new-password" placeholder="At least 8 characters" type="password" {...field} />
                      </FormControl>
                      <FormDescription>
                        Local Supabase confirms instantly, so the account becomes active as soon as this succeeds.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {errorMessage ? (
                  <Alert variant="destructive">
                    <AlertCircle className="size-4" />
                    <AlertTitle>Could not create organizer</AlertTitle>
                    <AlertDescription>{errorMessage}</AlertDescription>
                  </Alert>
                ) : null}
                <Button className="w-full justify-center" disabled={form.formState.isSubmitting} type="submit">
                  {form.formState.isSubmitting ? "Creating account..." : "Create organizer"}
                  <ArrowRight className="size-4" />
                </Button>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
