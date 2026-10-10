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
  error.stack =
    'SECRET_AUDIO\n at http://SECRET_URL\n at query (/app/dist/src/platform/database/pool.service.js:12:8)';
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
