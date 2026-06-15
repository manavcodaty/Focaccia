import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('the ticket error boundary does not log the runtime error object', async () => {
  const errorPage = await readFile(new URL('../app/error.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(errorPage, /console\.error/);
});

