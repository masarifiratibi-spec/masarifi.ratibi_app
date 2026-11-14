import type { PlatformConfigService } from '../../../src/platform/config/platform-config.service';
import {
  ClerkClientService,
  ClerkProviderUnavailableError,
} from '../../../src/identity/clerk-client.service';

const revokeSession = jest.fn();
const getUser = jest.fn();
const deleteUser = jest.fn();
const getUserList = jest.fn();
const getSessionList = jest.fn();

jest.mock('@clerk/backend', () => ({
  createClerkClient: () => ({
    sessions: { revokeSession, getSessionList },
    users: { getUser, getUserList, deleteUser },
  }),
}));

const config = {
  get: (key: string) =>
    ({
      MASARIFI_CLERK_API_TIMEOUT_MS: 500,
      CLERK_PUBLISHABLE_KEY: ['pk', 'test', 'clientfixture'].join('_'),
      CLERK_INSTANCE_DOMAIN: 'example.clerk.accounts.dev',
      CLERK_AUTHORIZED_PARTIES: ['https://admin.example.test'],
    })[key],
  getRequired: () => ['sk', 'test', 'clientfixture'].join('_'),
} as unknown as PlatformConfigService;

describe('Clerk Admin client adapter', () => {
  it('lists only target-bound sessions and exposes no provider object', async () => {
    const adapter = new ClerkClientService(config) as ClerkClientService & {
      listCustomerSessions(userId: string): Promise<unknown[]>;
    };
    getSessionList.mockResolvedValueOnce({
      totalCount: 1,
      data: [
        {
          id: 'sess_private',
          userId: 'user_target',
          status: 'active',
          createdAt: 1000,
          lastActiveAt: 2000,
          expireAt: 3000,
          clientId: 'private_client',
        },
      ],
    });
    await expect(adapter.listCustomerSessions('user_target')).resolves.toEqual([
      {
        id: 'sess_private',
        createdAt: new Date(1000),
        lastActiveAt: new Date(2000),
        expiresAt: new Date(3000),
      },
    ]);
    getSessionList.mockResolvedValueOnce({
      totalCount: 1,
      data: [
        {
          id: 'sess_other',
          userId: 'user_other',
          status: 'active',
          createdAt: 1000,
          lastActiveAt: 2000,
          expireAt: 3000,
        },
      ],
    });
    await expect(adapter.listCustomerSessions('user_target')).rejects.toBeInstanceOf(
      ClerkProviderUnavailableError,
    );
  });
  it('deletes external identity with repeatable confirmed-absence semantics and no false success on provider failure', async () => {
    const adapter = new ClerkClientService(config) as ClerkClientService & {
      deleteIdentityUser(owner: string): Promise<'deleted' | 'not_found'>;
    };
    deleteUser
      .mockResolvedValueOnce({ id: 'user_fixture_a' })
      .mockRejectedValueOnce({ status: 404 })
      .mockRejectedValueOnce({ status: 503 });
    await expect(adapter.deleteIdentityUser('user_fixture_a')).resolves.toBe('deleted');
    await expect(adapter.deleteIdentityUser('user_fixture_a')).resolves.toBe('not_found');
    await expect(adapter.deleteIdentityUser('user_fixture_a')).rejects.toBeInstanceOf(
      ClerkProviderUnavailableError,
    );
  });
  let service: ClerkClientService;

  beforeEach(() => {
    service = new ClerkClientService(config);
  });

  it('maps revoke success and provider not-found to repeatable outcomes', async () => {
    revokeSession.mockResolvedValueOnce({}).mockRejectedValueOnce({ status: 404 });
    await expect(service.revokeSession('session_fixture_a')).resolves.toBe('revoked');
    await expect(service.revokeSession('session_fixture_a')).resolves.toBe('not_found');
  });

  it('returns only normalized current identity fields', async () => {
    getUser.mockResolvedValue({
      id: 'user_fixture_a',
      primaryEmailAddressId: 'email_a',
      primaryPhoneNumberId: 'phone_a',
      emailAddresses: [
        {
          id: 'email_a',
          emailAddress: ' OWNER@EXAMPLE.TEST ',
          verification: { status: 'verified' },
        },
      ],
      phoneNumbers: [{ id: 'phone_a', phoneNumber: '+966500000012' }],
      firstName: ' First ',
      lastName: ' Last ',
      banned: false,
      locked: false,
    });
    await expect(service.getIdentityUser('user_fixture_a')).resolves.toEqual({
      id: 'user_fixture_a',
      primaryEmail: 'owner@example.test',
      primaryEmailVerified: true,
      primaryPhone: '+966500000012',
      displayName: 'First Last',
      banned: false,
      locked: false,
    });
  });

  it('distinguishes confirmed absence from provider failure', async () => {
    getUser
      .mockRejectedValueOnce({ status: 404 })
      .mockRejectedValueOnce(new Error('private provider detail'));
    await expect(service.getIdentityUser('user_fixture_a')).resolves.toBeNull();
    await expect(service.getIdentityUser('user_fixture_a')).rejects.toBeInstanceOf(
      ClerkProviderUnavailableError,
    );
  });

  it('returns a bounded resumable provider page', async () => {
    getUserList.mockResolvedValue({
      data: [
        {
          id: 'user_fixture_a',
          primaryEmailAddressId: null,
          primaryPhoneNumberId: null,
          emailAddresses: [],
          phoneNumbers: [],
          firstName: null,
          lastName: null,
          banned: false,
          locked: false,
        },
      ],
      totalCount: 3,
    });
    await expect(service.listIdentityUsers(0, 1)).resolves.toEqual({
      users: [
        {
          id: 'user_fixture_a',
          primaryEmail: null,
          primaryEmailVerified: false,
          primaryPhone: null,
          displayName: null,
          banned: false,
          locked: false,
        },
      ],
      nextOffset: 1,
    });
    expect(getUserList).toHaveBeenCalledWith({ offset: 0, limit: 1, orderBy: '+created_at' });
  });

  it('uses Clerk active sessions as the authoritative session count', async () => {
    getSessionList.mockResolvedValue({ data: [{ id: 'session_1' }], totalCount: 2 });
    await expect(service.countActiveSessions('user_fixture_a')).resolves.toBe(2);
    expect(getSessionList).toHaveBeenCalledWith({
      userId: 'user_fixture_a',
      status: 'active',
      limit: 1,
    });
  });
});
