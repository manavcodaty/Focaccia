import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

async function source(path: string) {
  return readFile(new URL(path, root), 'utf8');
}

test('catalogue leads with real events and never fabricates a claim code', async () => {
  const catalogue = await source('components/event-list-page.tsx');

  assert.doesNotMatch(catalogue, /7K4-29Q|programme-visual|programme-card-soft/);
  assert.match(catalogue, /events-heading/);
  assert.match(catalogue, /EventCard/);
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
});

test('ticket overlays are the stock shadcn primitives', async () => {
  const sheet = await source('components/ui/sheet.tsx');
  const alertDialog = await source('components/ui/alert-dialog.tsx');

  assert.match(sheet, /data-slot="sheet-overlay"/);
  assert.match(alertDialog, /data-slot="alert-dialog-overlay"/);
});

test('ticket form and empty-state primitives keep their data-slot contracts', async () => {
  const input = await source('components/ui/input.tsx');
  const empty = await source('components/ui/empty.tsx');
  const skeleton = await source('components/ui/skeleton.tsx');

  assert.match(input, /data-slot="input"/);
  assert.match(input, /\{\.\.\.props\}/);
  assert.match(empty, /data-slot="empty-description"/);
  assert.match(skeleton, /data-slot="skeleton"/);
});

test('ticket app uses the shared radix-nova system with Geist and no legacy stylesheet classes', async () => {
  const [config, css, layout, catalogue, detail] = await Promise.all([
    source('components.json'),
    source('app/globals.css'),
    source('app/layout.tsx'),
    source('components/event-list-page.tsx'),
    source('components/event-detail-page.tsx'),
  ]);

  assert.match(config, /"style": "radix-nova"/);
  assert.match(layout, /Geist_Mono/);
  assert.match(layout, /ThemeProvider/);
  assert.doesNotMatch(css, /\.event-card|\.site-header|\.auth-card|Sentient/);
  assert.match(catalogue, /@\/components\/ui\/input-group/);
  assert.match(detail, /@\/components\/ui\/radio-group/);
});

test('the ticket app has no privacy page or navigation entry', async () => {
  const { existsSync } = await import('node:fs');
  const header = await source('components/site-header.tsx');

  assert.equal(existsSync(new URL('app/privacy', root)), false);
  assert.doesNotMatch(header, /\/privacy|Privacy/);
});

test('text boxes, input groups and buttons share one height, radius and padding', async () => {
  const [input, textarea, group, button] = await Promise.all([
    source('components/ui/input.tsx'),
    source('components/ui/textarea.tsx'),
    source('components/ui/input-group.tsx'),
    source('components/ui/button.tsx'),
  ]);

  assert.match(input, /h-9 w-full min-w-0 rounded-lg [^"]*px-3/);
  assert.match(textarea, /rounded-lg [^"]*px-3/);
  assert.match(group, /flex h-9 w-full min-w-0 items-center rounded-lg/);
  assert.match(button, /default:\s*"h-9 gap-1\.5 px-3/);
});
