import { CreateEventForm } from "@/components/dashboard/create-event-form";
import { Card, CardContent } from "@/components/ui/card";

export default function CreateEventPage() {
  return (
    <div className="space-y-8">
      <section className="fade-section grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="border-[color:var(--border-strong)] bg-[linear-gradient(180deg,rgba(255,252,246,0.95),rgba(255,252,246,0.88))]">
          <CardContent className="flex h-full flex-col justify-between gap-8 p-8">
            <div className="space-y-4">
              <div className="text-[11px] uppercase tracking-[0.34em] text-[color:var(--muted-foreground)]">
                New event
              </div>
              <h1 className="poster-title text-5xl leading-none text-[color:var(--foreground)]">
                Create the window before the first attendee enrolls.
              </h1>
              <p className="max-w-md text-base leading-7 text-[color:var(--muted-foreground)]">
                One form submit allocates the join code, public signing key, and event salt. Nothing about the attendee biometric pipeline is stored here.
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--background)]/80 p-5">
              <div className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
                What happens next
              </div>
              <ol className="mt-4 space-y-3 text-sm leading-6 text-[color:var(--foreground)]">
                <li>1. Share the join code with attendees.</li>
                <li>2. Open provisioning once the gate phone is ready.</li>
                <li>3. Let the gate app bind itself exactly once.</li>
              </ol>
            </div>
          </CardContent>
        </Card>
        <div className="fade-section fade-delay-1">
          <CreateEventForm />
        </div>
      </section>
    </div>
  );
}
