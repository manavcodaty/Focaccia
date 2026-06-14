export type AuthMode = 'sign-in' | 'sign-up';

export class AuthValidationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

interface AuthCredentialsInput {
  email: string;
  fullName?: string;
  mode: AuthMode;
  password: string;
}

interface ValidatedAuthCredentials {
  email: string;
  fullName?: string;
  mode: AuthMode;
  password: string;
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateAuthCredentials(
  input: AuthCredentialsInput,
): ValidatedAuthCredentials {
  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName?.trim();

  if (!emailPattern.test(email)) {
    throw new AuthValidationError('invalid_email', 'Enter a valid email address.');
  }

  if (input.password.length < 8) {
    throw new AuthValidationError(
      'invalid_password',
      'Use a password with at least eight characters.',
    );
  }

  if (input.mode === 'sign-up' && !fullName) {
    throw new AuthValidationError('full_name_required', 'Enter your full name.');
  }

  return {
    email,
    ...(input.mode === 'sign-up' ? { fullName: fullName! } : {}),
    mode: input.mode,
    password: input.password,
  };
}
