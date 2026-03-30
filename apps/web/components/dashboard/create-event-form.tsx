"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarPlus, CheckCircle2, KeyRound } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";

import { useAuth } from "@/components/providers/auth-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { invokeEdgeFunction } from "@/lib/functions";
import type { CreateEventResult } from "@/lib/types";

const createEventSchema = z
  .object({
    ends_at: z.string().min(1, "Choose an end time."),
    event_id: z
      .string()
      .min(3, "Use at least 3 characters.")
      .regex(/^[a-zA-Z0-9_-]+$/, "Use letters, numbers, hyphen, or underscore."),
    name: z.string().min(3, "Give the event a recognizable name."),
    starts_at: z.string().min(1, "Choose a start time."),
  })
  .refine(
    (value) => new Date(value.starts_at).getTime() < new Date(value.ends_at).getTime(),
    {
      message: "The event must end after it starts.",
      path: ["ends_at"],
    },
  );

type CreateEventValues = z.infer<typeof createEventSchema>;

function initialDateValue(offsetMinutes: number) {
  const date = new Date(Date.now() + offsetMinutes * 60 * 1000);
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function CreateEventForm() {
  const { supabase, user } = useAuth();
  const [createdEvent, setCreatedEvent] = useState<CreateEventResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const defaults = useMemo<CreateEventValues>(
    () => ({
      ends_at: initialDateValue(60 * 24),
      event_id: "",
      name: "",
      starts_at: initialDateValue(15),
    }),
    [],
  );

  const form = useForm<CreateEventValues>({
    defaultValues: defaults,
    resolver: zodResolver(createEventSchema),
  });

  async function onSubmit(values: CreateEventValues) {
    setErrorMessage(null);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const accessToken = session?.access_token;

    if (!accessToken || !user) {
      setErrorMessage("Your organizer session is missing. Sign in again.");
      return;
    }

    try {
      const created = await invokeEdgeFunction<CreateEventResult>({
        accessToken,
        body: {
          ends_at: new Date(values.ends_at).toISOString(),
          event_id: values.event_id.trim(),
          name: values.name.trim(),
          starts_at: new Date(values.starts_at).toISOString(),
        },
        name: "create-event",
      });

      setCreatedEvent(created);
      toast.success("Event created.");
      form.reset({
        ...defaults,
        event_id: "",
        name: "",
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to create event.");
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <CalendarPlus className="size-5 text-[color:var(--primary)]" />
            Event creation
          </CardTitle>
          <CardDescription>
            This writes the event metadata, generates a server signing keypair, and issues the attendee join code.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
              <div className="grid gap-5 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Event name</FormLabel>
                      <FormControl>
                        <Input placeholder="Dubai Summit Evening Entry" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="event_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Event ID</FormLabel>
                      <FormControl>
                        <Input placeholder="dubai_summit_2026" {...field} />
                      </FormControl>
                      <FormDescription>
                        Stable identifier used across the gate and enrollment flows.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--accent)] p-4 text-sm leading-6 text-[color:var(--muted-foreground)]">
                  The server generates <span className="font-semibold text-[color:var(--foreground)]">EVENT_SALT</span> and an
                  event-scoped <span className="font-semibold text-[color:var(--foreground)]">Ed25519 keypair</span> as soon as the form submits.
                </div>
                <FormField
                  control={form.control}
                  name="starts_at"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Starts at</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="ends_at"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ends at</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              {errorMessage ? (
                <Alert variant="destructive">
                  <KeyRound className="size-4" />
                  <AlertTitle>Creation failed</AlertTitle>
                  <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
              ) : null}
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button disabled={form.formState.isSubmitting} type="submit">
                  {form.formState.isSubmitting ? "Creating event..." : "Create event"}
                </Button>
                <Button asChild variant="ghost">
                  <Link href="/dashboard">Cancel</Link>
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
      <Dialog onOpenChange={(open) => !open && setCreatedEvent(null)} open={Boolean(createdEvent)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <CheckCircle2 className="size-5 text-emerald-600" />
              Event created
            </DialogTitle>
            <DialogDescription>
              The attendee join code is live now. Share it with attendees so they can fetch the enrollment bundle.
            </DialogDescription>
          </DialogHeader>
          {createdEvent ? (
            <div className="space-y-4">
              <div className="rounded-[1.75rem] border border-[color:var(--border)] bg-[color:var(--muted)]/40 p-5">
                <div className="text-[10px] uppercase tracking-[0.28em] text-[color:var(--muted-foreground)]">
                  Join code
                </div>
                <div className="mt-2 font-mono text-4xl tracking-[0.24em] text-[color:var(--foreground)]">
                  {createdEvent.join_code}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--background)]/75 p-4">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
                    Event ID
                  </div>
                  <div className="mt-2 font-mono text-sm text-[color:var(--foreground)]">
                    {createdEvent.event_id}
                  </div>
                </div>
                <div className="rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--background)]/75 p-4">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
                    Public signing key
                  </div>
                  <div className="mt-2 break-all font-mono text-xs text-[color:var(--foreground)]">
                    {createdEvent.pk_sign_event}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            {createdEvent ? (
              <Button asChild>
                <Link href={`/events/${createdEvent.event_id}`}>Open event overview</Link>
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
