import {
  clearManualDiagnostics,
  readManualDiagnostics,
  recordManualDiagnostic
} from './manual-diagnostics';

const priorFlag = process.env.EXPO_PUBLIC_FINANCE_DIAGNOSTICS_ENABLED;
const priorUrl = process.env.EXPO_PUBLIC_API_URL;
beforeEach(() => {
  process.env.EXPO_PUBLIC_FINANCE_DIAGNOSTICS_ENABLED = 'true';
  process.env.EXPO_PUBLIC_API_URL = 'https://api.staging.masarifiratibi.com';
  jest.spyOn(console, 'info').mockImplementation(() => undefined);
});
afterEach(() => {
  clearManualDiagnostics();
  jest.restoreAllMocks();
  process.env.EXPO_PUBLIC_FINANCE_DIAGNOSTICS_ENABLED = priorFlag;
  process.env.EXPO_PUBLIC_API_URL = priorUrl;
});
it('records bounded correlation and safe failure metadata without financial contents', () => {
  const details = {
    operationId: '11111111-1111-4111-8111-111111111111',
    requestId: '22222222-2222-4222-8222-222222222222',
    status: 403,
    domainCode: 'FORBIDDEN',
    uncertain: false,
    amount: 5000,
    notes: 'private words',
    token: 'secret bearer',
    ownerId: 'private owner'
  };
  recordManualDiagnostic('request', details);
  const rows = readManualDiagnostics();
  expect(rows[0]).toMatchObject({
    stage: 'request',
    status: 403,
    domainCode: 'FORBIDDEN',
    requestId: details.requestId,
    operationHash: expect.stringMatching(/^[a-f0-9]{16}$/),
    uncertain: false
  });
  expect(JSON.stringify(rows)).not.toMatch(
    /11111111|private|bearer|amount|notes|ownerId/
  );
  const copy = rows[0] as Record<string, unknown>;
  copy.status = 200;
  expect(readManualDiagnostics()[0]?.status).toBe(403);
});
it('retains only known input validation rules and excludes arbitrary field contents', () => {
  recordManualDiagnostic('input', {
    failed: true,
    validationRules: [
      'category_type',
      'category_type',
      'account_reference',
      'private words',
      'Bearer secret'
    ]
  });
  expect(readManualDiagnostics()[0]).toMatchObject({
    stage: 'input',
    failed: true,
    validationRules: 'account_reference,category_type'
  });
  expect(JSON.stringify(readManualDiagnostics())).not.toMatch(
    /private|Bearer|secret/
  );
});
it('is disabled by default and outside the exact Staging API and retains at most 200 records', () => {
  process.env.EXPO_PUBLIC_FINANCE_DIAGNOSTICS_ENABLED = 'false';
  recordManualDiagnostic('input', {});
  process.env.EXPO_PUBLIC_FINANCE_DIAGNOSTICS_ENABLED = 'true';
  process.env.EXPO_PUBLIC_API_URL = 'https://production.example';
  recordManualDiagnostic('input', {});
  expect(readManualDiagnostics()).toEqual([]);
  process.env.EXPO_PUBLIC_API_URL = 'https://api.staging.masarifiratibi.com';
  for (let n = 0; n < 205; n++) recordManualDiagnostic('request', {});
  recordManualDiagnostic('request', {
    requestId: 'secret',
    domainCode: 'private words',
    status: NaN
  });
  expect(readManualDiagnostics()).toHaveLength(200);
  expect(readManualDiagnostics().at(-1)).toEqual({
    stage: 'request',
    at: expect.any(Number)
  });
});
