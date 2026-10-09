import Constants from 'expo-constants';
import { recordDevelopmentAuthDiagnostic } from './development-auth-diagnostics';

jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { scheme: 'masarifi-dev' } } }));
const priorUrl = process.env.EXPO_PUBLIC_API_URL;
afterEach(() => { jest.restoreAllMocks(); process.env.EXPO_PUBLIC_API_URL = priorUrl; Constants.expoConfig!.scheme = 'masarifi-dev'; });

it('emits only domain metadata, excluding raw errors and authentication contents', () => {
  process.env.EXPO_PUBLIC_API_URL = 'https://api.staging.masarifiratibi.com';
  const log = jest.spyOn(console, 'info').mockImplementation(() => undefined);
  recordDevelopmentAuthDiagnostic('sso_failure', { status: 422, code: 'network_error', message: 'secret', errors: [{ code: 'form_redirect_url_invalid', longMessage: 'email and nonce' }, { code: 'secret value' }], token: 'private' });
  const entry = JSON.parse(log.mock.calls[0][1] as string);
  expect(entry).toEqual({ stage: 'sso_failure', at: expect.any(Number), status: 422, codes: ['network_error', 'form_redirect_url_invalid'] });
  expect(JSON.stringify(entry)).not.toMatch(/secret|email|nonce|private|message|token/);
});

it('does not emit in the ordinary package or outside Staging', () => {
  const log = jest.spyOn(console, 'info').mockImplementation(() => undefined);
  process.env.EXPO_PUBLIC_API_URL = 'https://api.staging.masarifiratibi.com';
  Constants.expoConfig!.scheme = 'masarifi';
  recordDevelopmentAuthDiagnostic('sso_start');
  Constants.expoConfig!.scheme = 'masarifi-dev';
  process.env.EXPO_PUBLIC_API_URL = 'https://production.example';
  recordDevelopmentAuthDiagnostic('sso_start');
  expect(log).not.toHaveBeenCalled();
});
