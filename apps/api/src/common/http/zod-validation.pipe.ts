import { type ArgumentMetadata, Injectable, type PipeTransform } from '@nestjs/common';
import { type ZodTypeAny, zodErrorToDetails } from '@seremoto/validation';
import { ValidationError } from './api-error';

export type ZodRequestTarget = 'body' | 'query' | 'params';

/**
 * Validates a request segment with a shared Zod schema. The same schema file
 * is imported by the web and mobile clients, so a field cannot be accepted by
 * one client and rejected by another.
 */
@Injectable()
export class ZodValidationPipe<T extends ZodTypeAny> implements PipeTransform {
  constructor(
    private readonly schema: T,
    private readonly target: ZodRequestTarget = 'body',
  ) {}

  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    if (metadata.type !== this.target) {
      return value;
    }
    const result = this.schema.safeParse(value ?? {});
    if (!result.success) {
      throw new ValidationError(zodErrorToDetails(result.error));
    }
    return result.data;
  }
}
