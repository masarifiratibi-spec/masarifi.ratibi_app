import {
  clearVoiceDiagnostics,
  readVoiceDiagnostics,
  recordVoiceDiagnostic
} from './voice-diagnostics';

const priorFlag = process.env.EXPO_PUBLIC_VOICE_DIAGNOSTICS_ENABLED;
const priorUrl = process.env.EXPO_PUBLIC_API_URL;
beforeEach(() => {
  process.env.EXPO_PUBLIC_VOICE_DIAGNOSTICS_ENABLED = 'true';
  process.env.EXPO_PUBLIC_API_URL = 'https://api.staging.masarifiratibi.com';
});
afterEach(() => {
  clearVoiceDiagnostics();
  process.env.EXPO_PUBLIC_VOICE_DIAGNOSTICS_ENABLED = priorFlag;
  process.env.EXPO_PUBLIC_API_URL = priorUrl;
  jest.restoreAllMocks();
});

it('exports only allowlisted metadata and hashed capture/session identities', () => {
  const log = jest.spyOn(console, 'info').mockImplementation(() => undefined);
  const details = {
    captureId: 'private-capture',
    sessionId: 'private-session',
    requestId: '22222222-2222-4222-8222-222222222222',
    phase: 'failed',
    operation: 'create',
    status: 503,
    uri: 'file://private-audio.m4a',
    transcript: 'private spoken words',
    amount: 1234,
    token: 'private-token'
  };
  recordVoiceDiagnostic('response', details);
  const encoded = JSON.stringify(log.mock.calls);
  expect(encoded).not.toMatch(
    /private-|spoken|amount|transcript|token|file:\/\//
  );
  expect(encoded).toContain(details.requestId);
  expect(readVoiceDiagnostics()[0]).toMatchObject({
    stage: 'response',
    status: 503,
    phase: 'failed',
    operation: 'create'
  });
});

it('is disabled by default and outside the exact Staging API', () => {
  const log = jest.spyOn(console, 'info').mockImplementation(() => undefined);
  process.env.EXPO_PUBLIC_VOICE_DIAGNOSTICS_ENABLED = 'false';
  recordVoiceDiagnostic('request', {});
  process.env.EXPO_PUBLIC_VOICE_DIAGNOSTICS_ENABLED = 'true';
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test';
  recordVoiceDiagnostic('request', {});
  expect(log).not.toHaveBeenCalled();
  expect(readVoiceDiagnostics()).toEqual([]);
});

it('keeps at most 200 entries and rejects nonnumeric or arbitrary metadata', () => {
  jest.spyOn(console, 'info').mockImplementation(() => undefined);
  for (let n = 0; n < 205; n++)
    recordVoiceDiagnostic('file-check', { bytes: n });
  recordVoiceDiagnostic('response', {
    requestId: 'private-token',
    phase: 'private-words',
    operation: 'file://private-path',
    status: NaN,
    durationMs: -1
  });
  const rows = readVoiceDiagnostics();
  expect(rows).toHaveLength(200);
  expect(rows[0]?.bytes).toBe(6);
  expect(rows.at(-1)).toEqual({ stage: 'response', at: expect.any(Number) });
});
