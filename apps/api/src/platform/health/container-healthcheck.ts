import { get } from 'node:http';

export function isLiveResponse(status: number | undefined, body: string): boolean {
  try {
    const value = JSON.parse(body) as { status?: unknown };
    return status === 200 && value.status === 'ok';
  } catch {
    return false;
  }
}

export function runHealthcheck(): void {
  const port = Number.parseInt(process.env.MASARIFI_HTTP_PORT ?? '3000', 10);
  const request = get(
    { host: '127.0.0.1', port, path: '/health/live', timeout: 900 },
    (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk: string) => {
        body += chunk;
        if (body.length > 1_024) request.destroy();
      });
      response.on('end', () => {
        process.exitCode = isLiveResponse(response.statusCode, body) ? 0 : 1;
      });
    },
  );
  request.on('timeout', () => request.destroy(new Error('HEALTHCHECK_TIMEOUT')));
  request.on('error', () => {
    process.exitCode = 1;
  });
}

if (require.main === module) runHealthcheck();
