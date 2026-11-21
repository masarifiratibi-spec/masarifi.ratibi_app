import { PlatformLogger } from '../../../src/platform/observability/platform-logger';
import { workerErrorFields } from '../../../src/platform/observability/worker-error';

it('bounds cyclic causes and never serializes arbitrary error properties or stack contents', () => {
  const error = Object.assign(new Error('SECRET_TRANSCRIPT'), {
    query: 'SECRET_SQL',
    password: 'SECRET_PASSWORD',
    ownerId: 'SECRET_OWNER',
    code: 'SECRET_CODE',
  });
  Object.assign(error, { cause: error });
  Object.defineProperty(error, 'stack', {
    value:
      'SECRET_AUDIO\n at http://SECRET_URL\n at query (/app/dist/src/platform/database/pool.service.js:12:8)',
  });
  const lines: string[] = [];
  new PlatformLogger((line) => lines.push(line)).error('runtime.failure', workerErrorFields(error));
  expect(JSON.parse(lines[0] ?? '')).toMatchObject({
    causeTruncated: true,
    exception: {
      name: 'Error',
      reason: 'unclassified',
      frames: ['platform/database/pool.service.js:12:8'],
    },
  });
  expect(lines.join('')).not.toContain('SECRET_');
});

it('does not execute application-defined error getters', () => {
  const get = jest.fn(() => {
    throw new Error('SECRET_ACCESSOR');
  });
  const error = {};
  for (const key of ['name', 'message', 'code', 'stack', 'cause'])
    Object.defineProperty(error, key, { get });
  expect(workerErrorFields(error)).toMatchObject({
    exception: { name: 'NonError', reason: 'unclassified', frames: [] },
    causeTruncated: false,
  });
  expect(get).not.toHaveBeenCalled();
});

it('retains nested known Node failures without recording connection details', () => {
  const root = Object.assign(new Error('SECRET_HOST'), { code: 'ECONNREFUSED' });
  const error = new Error('SECRET_WRAPPER', { cause: root });
  const fields = workerErrorFields(error);
  expect(fields.exception).toMatchObject({ code: 'ECONNREFUSED', reason: 'unclassified' });
  expect(fields.exceptionChain).toHaveLength(2);
  expect(JSON.stringify(fields)).not.toContain('SECRET_');
});

it.each([undefined, null, 'SECRET_TOKEN', 42])(
  'handles non-Error rejection %s without dumping it',
  (value) => {
    expect(workerErrorFields(value)).toMatchObject({
      exception: { name: 'NonError', reason: 'unclassified' },
      causeTruncated: false,
    });
    expect(JSON.stringify(workerErrorFields(value))).not.toContain('SECRET_TOKEN');
  },
);

it.each([
  [new TypeError('SECRET_TYPE'), 'TypeError', 'P0001'],
  [new RangeError('SECRET_RANGE'), 'RangeError', 'XX000'],
  [new Error('SECRET_GATEWAY'), 'Error', 'AI_WORK_CANCELLED'],
])('retains approved root types and codes through nested causes', (root, name, code) => {
  Object.assign(root, { code });
  const fields = workerErrorFields(new Error('SECRET_WRAPPER', { cause: root }));
  expect(fields.exception).toMatchObject({ name, code, reason: 'unclassified' });
  expect(JSON.stringify(fields)).not.toContain('SECRET_');
});

it.each([
  'SECRET_MESSAGE /app/dist/src/private_owner_123.js:11:2 ',
  'SECRET_MESSAGE\n    at forged (/app/dist/src/private_owner_123.js:11:2)',
])('does not copy source-shaped private exception text into frames', (message) => {
  const fields = workerErrorFields(new Error(message));
  expect(fields.exception.frames).toEqual([]);
  expect(JSON.stringify(fields)).not.toContain('private_owner');
});

it('rejects forged and traversal-shaped frames while retaining a trusted data-property frame', () => {
  const error = new Error('SECRET_MESSAGE');
  Object.defineProperty(error, 'stack', {
    value:
      'Error: /app/dist/src/platform/database/pool.service.js:99:1\n' +
      ' at forged (/app/dist/src/private_owner_123.js:11:2)\n' +
      ' at traversal (/app/dist/src/platform/database/../../private_owner_123.js:11:2)\n' +
      ' at query (/app/dist/src/platform/database/pool.service.js:12:8)',
  });
  expect(workerErrorFields(error).exception.frames).toEqual([
    'platform/database/pool.service.js:12:8',
  ]);
});

it('does not invoke native lazy stack formatting with application-defined name or message getters', () => {
  const error = new Error();
  const get = jest.fn(() => 'SECRET_ACCESSOR');
  Object.defineProperty(error, 'name', { get });
  Object.defineProperty(error, 'message', { get });
  workerErrorFields(error);
  expect(get).not.toHaveBeenCalled();
});

it('contains throwing and revoked proxy rejection values', () => {
  const proxy = new Proxy(
    {},
    {
      getPrototypeOf() {
        throw new Error('SECRET_TRAP');
      },
      getOwnPropertyDescriptor() {
        throw new Error('SECRET_DESCRIPTOR');
      },
    },
  );
  const revoked = Proxy.revocable({}, {});
  revoked.revoke();
  for (const value of [proxy, revoked.proxy]) {
    expect(() => workerErrorFields(value)).not.toThrow();
    expect(JSON.stringify(workerErrorFields(value))).not.toContain('SECRET_');
  }
});
