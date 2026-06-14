import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AuthValidationError,
  validateAuthCredentials,
} from '../src/lib/auth-validation.ts';

test('normalizes email and accepts a valid sign-in', () => {
  assert.deepEqual(
    validateAuthCredentials({
      email: '  ATTENDEE@Example.COM ',
      mode: 'sign-in',
      password: 'correct horse battery staple',
    }),
    {
      email: 'attendee@example.com',
      mode: 'sign-in',
      password: 'correct horse battery staple',
    },
  );
});

test('requires a full name for account creation', () => {
  assert.throws(
    () => validateAuthCredentials({
      email: 'attendee@example.com',
      fullName: '   ',
      mode: 'sign-up',
      password: 'correct horse battery staple',
    }),
    (error: unknown) => error instanceof AuthValidationError && error.code === 'full_name_required',
  );
});

test('rejects malformed email and short passwords without echoing the password', () => {
  for (const input of [
    { email: 'not-an-email', mode: 'sign-in' as const, password: 'long-enough-password' },
    { email: 'attendee@example.com', mode: 'sign-in' as const, password: 'short' },
  ]) {
    assert.throws(
      () => validateAuthCredentials(input),
      (error: unknown) => {
        assert.ok(error instanceof AuthValidationError);
        assert.doesNotMatch(error.message, /short|long-enough-password/);
        return true;
      },
    );
  }
});
