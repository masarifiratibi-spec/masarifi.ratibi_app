import { randomUUID } from 'node:crypto';

import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import { financialGeneration, generationHeader } from './financial-generation';
import { logContext } from '../observability/log-context';
import { PlatformLogger } from '../observability/platform-logger';

const safeRequestId = /^[A-Za-z0-9._:-]{1,128}$/;

export function normalizeRequestId(candidate: string | undefined): string {
  return candidate && safeRequestId.test(candidate) ? candidate : randomUUID();
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  private readonly logger = new PlatformLogger();
  readonly use = (request: Request, response: Response, next: NextFunction): void => {
    const candidate = request.header('x-request-id');
    const requestId = normalizeRequestId(candidate);
    (request as Request & { requestId: string }).requestId = requestId;
    response.setHeader('X-Request-Id', requestId);
    const started = performance.now();
    response.once('finish', () => {
      this.logger.info('http.completed', {
        requestId,
        operation: `http.${request.method.toLowerCase()}`,
        outcome: response.statusCode < 400 ? 'success' : 'failure',
        httpStatus: response.statusCode,
        durationMs: Math.round(performance.now() - started),
        code: response.statusCode < 400 ? 'OK' : `HTTP_${String(response.statusCode)}`,
      });
    });
    logContext.run({ requestId }, () => {
      financialGeneration.run(generationHeader(request.header('x-financial-generation')), next);
    });
  };
}
