import { z, type ZodType } from 'npm:zod@4.1.11';

import { readJsonBody, validationApiError } from './api.ts';

export const idSchema = z.string().trim().min(1).max(160);
export const uuidSchema = z.string().uuid();
export const base64Url22Schema = z.string().regex(/^[A-Za-z0-9_-]{22}$/);
export const base64Url32ByteSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export async function parseJsonBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  const body = await readJsonBody<unknown>(req);
  const result = schema.safeParse(body);

  if (!result.success) {
    throw validationApiError(Object.fromEntries(result.error.issues.map((issue) => [
      issue.path.join('.') || 'body',
      issue.message,
    ])));
  }

  return result.data;
}

export { z };
