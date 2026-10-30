import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

async function source(path: string) {
  return readFile(new URL(path, root), 'utf8');
}

test('public overview states the real privacy boundary without zero-storage claims', async () => {
  const page = await source('app/page.tsx');

  assert.doesNotMatch(page, /stored nowhere|stores? no data|nothing is stored/i);
  assert.match(page, /Account and event records are stored/i);
  assert.match(page, /Face processing stays on trusted devices/i);
});

test('production routes no longer import the decorative particle landing system', async () => {
  const page = await source('app/page.tsx');
  const layout = await source('app/layout.tsx');

  assert.doesNotMatch(`${page}\n${layout}`, /components\/landing\/hero|components\/landing\/gl/);
});

test('organizer shell is the shadcn sidebar with responsive navigation and current location', async () => {
  const [shell, sidebar, navMain, navEvents, sidebarPrimitive] = await Promise.all([
    source('components/layout/app-shell.tsx'),
    source('components/app-sidebar.tsx'),
    source('components/nav-main.tsx'),
    source('components/nav-events.tsx'),
    source('components/ui/sidebar.tsx'),
  ]);

  assert.match(shell, /SidebarProvider/);
  assert.match(shell, /SidebarInset/);
  assert.match(sidebarPrimitive, /@\/components\/ui\/sheet/);
  assert.match(sidebar, /Organizer/);
  assert.match(navMain, /aria-current/);
  assert.match(navEvents, /aria-current/);
});

test('organizer theme is the neutral shadcn radix-nova system with status tokens', async () => {
  const [css, config, layout] = await Promise.all([
    source('app/globals.css'),
    source('components.json'),
    source('app/layout.tsx'),
  ]);

  assert.match(config, /"style": "radix-nova"/);
  assert.match(css, /--background:\s*oklch\(1 0 0\)/);
  assert.match(css, /\.dark\s*\{[\s\S]*--background:\s*oklch\(0\.145 0 0\)/);
  assert.match(css, /--warning:\s*oklch\(/);
  assert.doesNotMatch(css, /--color-terracotta|--color-warm-mist|Sentient/);
  assert.match(layout, /Geist_Mono/);
  assert.match(layout, /ThemeProvider/);
});

test('organizer dashboard shows plain figures and the events table without charts', async () => {
  const dashboard = await source('app/(secure)/dashboard/page.tsx');
  const { existsSync } = await import('node:fs');

  assert.match(dashboard, /label="Portfolio summary"/);
  assert.match(dashboard, /<SectionCards/);
  assert.match(dashboard, /<EventsDataTable/);
  assert.doesNotMatch(dashboard, /ChartAreaInteractive|recharts|badge:/);
  assert.equal(existsSync(new URL('components/chart-area-interactive.tsx', root)), false);
});

test('gate provisioning keeps raw cryptographic values behind advanced disclosure', async () => {
  const provisioning = await source('app/(secure)/events/[eventId]/provisioning/page.tsx');
  const gateView = await source('components/dashboard/gate-provisioning-view.tsx');

  assert.match(provisioning, /Advanced details/);
  assert.match(provisioning, /@\/components\/ui\/accordion/);
  assert.doesNotMatch(provisioning, /<CardTitle>Public values<\/CardTitle>/);
  assert.doesNotMatch(gateView, /gate\.publicKey/);
});

test('event workspace leads with plain ticket figures instead of charts or status labels', async () => {
  const [workspace, header] = await Promise.all([
    source('components/dashboard/event-operations-workspace.tsx'),
    source('components/dashboard/event-header.tsx'),
  ]);

  assert.match(workspace, /label="Ticket state summary"/);
  assert.match(workspace, /<CardTitle>Allocation<\/CardTitle>/);
  assert.doesNotMatch(workspace, /recharts|ChartContainer|<Progress|"Ready"|badge:/);
  assert.doesNotMatch(workspace, /crypto\.randomUUID\(\)/);
  assert.doesNotMatch(header, /formatTimestamp|starts_at|ends_at/);
});

test('organizer overlays are the stock shadcn primitives with titled content', async () => {
  const dialog = await source('components/ui/dialog.tsx');
  const sheet = await source('components/ui/sheet.tsx');
  const alertDialog = await source('components/ui/alert-dialog.tsx');

  assert.match(dialog, /data-slot="dialog-overlay"/);
  assert.match(sheet, /data-slot="sheet-overlay"/);
  assert.match(alertDialog, /data-slot="alert-dialog-overlay"/);
  assert.match(`${dialog}\n${sheet}\n${alertDialog}`, /bg-black\/10/);
});

test('organizer form and empty-state primitives keep their data-slot contracts', async () => {
  const input = await source('components/ui/input.tsx');
  const textarea = await source('components/ui/textarea.tsx');
  const empty = await source('components/ui/empty.tsx');
  const skeleton = await source('components/ui/skeleton.tsx');

  assert.match(input, /data-slot="input"/);
  assert.match(input, /\{\.\.\.props\}/);
  assert.match(textarea, /data-slot="textarea"/);
  assert.match(empty, /data-slot="empty-description"/);
  assert.match(skeleton, /data-slot="skeleton"/);
});

test('organizer navigation lists only organizer destinations', async () => {
  const { existsSync } = await import('node:fs');
  const sidebar = await source('components/app-sidebar.tsx');

  assert.equal(existsSync(new URL('components/nav-secondary.tsx', root)), false);
  assert.doesNotMatch(sidebar, /Ticket site|ticketsUrl/);
});

test('organizer text boxes, selects, input groups, buttons and badges share one radius and padding', async () => {
  const [input, textarea, group, select, button, badge] = await Promise.all([
    source('components/ui/input.tsx'),
    source('components/ui/textarea.tsx'),
    source('components/ui/input-group.tsx'),
    source('components/ui/select.tsx'),
    source('components/ui/button.tsx'),
    source('components/ui/badge.tsx'),
  ]);

  assert.match(badge, /rounded-lg/);
  assert.doesNotMatch(badge, /rounded-4xl/);
  assert.match(group, /"order-first pl-3 has-\[>svg\]:pl-2\.5/);
  assert.match(group, /"order-last pr-3 has-\[>svg\]:pr-2\.5/);

  assert.match(input, /h-9 w-full min-w-0 rounded-lg [^"]*px-3/);
  assert.match(textarea, /rounded-lg [^"]*px-3/);
  assert.match(group, /flex h-9 w-full min-w-0 items-center rounded-lg/);
  assert.match(select, /rounded-lg [^"]*pl-3 [^"]*data-\[size=default\]:h-9/);
  assert.match(button, /default:\s*"h-9 gap-1\.5 px-3/);
});
