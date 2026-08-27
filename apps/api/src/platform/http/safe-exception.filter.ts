import {
  ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { normalizeRequestId } from './request-id.middleware';

const errors: Record<number, { code: string; message: string }> = {
  [HttpStatus.BAD_REQUEST]: {
    code: 'VALIDATION_FAILED',
    message: 'Request validation failed',
  },
  [HttpStatus.UNAUTHORIZED]: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
  [HttpStatus.FORBIDDEN]: { code: 'FORBIDDEN', message: 'Forbidden' },
  [HttpStatus.NOT_FOUND]: { code: 'NOT_FOUND', message: 'Not found' },
  [HttpStatus.REQUEST_TIMEOUT]: {
    code: 'REQUEST_TIMEOUT',
    message: 'Request timed out',
  },
  [HttpStatus.PAYLOAD_TOO_LARGE]: {
    code: 'PAYLOAD_TOO_LARGE',
    message: 'Payload too large',
  },
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: {
    code: 'UNSUPPORTED_MEDIA_TYPE',
    message: 'Unsupported media type',
  },
  [HttpStatus.TOO_MANY_REQUESTS]: {
    code: 'RATE_LIMITED',
    message: 'Too many requests',
  },
  [HttpStatus.SERVICE_UNAVAILABLE]: {
    code: 'SERVICE_UNAVAILABLE',
    message: 'Service unavailable',
  },
};

type FieldError = { field: string; code: string; message: string };
type SafeError = {
  code: string;
  message: string;
  requestId: string;
  fieldErrors?: FieldError[];
};

const safeField = /^[A-Za-z0-9_.-]{1,128}$/;
const safeCode = /^[A-Z][A-Z0-9_]{0,63}$/;
const safeMessage = /^[A-Za-z0-9 .,:'()_-]{1,256}$/;

function sanitizeFieldError(error: FieldError): FieldError {
  return safeField.test(error.field) && safeCode.test(error.code) && safeMessage.test(error.message)
    ? error
    : { field: 'request', code: 'INVALID', message: 'Invalid value' };
}

function exceptionStatus(exception: unknown): number {
  if (exception instanceof HttpException) return exception.getStatus();
  if (typeof exception !== 'object' || exception === null || !('type' in exception)) return 500;
  const type = Reflect.get(exception, 'type');
  if (type === 'entity.too.large') return HttpStatus.PAYLOAD_TOO_LARGE;
  if (type === 'encoding.unsupported') return HttpStatus.UNSUPPORTED_MEDIA_TYPE;
  if (type === 'entity.parse.failed') return HttpStatus.BAD_REQUEST;
  return 500;
}

export function safeError(
  status: number,
  requestId?: string,
  fieldErrors: FieldError[] = [],
): SafeError {
  const mapped = errors[status] ?? {
    code: 'INTERNAL_ERROR',
    message: 'Internal server error',
  };
  const bounded = fieldErrors.slice(0, 50).map(sanitizeFieldError);
  return {
    ...mapped,
    requestId: normalizeRequestId(requestId),
    ...(bounded.length > 0 ? { fieldErrors: bounded } : {}),
  };
}

@Catch()
export class SafeExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request & { requestId?: string }>();
    const response = http.getResponse<Response>();
    const status = exceptionStatus(exception);
    response.status(status).json(safeError(status, request.requestId));
  }
}
