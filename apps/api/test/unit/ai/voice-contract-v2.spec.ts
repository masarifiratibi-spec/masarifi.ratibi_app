import { createVoiceV2 } from '../../../src/ai/ai.dto';

const capture = {
  locale: 'en',
  durationMs: 2832,
  contentType: 'audio/m4a',
  sizeBytes: 46885,
  contentHash: 'a'.repeat(64),
  recordedAt: new Date().toISOString(),
  timezoneOffsetMinutes: -180,
};

it('validates and retains the capture context and content identity', () => {
  expect(createVoiceV2(capture)).toEqual(capture);
});

it.each([
  { durationMs: 60_001 },
  { sizeBytes: 12_582_913 },
  { contentHash: 'invalid' },
  { recordedAt: '2026-02-30T00:00:00.000Z' },
  { timezoneOffsetMinutes: 841 },
  { provider: 'override' },
  { recordedAt: new Date(Date.now() + 600_000).toISOString() },
])('rejects invalid capture metadata %j', (patch) => {
  expect(() => createVoiceV2({ ...capture, ...patch })).toThrow();
});
