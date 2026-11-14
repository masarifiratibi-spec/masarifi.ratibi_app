import type { PlatformConfigService } from '../../../src/platform/config/platform-config.service';
import { storageConfiguration } from '../../../src/platform/storage/storage-configuration';
import { isProjectRuntimeEnvironment } from '../../../src/platform/config/runtime-scope';
import { AiStorage } from '../../../src/ai/ai.storage';
import { SupportStorage } from '../../../src/engagement/support.storage';

const values: Record<string, unknown> = {
  MASARIFI_STORAGE_PROVIDER: 'filesystem',
  MASARIFI_RUNTIME_SCOPE: 'project-server',
  MASARIFI_STORAGE_URL: 'https://api.example.test',
  MASARIFI_STORAGE_SERVICE_KEY: 'fixture-private-storage-key-0123456789',
  MASARIFI_SUPPORT_SIGNED_URL_SECONDS: 300,
};
const config = {
  get: (key: string) => values[key],
  getRequired: (key: string) => {
    if (values[key] === undefined) throw Error(key);
    return values[key];
  },
} as PlatformConfigService;

describe('project server storage configuration', () => {
  it('uses the explicit filesystem endpoint and credentials without Supabase', () => {
    expect(storageConfiguration(config)).toMatchObject({
      credential: values.MASARIFI_STORAGE_SERVICE_KEY,
    });
    expect(storageConfiguration(config).origin.origin).toBe(values.MASARIFI_STORAGE_URL);
    expect(isProjectRuntimeEnvironment(values)).toBe(true);
    expect(isProjectRuntimeEnvironment({ ...values, MASARIFI_STORAGE_PROVIDER: 'supabase' })).toBe(
      false,
    );
    expect(isProjectRuntimeEnvironment({ ...values, MASARIFI_RUNTIME_SCOPE: 'arbitrary' })).toBe(
      false,
    );
    expect(isProjectRuntimeEnvironment({ SUPABASE_URL: 'https://another.supabase.co' })).toBe(
      false,
    );
    expect(
      isProjectRuntimeEnvironment({ SUPABASE_URL: 'https://qcffvfbpzvpwcwxwjyro.supabase.co' }),
    ).toBe(true);
  });
  it('binds local voice upload capabilities to type and requested lifetime', async () => {
    const fetcher = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>().mockResolvedValue(
      new Response(
        JSON.stringify({
          url: '/storage/v1/object/upload/sign/voice-temp/voice/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222?token=fixture',
          token: 'fixture-upload-capability',
        }),
      ),
    );
    const storage = new AiStorage(config, fetcher);
    const result = await storage.signedUpload(
      'voice/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222',
      300,
      'audio/mp4',
    );
    expect(JSON.parse(fetcher.mock.calls[0]?.[1]?.body as string)).toMatchObject({
      contentType: 'audio/mp4',
      expiresIn: 300,
    });
    expect(result.url).toContain('https://api.example.test/');
  });
  it('binds local support capabilities to the expected content checksum', async () => {
    const fetcher = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>().mockResolvedValue(
      new Response(
        JSON.stringify({
          url: 'https://api.example.test/storage/v1/object/upload/sign/support-attachments/support/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222?token=fixture',
        }),
      ),
    );
    const storage = new SupportStorage(config, fetcher);
    await storage.signUpload(
      'support/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222',
      'text/plain',
      'a'.repeat(64),
    );
    expect(JSON.parse(fetcher.mock.calls[0]?.[1]?.body as string)).toEqual({
      contentType: 'text/plain',
      sha256: 'a'.repeat(64),
      expiresIn: 300,
    });
  });
});
