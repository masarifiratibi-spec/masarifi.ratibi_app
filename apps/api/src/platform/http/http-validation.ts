import { UnsupportedMediaTypeException, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';

const bodyMethods = new Set(['POST', 'PUT', 'PATCH']);

export function configureValidation(app: NestExpressApplication, bodyLimitBytes: number): void {
  app.useBodyParser('json', {
    inflate: true,
    limit: bodyLimitBytes,
    strict: true,
  });
  app.use((request: Request, _response: Response, next: NextFunction) => {
    if (bodyMethods.has(request.method) && !request.is('application/json')) {
      next(new UnsupportedMediaTypeException());
      return;
    }
    next();
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      stopAtFirstError: false,
    }),
  );
}
