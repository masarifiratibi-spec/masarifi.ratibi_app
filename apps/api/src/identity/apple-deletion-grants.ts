import {
  createCipheriv,
  createDecipheriv,
  createPrivateKey,
  createPublicKey,
  randomBytes,
  sign,
  verify,
  type JsonWebKey,
  type KeyObject,
} from 'node:crypto';
import type { ClerkClient, User } from '@clerk/backend';
import { HttpException } from '@nestjs/common';
import type { PlatformConfigService } from '../platform/config/platform-config.service';

// Apple native authorization codes are issued for the iOS bundle identifier.
const clientId = 'com.masarifi.mobile';
const issuer = 'https://appleid.apple.com';
export const appleDeletionMetadataKey = 'masarifiAppleDeletionGrants';
const unavailable = () => new HttpException({ code: 'PROVIDER_UNAVAILABLE' }, 503);
export class AppleAuthorizationRequired extends HttpException {
  constructor() {
    super({ code: 'APPLE_AUTHORIZATION_REQUIRED' }, 409);
  }
}

function linkedAppleAccounts(user: User) {
  return user.externalAccounts.filter(
    (account) => account.provider === 'apple' || account.provider === 'oauth_apple',
  );
}

function grantsFor(user: User): Record<string, string> {
  const metadata = user.privateMetadata as Record<string, unknown>;
  const grants = metadata[appleDeletionMetadataKey];
  if (grants === undefined || grants === null) return {};
  if (
    typeof grants !== 'object' ||
    Array.isArray(grants) ||
    !Object.entries(grants).every(
      ([key, value]) => /^eac_[\w-]+$/.test(key) && typeof value === 'string',
    )
  ) {
    throw unavailable();
  }
  return grants as Record<string, string>;
}

export class AppleDeletionGrants {
  private signingKey?: { kid: string; key: KeyObject; expires: number };
  constructor(
    private readonly clerk: ClerkClient,
    private readonly config: PlatformConfigService,
  ) {}

  private async appleSubject(idToken: string): Promise<string> {
    const parts = idToken.split('.');
    const [header, payload, signature] = parts;
    if (parts.length !== 3 || !header || !payload || !signature) throw unavailable();
    const decode = (value: string): unknown =>
      JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    const { alg, kid } = decode(header) as { alg?: string; kid?: string };
    if (alg !== 'RS256' || !kid) throw unavailable();
    if (this.signingKey?.kid !== kid || this.signingKey.expires <= Date.now()) {
      const response = await fetch(issuer + '/auth/keys', {
        redirect: 'error',
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw unavailable();
      const result = (await response.json()) as {
        keys: (JsonWebKey & { kid: string; alg: string; use: string })[];
      };
      const jwk = result.keys.find(
        (key) => key.kid === kid && key.kty === 'RSA' && key.use === 'sig' && key.alg === alg,
      );
      if (!jwk) throw unavailable();
      this.signingKey = {
        kid,
        key: createPublicKey({ key: jwk, format: 'jwk' }),
        expires: Date.now() + 3_600_000,
      };
    }
    if (
      !verify(
        'RSA-SHA256',
        Buffer.from(header + '.' + payload),
        this.signingKey.key,
        Buffer.from(signature, 'base64url'),
      )
    )
      throw unavailable();
    const identity = decode(payload) as { iss?: string; aud?: string; exp?: number; sub?: string };
    if (
      identity.iss !== issuer ||
      identity.aud !== clientId ||
      typeof identity.sub !== 'string' ||
      !identity.sub ||
      typeof identity.exp !== 'number' ||
      identity.exp <= Date.now() / 1000
    )
      throw new AppleAuthorizationRequired();
    return identity.sub;
  }

  private async appleRequest(path: 'token' | 'revoke', fields: Record<string, string>) {
    const now = Math.floor(Date.now() / 1000);
    const encode = (data: object) => Buffer.from(JSON.stringify(data)).toString('base64url');
    const header = encode({ alg: 'ES256', kid: this.config.getRequired('MASARIFI_APPLE_KEY_ID') });
    const claims = encode({
      iss: this.config.getRequired('MASARIFI_APPLE_TEAM_ID'),
      iat: now,
      exp: now + 300,
      aud: issuer,
      sub: clientId,
    });
    const input = header + '.' + claims;
    const key = createPrivateKey(
      Buffer.from(this.config.getRequired('MASARIFI_APPLE_PRIVATE_KEY_BASE64'), 'base64'),
    );
    const signature = sign('sha256', Buffer.from(input), { key, dsaEncoding: 'ieee-p1363' });
    const body = new URLSearchParams({
      ...fields,
      client_id: clientId,
      client_secret: input + '.' + signature.toString('base64url'),
    });
    const response = await fetch(issuer + '/auth/' + path, {
      method: 'POST',
      body,
      redirect: 'error',
      signal: AbortSignal.timeout(8000),
    });
    if (path === 'token' && response.status === 400) {
      const result = (await response.json()) as { error?: string };
      if (result.error === 'invalid_grant') throw new AppleAuthorizationRequired();
    }
    if (response.status !== 200) throw unavailable();
    return response;
  }

  private wrappingKey() {
    const key = Buffer.from(this.config.getRequired('MASARIFI_APPLE_GRANT_KEY'), 'base64url');
    if (key.length !== 32) throw unavailable();
    return key;
  }

  private seal(token: string, owner: string, account: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.wrappingKey(), iv);
    cipher.setAAD(Buffer.from(JSON.stringify([clientId, owner, account])));
    const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
  }

  private open(sealed: string, owner: string, account: string): string {
    const bytes = Buffer.from(sealed, 'base64url');
    const cipher = createDecipheriv('aes-256-gcm', this.wrappingKey(), bytes.subarray(0, 12));
    cipher.setAAD(Buffer.from(JSON.stringify([clientId, owner, account])));
    cipher.setAuthTag(bytes.subarray(12, 28));
    return Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString('utf8');
  }

  async prepare(user: User, code?: string): Promise<{ remaining: number }> {
    const grants = grantsFor(user);
    const linked = linkedAppleAccounts(user);
    if (!code) {
      // Consent may have been withdrawn and granted again on an older client.
      // At deletion admission, prove a stored token still belongs to a live grant.
      let remaining = 0;
      for (const account of linked) {
        const sealed = grants[account.id];
        if (!sealed) {
          remaining++;
          continue;
        }
        try {
          const token = this.open(sealed, user.id, account.id);
          const response = await this.appleRequest('token', {
            grant_type: 'refresh_token',
            refresh_token: token,
          });
          const refreshed = (await response.json()) as {
            access_token?: string;
            refresh_token?: string;
          };
          if (!refreshed.access_token) throw unavailable();
          if (refreshed.refresh_token && refreshed.refresh_token !== token)
            await this.saveGrant(user.id, account.id, refreshed.refresh_token);
        } catch (error) {
          if (!(error instanceof AppleAuthorizationRequired)) throw error;
          remaining++;
        }
      }
      return { remaining };
    }
    if (!linked.length) throw new AppleAuthorizationRequired();
    const response = await this.appleRequest('token', { grant_type: 'authorization_code', code });
    const tokens = (await response.json()) as { id_token?: string; refresh_token?: string };
    if (!tokens.id_token || !tokens.refresh_token) throw unavailable();
    const subject = await this.appleSubject(tokens.id_token);
    const account = linked.find((entry) => entry.providerUserId === subject);
    if (!account) throw new AppleAuthorizationRequired();
    await this.saveGrant(user.id, account.id, tokens.refresh_token);
    return {
      remaining: linked.filter((entry) => entry.id !== account.id && !grants[entry.id]).length,
    };
  }

  private async saveGrant(owner: string, account: string, token: string) {
    await this.clerk.users.updateUserMetadata(owner, {
      privateMetadata: {
        [appleDeletionMetadataKey]: { [account]: this.seal(token, owner, account) },
      },
    });
  }

  assertPrepared(user: User) {
    const grants = grantsFor(user);
    if (linkedAppleAccounts(user).some((account) => !grants[account.id]))
      throw new AppleAuthorizationRequired();
    for (const [account, sealed] of Object.entries(grants)) this.open(sealed, user.id, account);
  }

  async revoke(user: User) {
    this.assertPrepared(user);
    // Keep the encrypted grants until Clerk deletion succeeds. Apple's revoke endpoint
    // accepts an already-revoked token, including after a lost success response.
    for (const [account, sealed] of Object.entries(grantsFor(user))) {
      await this.appleRequest('revoke', {
        token: this.open(sealed, user.id, account),
        token_type_hint: 'refresh_token',
      });
    }
  }
}
