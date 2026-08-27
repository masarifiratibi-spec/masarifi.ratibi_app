import http from 'k6/http';
import { check, sleep } from 'k6';

const baseUrl = __ENV.MASARIFI_BASE_URL || 'http://127.0.0.1:3000';
const token = __ENV.MASARIFI_TEST_JWT;

export const options = {
  scenarios: {
    platform: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '15s', target: 20 },
        { duration: '30s', target: 20 },
        { duration: '15s', target: 0 },
      ],
    },
  },
  thresholds: {
    checks: ['rate==1'],
    'http_req_duration{endpoint:meta}': ['p(95)<250', 'p(99)<500'],
    'http_req_duration{endpoint:liveness}': ['p(99)<100'],
    'http_req_duration{endpoint:readiness}': ['p(99)<1100'],
  },
};

export default function () {
  if (!token) throw new Error('MASARIFI_TEST_JWT_REQUIRED');
  const responses = http.batch([
    ['GET', `${baseUrl}/health/live`, null, { tags: { endpoint: 'liveness' }, timeout: '10s' }],
    ['GET', `${baseUrl}/health/ready`, null, { tags: { endpoint: 'readiness' }, timeout: '10s' }],
    [
      'GET',
      `${baseUrl}/api/v1/meta`,
      null,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Accept-Encoding': 'gzip',
        },
        tags: { endpoint: 'meta' },
        timeout: '10s',
      },
    ],
  ]);

  check(responses[0], {
    'liveness is exact': (response) => response.status === 200 && response.json('status') === 'ok',
  });
  check(responses[1], {
    'readiness is ready': (response) =>
      response.status === 200 && response.json('status') === 'ready',
  });
  check(responses[2], {
    'meta is authenticated': (response) => response.status === 200,
    'meta payload is below 50 KiB': (response) => response.body.length < 50 * 1024,
  });
  sleep(0.1);
}
