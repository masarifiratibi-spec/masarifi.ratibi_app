import {
  CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
  RequestTimeoutException,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { catchError, throwError, timeout, TimeoutError } from 'rxjs';

import { PlatformConfigService } from '../config/platform-config.service';

@Injectable()
export class RequestTimeoutInterceptor implements NestInterceptor {
  constructor(private readonly config: PlatformConfigService) {}

  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      timeout(this.config.get('MASARIFI_REQUEST_TIMEOUT_MS')),
      catchError((error: unknown) =>
        throwError(() => (error instanceof TimeoutError ? new RequestTimeoutException() : error)),
      ),
    );
  }
}
