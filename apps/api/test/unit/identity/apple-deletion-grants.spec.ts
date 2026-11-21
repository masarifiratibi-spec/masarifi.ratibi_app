import { generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import type { ClerkClient, User } from '@clerk/backend';
import {
  AppleAuthorizationRequired,
  AppleDeletionGrants,
  appleDeletionMetadataKey,
} from '../../../src/identity/apple-deletion-grants';
import type { PlatformConfigService } from '../../../src/platform/config/platform-config.service';

const apple = generateKeyPairSync('rsa', { modulusLength: 2048 });
const signing = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const config = {
  MASARIFI_APPLE_GRANT_KEY: randomBytes(32).toString('base64url'),
  MASARIFI_APPLE_KEY_ID: 'TESTKEY123',
  MASARIFI_APPLE_TEAM_ID: 'TESTTEAM12',
  MASARIFI_APPLE_PRIVATE_KEY_BASE64: Buffer.from(
    signing.privateKey.export({ type: 'pkcs8', format: 'pem' }),
  ).toString('base64'),
};
function token(subject: string) {
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const input =
    part({ alg: 'RS256', kid: 'test' }) +
    '.' +
    part({
      iss: 'https://appleid.apple.com',
      aud: 'com.masarifi.mobile',
      exp: Date.now() / 1000 + 60,
      sub: subject,
    });
  return (
    input + '.' + sign('RSA-SHA256', Buffer.from(input), apple.privateKey).toString('base64url')
  );
}

it('binds the exchanged Apple subject and sealed refresh grant to the same Clerk owner and external account', async () => {
  const fixture = {
    id: 'user_a',
    externalAccounts: [{ id: 'eac_1', provider: 'oauth_apple', providerUserId: 'apple-a' }],
    privateMetadata: {},
  };
  const user = fixture as unknown as User;
  const update = jest.fn((_owner: string, patch: { privateMetadata: Record<string, unknown> }) => {
    Object.assign(user.privateMetadata, patch.privateMetadata);
    return Promise.resolve(user);
  });
  const grants = new AppleDeletionGrants(
    { users: { updateUserMetadata: update } } as unknown as ClerkClient,
    { getRequired: (key: keyof typeof config) => config[key] } as unknown as PlatformConfigService,
  );
  const fetch = jest.spyOn(globalThis, 'fetch');
  const secret = randomBytes(32).toString('base64url');
  try {
    await expect(grants.prepare(user)).resolves.toEqual({ remaining: 1 });
    expect(() => {
      grants.assertPrepared(user);
    }).toThrow(AppleAuthorizationRequired);
    fetch
      .mockResolvedValueOnce(Response.json({ id_token: token('apple-b'), refresh_token: secret }))
      .mockResolvedValueOnce(
        Response.json({
          keys: [
            { ...apple.publicKey.export({ format: 'jwk' }), kid: 'test', use: 'sig', alg: 'RS256' },
          ],
        }),
      );
    await expect(grants.prepare(user, 'exchange')).rejects.toBeInstanceOf(
      AppleAuthorizationRequired,
    );
    expect(update).not.toHaveBeenCalled();
    fetch.mockResolvedValueOnce(
      Response.json({ id_token: token('apple-a'), refresh_token: secret }),
    );
    await expect(grants.prepare(user, 'exchange')).resolves.toEqual({ remaining: 0 });
    expect(update).toHaveBeenCalledWith('user_a', {
      privateMetadata: { [appleDeletionMetadataKey]: { eac_1: expect.any(String) as unknown } },
    });
    expect(JSON.stringify(user.privateMetadata)).not.toContain(secret);
    expect(() => {
      grants.assertPrepared({ ...fixture, id: 'user_b' } as unknown as User);
    }).toThrow();
    fetch.mockResolvedValueOnce(Response.json({ error: 'invalid_grant' }, { status: 400 }));
    await expect(grants.prepare(user)).resolves.toEqual({ remaining: 1 });
    fetch
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    await expect(grants.revoke(user)).rejects.toMatchObject({ status: 503 });
    await expect(grants.revoke(user)).resolves.toBeUndefined();
    for (const [url, init] of fetch.mock.calls.slice(-2)) {
      expect(url).toBe('https://appleid.apple.com/auth/revoke');
      expect((init?.body as URLSearchParams).get('token')).toBe(secret);
    }
  } finally {
    fetch.mockRestore();
  }
});
