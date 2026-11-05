import { z } from 'zod';
import type { ApiErrorDetail } from '@seremoto/shared-types';

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationDto = z.infer<typeof paginationSchema>;

export const idParamSchema = z.object({
  id: z.string().uuid('Identifier is not valid'),
});

/** Convert a ZodError into the API error envelope's details array. */
export function zodErrorToDetails(error: z.ZodError): ApiErrorDetail[] {
  return error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));
}
