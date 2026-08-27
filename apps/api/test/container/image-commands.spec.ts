import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { load } from 'js-yaml';

import { dockerResult, imageUnderTest, inspectImage } from './docker-test.utils';

jest.setTimeout(180_000);

describe('same-image process commands', () => {
  it.each([
    ['dist/src/main.js', 'API_BOOTSTRAP_FAILED'],
    ['dist/src/worker.js', 'WORKER_BOOTSTRAP_FAILED'],
    ['dist/src/migration.js', 'MIGRATION_FAILED'],
  ])(
    'runs %s from the reviewed image and fails closed without runtime configuration',
    (command, marker) => {
      const result = dockerResult(['run', '--rm', '--read-only', imageUnderTest, command]);

      expect(result.status).toBe(1);
      expect(`${result.stdout}${result.stderr}`).toContain(marker);
      expect(`${result.stdout}${result.stderr}`).not.toMatch(
        /postgres(?:ql)?:\/\/|password|secret/i,
      );
    },
  );

  it('uses the Node liveness probe and publishes a port only for the API service', () => {
    const inspection = inspectImage();
    const config = inspection.Config as {
      Healthcheck?: { Test?: string[] };
      Cmd?: string[];
    };
    expect(config.Cmd).toEqual(['dist/src/main.js']);
    expect(config.Healthcheck?.Test).toEqual([
      'CMD',
      '/nodejs/bin/node',
      'dist/src/platform/health/container-healthcheck.js',
    ]);

    const probe = dockerResult([
      'run',
      '--rm',
      '--read-only',
      '--entrypoint',
      '/nodejs/bin/node',
      imageUnderTest,
      'dist/src/platform/health/container-healthcheck.js',
    ]);
    expect(probe.status).toBe(1);

    const root = resolve(__dirname, '../../../..');
    const compose = load(
      readFileSync(resolve(root, 'docker/local/compose.backend.yml'), 'utf8'),
    ) as {
      services: Record<string, { ports?: string[]; command?: string[] }>;
    };
    expect(compose.services['backend-api']?.ports).toEqual(['3000:3000']);
    expect(compose.services.worker?.ports).toBeUndefined();
    expect(compose.services['backend-api']?.command).toEqual(['dist/src/main.js']);
    expect(compose.services.worker?.command).toEqual(['dist/src/worker.js']);
  });
});
