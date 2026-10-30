"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircleCheckIcon, KeyRoundIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { DateTimeField } from "@/components/dashboard/date-time-field";
import { PageHeader } from "@/components/page-header";
import { useAuth } from "@/components/providers/auth-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
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
  const form = useForm<z.input<typeof eventFormSchema>, unknown, EventFormValues>({ defaultValues: defaults, resolver: zodResolver(eventFormSchema) });
  const { errors } = form.formState;
  const nameValue = form.watch("name");
  const isEdit = mode === "edit";
  const backHref = isEdit ? `/events/${encodeURIComponent(initialEvent?.event_id ?? "")}` : "/dashboard";
  const nameField = form.register("name");

  function handleNameBlur() {
    if (isEdit || form.formState.dirtyFields.event_id) return;
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
        window.location.assign(`/events/${encodeURIComponent(values.event_id)}`);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : `Failed to ${mode} event.`);
    }
  }

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeader title={isEdit ? `Edit ${initialEvent?.name ?? "event"}` : "Create event"} />

      <form className="flex w-full max-w-3xl flex-col gap-4 px-4 lg:px-6" noValidate onSubmit={form.handleSubmit(onSubmit)}>
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <div className="grid gap-4 @2xl/main:grid-cols-2">
                <Field data-invalid={Boolean(errors.name)}>
                  <FieldLabel htmlFor="event-name">Name</FieldLabel>
                  <Input aria-invalid={Boolean(errors.name)} id="event-name" {...nameField} onBlur={(event) => { void nameField.onBlur(event); handleNameBlur(); }} />
                  <FieldError>{errors.name?.message}</FieldError>
                </Field>
                <Field data-disabled={isEdit} data-invalid={Boolean(errors.event_id)}>
                  <FieldLabel htmlFor="event-id">Event ID</FieldLabel>
                  <Input aria-invalid={Boolean(errors.event_id)} className="font-mono" disabled={isEdit} id="event-id" {...form.register("event_id")} />
                  <FieldError>{errors.event_id?.message}</FieldError>
                </Field>
              </div>
              <Field data-invalid={Boolean(errors.description)}>
                <FieldLabel htmlFor="description">Description</FieldLabel>
                <Textarea aria-invalid={Boolean(errors.description)} id="description" rows={4} {...form.register("description")} />
                <FieldError>{errors.description?.message}</FieldError>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <div className="grid gap-4 @2xl/main:grid-cols-2">
                <DateTimeField error={errors.starts_at?.message} id="starts-at" label="Starts" onChange={(value) => form.setValue("starts_at", value, { shouldDirty: true, shouldValidate: form.formState.isSubmitted })} value={form.watch("starts_at")} />
                <DateTimeField error={errors.ends_at?.message} id="ends-at" label="Ends" onChange={(value) => form.setValue("ends_at", value, { shouldDirty: true, shouldValidate: form.formState.isSubmitted })} value={form.watch("ends_at")} />
              </div>
              <div className="grid gap-4 @2xl/main:grid-cols-[minmax(0,1fr)_11rem]">
                <Field data-invalid={Boolean(errors.location)}>
                  <FieldLabel htmlFor="location">Location</FieldLabel>
                  <Input aria-invalid={Boolean(errors.location)} id="location" {...form.register("location")} />
                  <FieldError>{errors.location?.message}</FieldError>
                </Field>
                <Field data-invalid={Boolean(errors.capacity)}>
                  <FieldLabel htmlFor="capacity">Capacity</FieldLabel>
                  <Input aria-invalid={Boolean(errors.capacity)} id="capacity" inputMode="numeric" min={1} type="number" {...form.register("capacity", { valueAsNumber: true })} />
                  <FieldError>{errors.capacity?.message}</FieldError>
                </Field>
              </div>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Field orientation="horizontal">
              <FieldLabel htmlFor="is-listed">Listed</FieldLabel>
              <Switch checked={form.watch("is_listed")} id="is-listed" onCheckedChange={(checked) => form.setValue("is_listed", checked, { shouldDirty: true })} />
            </Field>
          </CardContent>
        </Card>

        {errorMessage ? (
          <Alert variant="destructive">
            <KeyRoundIcon />
            <AlertTitle>Save failed</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        {createdEvent ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><CircleCheckIcon className="size-4 text-success" />Event created</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              <span className="text-sm text-muted-foreground">Join code</span>
              <span className="font-mono text-2xl font-medium tracking-[0.2em]">{createdEvent.join_code}</span>
            </CardContent>
            <CardFooter className="gap-2">
              <Button asChild><Link href={`/events/${encodeURIComponent(createdEvent.event_id)}`}>Open event</Link></Button>
              <Button asChild variant="outline"><Link href={`/events/${encodeURIComponent(createdEvent.event_id)}/provisioning`}>Gate setup</Link></Button>
            </CardFooter>
          </Card>
        ) : (
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button asChild variant="ghost"><Link href={backHref}>Cancel</Link></Button>
            <Button disabled={form.formState.isSubmitting} type="submit">
              {form.formState.isSubmitting ? <Spinner data-icon="inline-start" /> : null}
              {form.formState.isSubmitting ? "Saving…" : isEdit ? "Save changes" : "Create event"}
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
