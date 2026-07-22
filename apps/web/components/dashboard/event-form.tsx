"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, CalendarClock, CheckCircle2, KeyRound } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { useAuth } from "@/components/providers/auth-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createEventIdFromDraft } from "@/lib/dashboard-adapters";
import { invokeEdgeFunction } from "@/lib/functions";
import type { CreateEventResult, EventRecord } from "@/lib/types";

const eventFormSchema = z.object({
  capacity: z.number().int().positive("Capacity must be at least 1.").max(1_000_000),
  description: z.string().max(4000, "Keep the description under 4,000 characters."),
  ends_at: z.string().min(1, "Choose an end time."),
  event_id: z.string().min(3, "Use at least 3 characters.").regex(/^[a-zA-Z0-9_-]+$/, "Use letters, numbers, hyphen, or underscore."),
  is_listed: z.boolean(),
  location: z.string().max(300, "Keep the location under 300 characters."),
  name: z.string().trim().min(3, "Give the event a recognizable name.").max(200),
  starts_at: z.string().min(1, "Choose a start time."),
}).refine((value) => new Date(value.starts_at).getTime() < new Date(value.ends_at).getTime(), {
  message: "The event must end after it starts.",
  path: ["ends_at"],
});

type EventFormValues = z.infer<typeof eventFormSchema>;

function localDateTime(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function initialDateValue(offsetMinutes: number): string {
  return localDateTime(new Date(Date.now() + offsetMinutes * 60_000));
}

function eventDefaults(initialEvent?: EventRecord): EventFormValues {
  if (initialEvent) {
    return {
      capacity: initialEvent.capacity,
      description: initialEvent.description,
      ends_at: localDateTime(initialEvent.ends_at),
      event_id: initialEvent.event_id,
      is_listed: initialEvent.is_listed,
      location: initialEvent.location,
      name: initialEvent.name,
      starts_at: localDateTime(initialEvent.starts_at),
    };
  }

  return {
    capacity: 100,
    description: "",
    ends_at: initialDateValue(24 * 60),
    event_id: "",
    is_listed: false,
    location: "",
    name: "",
    starts_at: initialDateValue(30),
  };
}

export function EventForm({ initialEvent, mode }: { initialEvent?: EventRecord; mode: "create" | "edit" }) {
  const { supabase, user } = useAuth();
  const [createdEvent, setCreatedEvent] = useState<CreateEventResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const defaults = useMemo(() => eventDefaults(initialEvent), [initialEvent]);
  const form = useForm<EventFormValues>({ defaultValues: defaults, resolver: zodResolver(eventFormSchema) });
  const nameValue = form.watch("name");

  function handleNameBlur() {
    if (mode === "edit" || form.formState.dirtyFields.event_id) return;
    form.setValue("event_id", createEventIdFromDraft(nameValue), { shouldDirty: false, shouldValidate: true });
  }

  async function onSubmit(values: EventFormValues) {
    setErrorMessage(null);
    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token;
    if (!accessToken || !user) {
      setErrorMessage("Your organizer session is missing. Sign in again.");
      return;
    }

    const body = {
      ...values,
      description: values.description.trim(),
      ends_at: new Date(values.ends_at).toISOString(),
      event_id: values.event_id.trim(),
      location: values.location.trim(),
      name: values.name.trim(),
      starts_at: new Date(values.starts_at).toISOString(),
    };

    try {
      if (mode === "create") {
        const created = await invokeEdgeFunction<CreateEventResult>({ accessToken, body, name: "create-event" });
        setCreatedEvent(created);
        toast.success("Event and General Admission ticket created.");
      } else {
        await invokeEdgeFunction<EventRecord>({ accessToken, body, name: "update-event" });
        toast.success("Event updated.");
        window.location.assign(`/events/${values.event_id}`);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : `Failed to ${mode} event.`);
    }
  }

  const isEdit = mode === "edit";
  const backHref = isEdit ? `/events/${initialEvent?.event_id}` : "/dashboard";

  return (
    <div className="fade-section flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2.5">
        <Button asChild size="sm" variant="outline"><Link href={backHref}><ArrowLeft className="size-3.5" />Back</Link></Button>
        <Badge variant="outline">Organizer-only</Badge>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.6fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CalendarClock className="size-4 text-[var(--color-terracotta)]" />{isEdit ? "Edit event" : "Create event"}</CardTitle>
            <CardDescription>{isEdit ? "Update public details and capacity. Allocated tickets can never be displaced." : "Create the event catalogue entry and its default free ticket in one transaction."}</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-5" onSubmit={form.handleSubmit(onSubmit)}>
              <FieldGroup className="grid gap-4 md:grid-cols-2">
                <Field data-invalid={Boolean(form.formState.errors.name)}>
                  <FieldLabel htmlFor="event-name">Event name</FieldLabel>
                  <Input id="event-name" aria-invalid={Boolean(form.formState.errors.name)} {...form.register("name")} onBlur={(event) => { form.register("name").onBlur(event); handleNameBlur(); }} />
                  <FieldError>{form.formState.errors.name?.message}</FieldError>
                </Field>
                <Field data-invalid={Boolean(form.formState.errors.event_id)}>
                  <FieldLabel htmlFor="event-id">Event ID</FieldLabel>
                  <Input id="event-id" disabled={isEdit} aria-invalid={Boolean(form.formState.errors.event_id)} {...form.register("event_id")} />
                  <FieldDescription>{isEdit ? "Event IDs are permanent after creation." : "Stable identifier used by ticket and gate apps."}</FieldDescription>
                  <FieldError>{form.formState.errors.event_id?.message}</FieldError>
                </Field>
              </FieldGroup>

              <Field data-invalid={Boolean(form.formState.errors.description)}>
                <FieldLabel htmlFor="description">Description</FieldLabel>
                <Textarea id="description" rows={5} {...form.register("description")} />
                <FieldError>{form.formState.errors.description?.message}</FieldError>
              </Field>

              <FieldGroup className="grid gap-4 md:grid-cols-[minmax(0,1fr)_12rem]">
                <Field data-invalid={Boolean(form.formState.errors.location)}>
                  <FieldLabel htmlFor="location">Location</FieldLabel>
                  <Input id="location" {...form.register("location")} />
                  <FieldError>{form.formState.errors.location?.message}</FieldError>
                </Field>
                <Field data-invalid={Boolean(form.formState.errors.capacity)}>
                  <FieldLabel htmlFor="capacity">Global capacity</FieldLabel>
                  <Input id="capacity" min={1} type="number" {...form.register("capacity", { valueAsNumber: true })} />
                  <FieldError>{form.formState.errors.capacity?.message}</FieldError>
                </Field>
              </FieldGroup>

              <FieldGroup className="grid gap-4 md:grid-cols-2">
                <Field data-invalid={Boolean(form.formState.errors.starts_at)}>
                  <FieldLabel htmlFor="starts-at">Starts at</FieldLabel>
                  <Input id="starts-at" type="datetime-local" {...form.register("starts_at")} />
                  <FieldError>{form.formState.errors.starts_at?.message}</FieldError>
                </Field>
                <Field data-invalid={Boolean(form.formState.errors.ends_at)}>
                  <FieldLabel htmlFor="ends-at">Ends at</FieldLabel>
                  <Input id="ends-at" type="datetime-local" {...form.register("ends_at")} />
                  <FieldError>{form.formState.errors.ends_at?.message}</FieldError>
                </Field>
              </FieldGroup>

              <label className="flex items-start gap-3 rounded-[var(--radius-panel)] border border-border bg-secondary p-4">
                <Checkbox
                  checked={form.watch("is_listed")}
                  className="mt-0.5"
                  onCheckedChange={(checked) => form.setValue("is_listed", checked === true, { shouldDirty: true, shouldValidate: true })}
                />
                <span><span className="block text-sm font-medium text-[var(--color-ink)]">Listed publicly</span><span className="mt-1 block text-[13px] leading-5 text-[var(--color-muted-stone)]">Show this event in the public ticket app. Unlisted events remain organizer-only.</span></span>
              </label>

              {errorMessage ? <Alert variant="destructive"><KeyRound className="size-4" /><AlertTitle>Save failed</AlertTitle><AlertDescription>{errorMessage}</AlertDescription></Alert> : null}

              <div className="flex flex-wrap justify-end gap-2">
                <Button asChild variant="ghost"><Link href={backHref}>Cancel</Link></Button>
                <Button disabled={form.formState.isSubmitting || Boolean(createdEvent)} type="submit">{form.formState.isSubmitting ? "Saving…" : createdEvent ? "Event created" : isEdit ? "Save changes" : "Create event"}</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader><CardTitle className="text-base">Ticket contract</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-[13px] leading-5 text-[var(--color-muted-stone)]">
              <p><strong className="text-[var(--color-ink)]">General Admission</strong> is created automatically at GBP 0 and follows the event capacity.</p>
              <p>Additional ticket types can be added from the event workspace with optional type capacities.</p>
              <Alert><AlertTitle>Paid checkout is unavailable</AlertTitle><AlertDescription>Paid types remain visible to attendees, but checkout is blocked until a payment provider is implemented.</AlertDescription></Alert>
            </CardContent>
          </Card>

          {createdEvent ? <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><CheckCircle2 className="size-4 text-[var(--success)]" />Event created</CardTitle><CardDescription>The default General Admission ticket is ready.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="rounded-[16px] bg-[var(--color-warm-mist)] p-4"><p className="text-xs font-medium text-[var(--color-terracotta)]">Join code</p><p className="token-mono mt-2 text-2xl tracking-[0.15em]">{createdEvent.join_code}</p></div><Button asChild><Link href={`/events/${createdEvent.event_id}`}>Open event workspace</Link></Button></CardContent></Card> : null}
        </div>
      </div>
    </div>
  );
}
