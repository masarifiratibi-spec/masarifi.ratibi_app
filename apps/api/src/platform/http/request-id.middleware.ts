import { randomUUID } from 'node:crypto';

import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const safeRequestId = /^[A-Za-z0-9._:-]{1,128}$/;

export function normalizeRequestId(candidate: string | undefined): string {
  return candidate && safeRequestId.test(candidate) ? candidate : randomUUID();
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  readonly use = (request: Request, response: Response, next: NextFunction): void => {
    const candidate = request.header('x-request-id');
    const requestId = normalizeRequestId(candidate);
    (request as Request & { requestId: string }).requestId = requestId;
    response.setHeader('X-Request-Id', requestId);
    next();
  };
}
