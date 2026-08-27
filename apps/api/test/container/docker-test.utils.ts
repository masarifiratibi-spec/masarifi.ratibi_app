import { spawnSync, type SpawnSyncReturns } from 'node:child_process';

export const imageUnderTest =
  process.env.MASARIFI_IMAGE_UNDER_TEST ?? 'masarifi-backend:spec-be-001';

export function dockerResult(
  args: string[],
  input?: string,
  timeout = 120_000,
): SpawnSyncReturns<string> {
  const result = spawnSync('docker', args, {
    encoding: 'utf8',
    input,
    maxBuffer: 16 * 1024 * 1024,
    timeout,
  });
  if (result.error) throw result.error;
  return result;
}

export function docker(args: string[], input?: string): string {
  const result = dockerResult(args, input);
  if (result.status !== 0) {
    throw new Error(
      `DOCKER_COMMAND_FAILED:${String(args[0])}:${String(result.status ?? 'unknown')}:${result.stderr.trim()}`,
    );
  }
  return result.stdout.trim();
}

export function inspectImage(image = imageUnderTest): Record<string, unknown> {
  const result = JSON.parse(docker(['image', 'inspect', image])) as Record<string, unknown>[];
  if (!result[0]) throw new Error('IMAGE_INSPECTION_EMPTY');
  return result[0];
}

export function runNode(source: string, image = imageUnderTest): string {
  return docker([
    'run',
    '--rm',
    '--read-only',
    '--tmpfs',
    '/tmp:rw,noexec,nosuid,size=16m',
    '--entrypoint',
    '/nodejs/bin/node',
    image,
    '-e',
    source,
  ]);
}
