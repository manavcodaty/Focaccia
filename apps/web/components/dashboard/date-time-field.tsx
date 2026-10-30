"use client";

import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** Parses the local "YYYY-MM-DDTHH:mm" value the event form stores. */
function parseLocal(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) return undefined;
  const [, y, m, d, hh, mm] = match.map(Number);
  return new Date(y, m - 1, d, hh, mm);
}

const pad = (value: number) => String(value).padStart(2, "0");

/** Date-and-time control from the shadcn "Time Picker" pattern: Popover + Calendar + time Input. */
export function DateTimeField({
  error,
  id,
  label,
  onChange,
  value,
}: {
  error?: string;
  id: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const [open, setOpen] = useState(false);
  const date = parseLocal(value);
  const time = value.slice(11, 16) || "18:00";

  function setDay(day: Date | undefined) {
    if (!day) return;
    onChange(`${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}T${time}`);
    setOpen(false);
  }

  function setTime(next: string) {
    if (!/^\d{2}:\d{2}$/.test(next)) return;
    const base = date ?? new Date();
    onChange(`${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}T${next}`);
  }

  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={`${id}-date`}>{label}</FieldLabel>
      <div className="flex gap-2">
        <Popover onOpenChange={setOpen} open={open}>
          <PopoverTrigger asChild>
            <Button aria-invalid={Boolean(error)} className="flex-1 justify-start font-normal" id={`${id}-date`} variant="outline">
              <CalendarIcon data-icon="inline-start" />
              {date ? format(date, "EEE d MMM yyyy") : "Pick a date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto overflow-hidden p-0">
            <Calendar captionLayout="dropdown" defaultMonth={date} mode="single" onSelect={setDay} selected={date} />
          </PopoverContent>
        </Popover>
        <Input
          aria-invalid={Boolean(error)}
          aria-label={`${label} time`}
          className="w-28 appearance-none bg-background [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
          id={`${id}-time`}
          onChange={(event) => setTime(event.target.value)}
          step={60}
          type="time"
          value={time}
        />
      </div>
      <FieldError>{error}</FieldError>
    </Field>
  );
}
