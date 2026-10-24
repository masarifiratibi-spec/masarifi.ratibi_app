import { isTransientVoiceError } from '../../../src/ai/voice-transient-error';

it.each(['Query read timeout', 'DATABASE_QUERY_TIMEOUT', 'Connection terminated unexpectedly'])(
  'recognizes a recoverable database transport failure: %s',
  (message) => {
    expect(isTransientVoiceError(new Error(message))).toBe(true);
  },
);
it.each(['VOICE_SCOPE_INVALID', 'VOICE_MEDIA_INVALID', 'AI_WORK_FENCE_INVALID', 'unknown'])(
  'never converts %s into an availability retry',
  (message) => {
    expect(isTransientVoiceError(new Error(message))).toBe(false);
  },
);
it('does not hide a scope rejection behind a nested transport exception', () => {
  expect(
    isTransientVoiceError(
      new Error('VOICE_SCOPE_INVALID', { cause: new Error('Query read timeout') }),
    ),
  ).toBe(false);
});
it('handles driver SQL/network codes and hostile error values safely', () => {
  expect(
    isTransientVoiceError(Object.assign(new Error('private driver details'), { code: '08006' })),
  ).toBe(true);
  const hostile = Proxy.revocable(new Error(), {});
  hostile.revoke();
  expect(isTransientVoiceError(hostile.proxy)).toBe(false);
});
