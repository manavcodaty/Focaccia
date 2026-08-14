import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

async function source(path: string) {
  return readFile(new URL(path, root), 'utf8');
}

test('catalogue leads with real events and never fabricates a claim code', async () => {
  const catalogue = await source('components/event-list-page.tsx');
  const ticket = await source('components/inspection-ticket.tsx');

  assert.doesNotMatch(catalogue, /7K4-29Q|programme-visual|programme-card-soft/);
  assert.match(catalogue, /events-heading/);
  assert.match(catalogue, /EventCard/);
    assert.match(catalogue, /InspectionTicket[\s\S]*?events\[0\]/);
  assert.match(ticket, /event: TicketEvent/);
  assert.doesNotMatch(ticket, /Future Systems Forum|F0C4-7X9Q/);
});

test('event artwork is deterministic and derived from event identity', async () => {
  const poster = await source('components/event-poster.tsx');
  const presentation = await source('lib/event-poster.ts');

  assert.match(poster, /event\.event_id/);
  assert.match(poster, /aria-hidden/);
  assert.match(presentation, /createEventPoster/);
  assert.doesNotMatch(poster, /https?:\/\/|<img|next\/image/);
});

test('ticket cancellation requires an accessible confirmation dialog', async () => {
  const detail = await source('components/ticket-detail-page.tsx');

  assert.match(detail, /AlertDialog/);
  assert.match(detail, /Cancel this ticket/);
  assert.match(detail, /cannot be restored/i);
});

test('tickets uses one local shadcn primitive layer for standard controls', async () => {
  const config = await source('components.json');
  const detail = await source('components/ticket-detail-page.tsx');
  const auth = await source('components/auth-form.tsx');

  assert.match(config, /"style"/);
  assert.match(detail, /@\/components\/ui\/alert-dialog/);
  assert.match(auth, /@\/components\/ui\/field/);
});

test('catalogue motion is brief and respects reduced-motion preferences', async () => {
  const reveal = await source('components/reveal-list.tsx');

  assert.match(reveal, /useReducedMotion/);
  assert.match(reveal, /duration:\s*0\.2/);
  assert.doesNotMatch(reveal, /duration:\s*0\.4[2-9]/);
  assert.doesNotMatch(reveal, /opacity:\s*0/);
});

test('ticket shell follows the inspection atelier reference without a visible footer', async () => {
  const layout = await source('app/layout.tsx');
  const styles = await source('app/globals.css');

  assert.doesNotMatch(layout, /SiteFooter/);
  assert.match(layout, /Funnel_Sans/);
  assert.match(styles, /--ink:\s*#17191c/);
  assert.match(styles, /--terracotta:\s*#5d2a1a/);
  assert.match(styles, /\.inspection-ticket-card/);
  assert.match(styles, /@media \(max-width: 380px\)/);
});

test('ticket overlays stay opaque instead of reintroducing glass effects', async () => {
  const sheet = await source('components/ui/sheet.tsx');
  const alertDialog = await source('components/ui/alert-dialog.tsx');

  assert.doesNotMatch(`${sheet}\n${alertDialog}`, /backdrop-blur/);
});

test('ticket form and empty-state primitives preserve ref and element contracts', async () => {
  const input = await source('components/ui/input.tsx');
  const empty = await source('components/ui/empty.tsx');
  const skeleton = await source('components/ui/skeleton.tsx');

  assert.match(input, /forwardRef<HTMLInputElement/);
  assert.match(input, /ref=\{ref\}/);
  assert.doesNotMatch(`${empty}\n${skeleton}`, /React\.ComponentProps/);
  assert.match(empty, /<p[\s\S]*?data-slot="empty-description"/);
});
