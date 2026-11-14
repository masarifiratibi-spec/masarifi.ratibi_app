import {
  ClerkProviderUnavailableError,
  type ClerkAuthentication,
  type ClerkClientService,
} from '../../../src/identity/clerk-client.service';

export type FixtureCredentialReference =
  | 'primary_0'
  | 'primary_1000'
  | 'primary_10000'
  | 'secondary'
  | 'correctness'
  | 'correctness_stale'
  | 'expired'
  | 'not_yet_valid'
  | 'revoked'
  | 'stale_recent'
  | 'wrong_role'
  | 'wrong_azp'
  | 'inactive'
  | 'provider_unavailable';

export interface FixtureCredential {
  reference: FixtureCredentialReference;
  token: string;
  userId: string;
  sessionId: string;
  notBeforeMs: number;
  expiresAtMs: number;
  sessionStatus: 'active' | 'inactive';
  role: 'authenticated' | 'fixture_invalid';
  azp?: string;
  factorVerificationAge: readonly [number, number] | null;
  revoked?: boolean;
  unavailable?: boolean;
}

const references = new Set<FixtureCredentialReference>([
  'primary_0',
  'primary_1000',
  'primary_10000',
  'secondary',
  'correctness',
  'correctness_stale',
  'expired',
  'not_yet_valid',
  'revoked',
  'stale_recent',
  'wrong_role',
  'wrong_azp',
  'inactive',
  'provider_unavailable',
]);
function fixtureOwner(reference: FixtureCredentialReference): string {
  if (reference === 'primary_1000') return 'perf_20261102_t1000';
  if (reference === 'primary_10000') return 'perf_20261102_t10000';
  if (reference === 'secondary') return 'perf_20261102_secondary';
  if (reference === 'correctness' || reference === 'correctness_stale')
    return 'perf_20261102_admission';
  return 'perf_20261102_t0';
}

function validFactorAge(value: unknown): value is readonly [number, number] | null {
  return (
    value === null ||
    (Array.isArray(value) &&
      value.length === 2 &&
      value.every((age: unknown) => typeof age === 'number' && Number.isFinite(age) && age >= -1))
  );
}

/** Test composition only: replace the external verifier, never a guard or repository. */
export class FixtureClerkVerifier implements Pick<
  ClerkClientService,
  'authenticateRequest' | 'getIdentityUser' | 'revokeSession'
> {
  private readonly credentials = new Map<string, FixtureCredential>();
  private readonly tokensByReference = new Map<FixtureCredentialReference, string>();
  private forbiddenBoundaryCalls = 0;

  constructor(
    entries: readonly FixtureCredential[],
    private readonly now: () => number = Date.now,
  ) {
    if (entries.length < 1 || entries.length > references.size) this.invalidConfiguration();
    for (const entry of entries) {
      const ages: unknown = entry.factorVerificationAge;
      if (
        !references.has(entry.reference) ||
        entry.userId !== fixtureOwner(entry.reference) ||
        !/^[A-Za-z0-9._~-]{24,4096}$/.test(entry.token) ||
        !/^qa_session_[A-Za-z0-9_]{1,100}$/.test(entry.sessionId) ||
        !Number.isSafeInteger(entry.notBeforeMs) ||
        !Number.isSafeInteger(entry.expiresAtMs) ||
        entry.notBeforeMs < 0 ||
        entry.expiresAtMs <= entry.notBeforeMs ||
        entry.expiresAtMs - entry.notBeforeMs > 12 * 60 * 60 * 1000 ||
        !['active', 'inactive'].includes(entry.sessionStatus) ||
        !['authenticated', 'fixture_invalid'].includes(entry.role) ||
        (entry.azp !== undefined && (typeof entry.azp !== 'string' || entry.azp.length > 256)) ||
        !validFactorAge(ages) ||
        (entry.revoked !== undefined && typeof entry.revoked !== 'boolean') ||
        (entry.unavailable !== undefined && typeof entry.unavailable !== 'boolean') ||
        this.credentials.has(entry.token) ||
        this.tokensByReference.has(entry.reference)
      )
        this.invalidConfiguration();
      this.credentials.set(entry.token, {
        ...entry,
        factorVerificationAge: ages === null ? null : [ages[0], ages[1]],
      });
      this.tokensByReference.set(entry.reference, entry.token);
    }
  }

  authenticateRequest(request: {
    headers: Readonly<Record<string, unknown>>;
  }): Promise<ClerkAuthentication> {
    const header = request.headers.authorization;
    if (typeof header !== 'string' || !header.startsWith('Bearer '))
      return Promise.resolve({ isAuthenticated: false });
    const entry = this.credentials.get(header.slice(7));
    const at = this.now();
    if (
      !entry ||
      !Number.isFinite(at) ||
      entry.revoked ||
      at < entry.notBeforeMs ||
      at >= entry.expiresAtMs
    ) {
      return Promise.resolve({ isAuthenticated: false });
    }
    if (entry.unavailable) return Promise.reject(new ClerkProviderUnavailableError());
    return Promise.resolve<ClerkAuthentication>({
      isAuthenticated: true,
      userId: entry.userId,
      sessionId: entry.sessionId,
      sessionStatus: entry.sessionStatus,
      role: entry.role,
      azp: entry.azp,
      factorVerificationAge:
        entry.factorVerificationAge === null ? null : [...entry.factorVerificationAge],
    });
  }

  revoke(reference: FixtureCredentialReference): void {
    const token = this.tokensByReference.get(reference);
    const entry = token === undefined ? undefined : this.credentials.get(token);
    if (!entry) this.invalidConfiguration();
    entry.revoked = true;
  }

  readonly getIdentityUser: ClerkClientService['getIdentityUser'] = () => this.deniedProvider();
  readonly revokeSession: ClerkClientService['revokeSession'] = () => this.deniedProvider();

  snapshot(): { credentialCount: number; forbiddenBoundaryCalls: number } {
    return {
      credentialCount: this.credentials.size,
      forbiddenBoundaryCalls: this.forbiddenBoundaryCalls,
    };
  }

  private deniedProvider(): Promise<never> {
    this.forbiddenBoundaryCalls = Math.min(
      this.forbiddenBoundaryCalls + 1,
      Number.MAX_SAFE_INTEGER,
    );
    return Promise.reject(new Error('QA_PROVIDER_BOUNDARY_DENIED'));
  }

  private invalidConfiguration(): never {
    throw new Error('QA_CREDENTIAL_CONFIGURATION_INVALID');
  }
}
