"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowUpRight, CalendarClock, CheckCircle2, KeyRound, Sparkles } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { CopyButton } from "@/components/dashboard/copy-button";
import { useAuth } from "@/components/providers/auth-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { createEventIdFromDraft } from "@/lib/dashboard-adapters";
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

export function EventCreationForm() {
  const { supabase, user } = useAuth();
  const [createdEvent, setCreatedEvent] = useState<CreateEventResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const defaults = useMemo<CreateEventValues>(
    () => ({
      ends_at: initialDateValue(60 * 24),
      event_id: "",
      name: "",
      starts_at: initialDateValue(30),
    }),
    [],
  );

  const form = useForm<CreateEventValues>({
    defaultValues: defaults,
    resolver: zodResolver(createEventSchema),
  });

  const nameValue = form.watch("name");

  function handleNameBlur() {
    const hasCustomEventId = Boolean(form.formState.dirtyFields.event_id);

    if (hasCustomEventId) {
      return;
    }

    form.setValue("event_id", createEventIdFromDraft(nameValue), {
      shouldDirty: false,
      shouldValidate: true,
    });
  }

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
    <div className="fade-section flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild size="sm" variant="outline">
          <Link href="/dashboard">
            <ArrowLeft data-icon="inline-start" />
            Dashboard
          </Link>
        </Button>
        <Badge variant="outline">Organizer-only</Badge>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock />
              Create Event
            </CardTitle>
            <CardDescription>
              Provisioning starts with a trusted event record. Focaccia generates join code, event salt, and signing key as soon as this form succeeds.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-6" onSubmit={form.handleSubmit(onSubmit)}>
              <FieldGroup>
                <Field data-invalid={Boolean(form.formState.errors.name)}>
                  <FieldLabel htmlFor="event-name">Event name</FieldLabel>
                  <Input
                    aria-invalid={Boolean(form.formState.errors.name)}
                    id="event-name"
                    placeholder="Dubai Summit Evening Entry"
                    {...form.register("name")}
                    onBlur={(event) => {
                      form.register("name").onBlur(event);
                      handleNameBlur();
                    }}
                  />
                  <FieldDescription>
                    Use a recognisable name that staff can quickly match under pressure.
                  </FieldDescription>
                  <FieldError>{form.formState.errors.name?.message}</FieldError>
                </Field>

                <Field data-invalid={Boolean(form.formState.errors.event_id)}>
                  <FieldLabel htmlFor="event-id">Event ID</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon>
                      <InputGroupText>event</InputGroupText>
                    </InputGroupAddon>
                    <InputGroupInput
                      aria-invalid={Boolean(form.formState.errors.event_id)}
                      id="event-id"
                      placeholder="dubai_summit_2026"
                      {...form.register("event_id")}
                    />
                  </InputGroup>
                  <FieldDescription>
                    Stable identifier used across provisioning, enrollment, revocations, and gate logs.
                  </FieldDescription>
                  <FieldError>{form.formState.errors.event_id?.message}</FieldError>
                </Field>
              </FieldGroup>

              <FieldGroup className="@lg/field-group:grid @lg/field-group:grid-cols-2 @lg/field-group:gap-4">
                <Field data-invalid={Boolean(form.formState.errors.starts_at)}>
                  <FieldLabel htmlFor="starts-at">Starts at</FieldLabel>
                  <Input
                    aria-invalid={Boolean(form.formState.errors.starts_at)}
                    id="starts-at"
                    type="datetime-local"
                    {...form.register("starts_at")}
                  />
                  <FieldError>{form.formState.errors.starts_at?.message}</FieldError>
                </Field>
                <Field data-invalid={Boolean(form.formState.errors.ends_at)}>
                  <FieldLabel htmlFor="ends-at">Ends at</FieldLabel>
                  <Input
                    aria-invalid={Boolean(form.formState.errors.ends_at)}
                    id="ends-at"
                    type="datetime-local"
                    {...form.register("ends_at")}
                  />
                  <FieldError>{form.formState.errors.ends_at?.message}</FieldError>
                </Field>
              </FieldGroup>

              {errorMessage ? (
                <Alert variant="destructive">
                  <KeyRound />
                  <AlertTitle>Creation failed</AlertTitle>
                  <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
              ) : null}

              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button asChild variant="ghost">
                  <Link href="/dashboard">Cancel</Link>
                </Button>
                <Button disabled={form.formState.isSubmitting} type="submit">
                  {form.formState.isSubmitting ? "Creating event..." : "Create event"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles />
                What happens next
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--muted)]/42 p-3 text-sm leading-6 text-[color:var(--muted-foreground)]">
                1. Event metadata is written under your organizer identity.
              </div>
              <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--muted)]/42 p-3 text-sm leading-6 text-[color:var(--muted-foreground)]">
                2. The service generates <strong className="font-semibold text-[color:var(--foreground)]">EVENT_SALT</strong> and an event signing keypair.
              </div>
              <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--muted)]/42 p-3 text-sm leading-6 text-[color:var(--muted-foreground)]">
                3. You open provisioning and bind the first gate device for this event.
              </div>
            </CardContent>
          </Card>

          {createdEvent ? (
            <Card className="border-[color:var(--border-strong)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CheckCircle2 className="text-[color:var(--success)]" />
                  Event created
                </CardTitle>
                <CardDescription>
                  Share the join code with attendees and continue to gate provisioning.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--accent)]/52 p-4">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                    Join code
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className="font-mono text-4xl tracking-[0.24em] text-[color:var(--foreground)]">
                      {createdEvent.join_code}
                    </p>
                    <CopyButton label="Join code copied." value={createdEvent.join_code} />
                  </div>
                </div>

                <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                    PK_SIGN_EVENT
                  </p>
                  <p className="mt-2 break-all font-mono text-xs text-[color:var(--foreground)]">
                    {createdEvent.pk_sign_event}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button asChild>
                    <Link href={`/events/${createdEvent.event_id}/provisioning`}>
                      Open provisioning
                      <ArrowUpRight data-icon="inline-end" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href={`/events/${createdEvent.event_id}`}>Open event overview</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
