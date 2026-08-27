import type { Server } from 'node:http';

import { HttpStatus, type INestApplication } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import type { HealthService } from '../health/health.service';
import { GracefulShutdown, type ShutdownResult } from '../observability/graceful-shutdown';
import type { TelemetryHandle } from '../observability/telemetry';
import { normalizeRequestId } from './request-id.middleware';
import { safeError } from './safe-exception.filter';

type RequestWithId = Request & { requestId?: string };

export function configureRequestDrain(app: INestApplication, shutdown: GracefulShutdown): void {
  app.use((request: RequestWithId, response: Response, next: NextFunction) => {
    const finish = shutdown.beginWork();
    if (!finish) {
      const requestId = normalizeRequestId(request.requestId ?? request.header('x-request-id'));
      request.requestId = requestId;
      response.setHeader('X-Request-Id', requestId);
      response
        .status(HttpStatus.SERVICE_UNAVAILABLE)
        .json(safeError(HttpStatus.SERVICE_UNAVAILABLE, requestId));
      return;
    }
    response.once('finish', finish);
    response.once('close', finish);
    next();
  });
}

export async function drainApplication(
  app: INestApplication,
  health: Pick<HealthService, 'beginShutdown'>,
  telemetry: TelemetryHandle,
  shutdown: GracefulShutdown,
): Promise<ShutdownResult> {
  health.beginShutdown();
  const server = app.getHttpServer() as Server;
  let closeError: Error | undefined;
  const result = await shutdown.shutdown(
    () =>
      new Promise<void>((resolve) => {
        server.close((error?: Error) => {
          closeError = error;
          resolve();
        });
      }),
  );
  if (result.timedOut) server.closeAllConnections();
  await app.close();
  await telemetry.shutdown();
  if (closeError) throw closeError;
  return result;
}
