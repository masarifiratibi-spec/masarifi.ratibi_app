import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { load } from 'js-yaml';

import { AppModule } from '../../src/app.module';
import { generateOpenApi } from '../../src/platform/http/openapi';

type Schema = {
  required?: string[];
  properties?: Record<string, unknown>;
  additionalProperties?: unknown;
};
type Contract = {
  paths: Record<
    string,
    Record<
      string,
      {
        operationId?: string;
        responses?: Record<string, unknown>;
        security?: unknown;
      }
    >
  >;
  components?: { schemas?: Record<string, Schema> };
};

function contractSurface(contract: Contract): unknown {
  const paths = Object.fromEntries(
    Object.entries(contract.paths).map(([path, methods]) => [
      path,
      Object.fromEntries(
        Object.entries(methods)
          .filter(([method]) => ['get', 'post', 'put', 'patch', 'delete'].includes(method))
          .map(([method, operation]) => [
            method,
            {
              operationId: operation.operationId,
              responses: Object.keys(operation.responses ?? {}).sort(),
              secured: Array.isArray(operation.security) && operation.security.length > 0,
            },
          ]),
      ),
    ]),
  );
  const schemas = Object.fromEntries(
    Object.entries(contract.components?.schemas ?? {}).map(([name, schema]) => [
      name,
      {
        additionalProperties: schema.additionalProperties,
        required: [...(schema.required ?? [])].sort(),
        properties: Object.keys(schema.properties ?? {}).sort(),
      },
    ]),
  );
  return { paths, schemas };
}

describe('OpenAPI drift', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => app.close());

  it('matches the approved endpoint and schema surface', () => {
    const approved = load(
      readFileSync(
        resolve(__dirname, '../../specs/001-backend-foundation/contracts/openapi.yaml'),
        'utf8',
      ),
    ) as Contract;
    const generated = generateOpenApi(app) as unknown as Contract;

    expect(contractSurface(generated)).toEqual(contractSurface(approved));
  });
});
