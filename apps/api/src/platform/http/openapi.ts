import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';

import {
  DependencyChecksDto,
  FieldErrorDto,
  LivenessResponseDto,
  ReadinessFailureDto,
  ReadinessSuccessDto,
  SafeErrorDto,
} from './platform-contract.dto';
import { MetaResponseDto } from '../meta/meta.dto';

const schemaNames = [
  'LivenessResponse',
  'DependencyChecks',
  'ReadinessSuccess',
  'ReadinessFailure',
  'MetaResponse',
  'FieldError',
  'SafeError',
];

export function generateOpenApi(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Masarifi Backend Foundation API')
    .setVersion('1.0.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'ClerkBearer')
    .build();
  const document = SwaggerModule.createDocument(app, config, {
    extraModels: [
      LivenessResponseDto,
      DependencyChecksDto,
      ReadinessSuccessDto,
      ReadinessFailureDto,
      MetaResponseDto,
      FieldErrorDto,
      SafeErrorDto,
    ],
  });
  for (const name of schemaNames) {
    const schema = document.components?.schemas?.[name];
    if (schema && typeof schema === 'object' && !('$ref' in schema))
      schema.additionalProperties = false;
  }
  document.openapi = '3.1.0';
  return document;
}
