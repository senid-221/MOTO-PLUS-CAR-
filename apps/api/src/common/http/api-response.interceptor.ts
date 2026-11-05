import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { type Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { ApiSuccessBody } from '@seremoto/shared-types';

export const DEFAULT_SUCCESS_MESSAGE = 'Operation completed successfully';

/**
 * Wraps every successful response in the envelope defined by the product
 * specification: { success: true, data, message }.
 */
@Injectable()
export class ApiResponseInterceptor<T> implements NestInterceptor<T, ApiSuccessBody<T>> {
  intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<ApiSuccessBody<T>> {
    return next.handle().pipe(
      map((data) => ({
        success: true as const,
        data,
        message: DEFAULT_SUCCESS_MESSAGE,
      })),
    );
  }
}
