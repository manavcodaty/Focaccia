'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { useAuth } from '@/components/providers/auth-provider'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, PlusCircle, Trash2, Calendar, MapPin, Tag } from 'lucide-react'
import { createEventIdFromDraft } from '@/lib/dashboard-adapters'
import { invokeEdgeFunction } from '@/lib/functions'
import type { CreateEventResult } from '@/lib/types'
import Link from 'next/link'

// ============================================================
// PROP INTERFACE — Backend engineer should implement these:
//
// onSubmit(data: EventFormData) => Promise<void>
//   Called when the form is valid and submitted.
//   Expect: POST /api/events with the EventFormData payload.
//
// isLoading: boolean
//   Set true while the POST request is in flight to disable
//   inputs and show a spinner on the submit button.
//
// error?: string
//   Server-side validation or network error to display.
// ============================================================
export interface EventFormData {
  name: string
  location: string
  startTime: string
  endTime: string
  tags: string[]
}

interface EventCreationFormProps {
  onSubmit?: (data: EventFormData) => Promise<void>
  isLoading?: boolean
  error?: string
}

// ============================================================
// DEFAULT FORM VALUES — Replace with real defaults as needed
// ============================================================
const INITIAL_STATE: EventFormData = {
  name: '',
  location: '',
  startTime: '',
  endTime: '',
  tags: [],
}

export function EventCreationForm({
  onSubmit,
  isLoading = false,
  error,
}: EventCreationFormProps) {
  const router = useRouter()
  const { supabase, user } = useAuth()
  const [formData, setFormData] = useState<EventFormData>(INITIAL_STATE)
  const [tagInput, setTagInput] = useState('')
  const [submissionError, setSubmissionError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Partial<Record<keyof EventFormData, string>>>({})

  const busy = isLoading || isSubmitting
  const serverError = error ?? submissionError

  function handleChange(field: keyof EventFormData, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (validationErrors[field]) {
      setValidationErrors((prev) => ({ ...prev, [field]: undefined }))
    }
    if (submissionError) {
      setSubmissionError(null)
    }
  }

  function addTag() {
    const trimmed = tagInput.trim()
    if (!trimmed || formData.tags.includes(trimmed)) return
    setFormData((prev) => ({ ...prev, tags: [...prev.tags, trimmed] }))
    setTagInput('')
  }

  function removeTag(tag: string) {
    setFormData((prev) => ({ ...prev, tags: prev.tags.filter((t) => t !== tag) }))
  }

  function validate(): boolean {
    const errors: Partial<Record<keyof EventFormData, string>> = {}
    if (!formData.name.trim()) errors.name = 'Event name is required'
    if (!formData.startTime) errors.startTime = 'Start time is required'
    if (!formData.endTime) errors.endTime = 'End time is required'
    if (formData.startTime && formData.endTime && formData.endTime <= formData.startTime) {
      errors.endTime = 'End time must be after start time'
    }
    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    if (onSubmit) {
      await onSubmit(formData)
      return
    }

    const eventId = createEventIdFromDraft(formData.name)

    if (!eventId) {
      setValidationErrors((prev) => ({
        ...prev,
        name: 'Event name must contain letters or numbers.',
      }))
      return
    }

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.access_token || !user) {
      setSubmissionError('Your organizer session is missing. Sign in again.')
      return
    }

    setIsSubmitting(true)
    setSubmissionError(null)

    try {
      const created = await invokeEdgeFunction<CreateEventResult>({
        accessToken: session.access_token,
        body: {
          ends_at: new Date(formData.endTime).toISOString(),
          event_id: eventId,
          name: formData.name.trim(),
          starts_at: new Date(formData.startTime).toISOString(),
        },
        name: 'create-event',
      })

      toast.success('Event created.')
      router.push(`/events/${created.event_id}/provisioning`)
      router.refresh()
    } catch (submitError) {
      setSubmissionError(
        submitError instanceof Error ? submitError.message : 'Event creation failed.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Back Navigation */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Events
          </Link>
        </Button>
      </div>

      {/* Page Title */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-balance">Create New Event</h1>
        <p className="text-muted-foreground mt-1">
          Fill in the details below. You can provision gates after creating the event.
        </p>
      </div>

      {/* Server-level error */}
      {serverError && (
        <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {serverError}
        </div>
      )}

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Event Details
          </CardTitle>
          <CardDescription>General information about your event</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="event-name">
              Event Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="event-name"
              placeholder="e.g. Summer Music Festival 2026"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              disabled={busy}
              aria-invalid={!!validationErrors.name}
              aria-describedby={validationErrors.name ? 'name-error' : undefined}
            />
            {validationErrors.name && (
              <p id="name-error" className="text-sm text-destructive">
                {validationErrors.name}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-location">
              <MapPin className="inline h-3.5 w-3.5 mr-1" />
              Location
            </Label>
            <Input
              id="event-location"
              placeholder="e.g. Golden Gate Park, San Francisco"
              value={formData.location}
              onChange={(e) => handleChange('location', e.target.value)}
              disabled={busy}
            />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label htmlFor="event-tag">Tags</Label>
            <div className="flex gap-2">
              <Input
                id="event-tag"
                placeholder="Add a tag and press Enter"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addTag()
                  }
                }}
                disabled={busy}
              />
              <Button type="button" variant="outline" onClick={addTag} disabled={busy}>
                <PlusCircle className="h-4 w-4" />
              </Button>
            </div>
            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {formData.tags.map((tag) => (
                  <Badge key={tag} className="gap-1">
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="hover:text-destructive transition-colors"
                      aria-label={`Remove tag ${tag}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Schedule */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Schedule
          </CardTitle>
          <CardDescription>Set the start and end times for your event</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="start-time">
              Start Time <span className="text-destructive">*</span>
            </Label>
            <Input
              id="start-time"
              type="datetime-local"
              value={formData.startTime}
              onChange={(e) => handleChange('startTime', e.target.value)}
              disabled={busy}
              aria-invalid={!!validationErrors.startTime}
              aria-describedby={validationErrors.startTime ? 'start-error' : undefined}
            />
            {validationErrors.startTime && (
              <p id="start-error" className="text-sm text-destructive">
                {validationErrors.startTime}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="end-time">
              End Time <span className="text-destructive">*</span>
            </Label>
            <Input
              id="end-time"
              type="datetime-local"
              value={formData.endTime}
              onChange={(e) => handleChange('endTime', e.target.value)}
              disabled={busy}
              aria-invalid={!!validationErrors.endTime}
              aria-describedby={validationErrors.endTime ? 'end-error' : undefined}
            />
            {validationErrors.endTime && (
              <p id="end-error" className="text-sm text-destructive">
                {validationErrors.endTime}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <Button type="button" variant="outline" asChild disabled={busy}>
          <Link href="/dashboard">Cancel</Link>
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? 'Creating...' : 'Create Event'}
        </Button>
      </div>
    </form>
  )
}
