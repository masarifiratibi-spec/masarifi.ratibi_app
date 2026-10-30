import { FinancialPlanningRepository } from '@/storage/financial-planning-repository';
import { financialPlanningSeed } from '@/test-utils/financial-planning-fixtures';
import { readRecoveryNetwork } from '@/services/platform/read-recovery-network';
import { usePreferenceStore } from '@/state/preferences';
import { registerLiveClerkBridge } from './auth-service';
import { createLiveFinancialPlanningService } from './financial-planning-service';
import {
  available,
  deriveSalaryCycle,
  money
} from '@/domain/financial-planning';
import type { StoredRead } from '@/services/local-read-cache';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn()
}));
jest.mock('@/services/platform/read-recovery-network', () => ({
  readRecoveryNetwork: { available: true, isOnline: jest.fn() }
}));
let mockPlanningReads: StoredRead[] = [];
jest.mock('@/storage/query-read-cache', () => ({
  createQueryReadCache: () => ({ loadPlanning: async () => mockPlanningReads })
}));

const token = jest.fn(async () => 'unit-token');
const probe = jest.mocked(readRecoveryNetwork.isOnline);
const originalSession = {
  id: 'offline-planning-session',
  userId: 'offline-planning-owner',
  method: 'google' as const,
  issuedAt: 1,
  expiresAt: 9_999_999_999_999
};
let session = originalSession;

beforeEach(() => {
  session = originalSession;
  mockPlanningReads = [];
  token.mockClear();
  probe.mockReset().mockResolvedValue(false);
  usePreferenceStore.setState({
    baseCurrencyCode: 'SAR',
    timeZone: 'Asia/Riyadh'
  });
  registerLiveClerkBridge({
    getSession: async () => session,
    getToken: token,
    startPhone: jest.fn(),
    verifyPhone: jest.fn(),
    resendPhone: jest.fn(),
    signInWithGoogle: jest.fn(),
    reverifyConflict: jest.fn(),
    signOut: jest.fn()
  });
});

function offlineService(repository = new FinancialPlanningRepository()) {
  const request = jest.fn(
    async () =>
      new Response(JSON.stringify({ code: 'SERVICE_UNAVAILABLE' }), {
        status: 503
      })
  );
  return {
    service: createLiveFinancialPlanningService({
      repository,
      persistent: false,
      request,
      baseUrl: 'https://inert.invalid',
      now: () => Date.parse('2026-10-30T09:00:00Z')
    }),
    request
  };
}

it('opens an unconfigured salary and unknown obligation totals offline without token or transport', async () => {
  const { service, request } = offlineService();
  await expect(
    service.getSalaryOverview({ today: '2026-10-30', timeZone: 'Asia/Riyadh' })
  ).resolves.toMatchObject({
    profileId: null,
    dataState: 'offline',
    income: { status: 'unavailable' }
  });
  await expect(service.getObligationsOverview({})).resolves.toMatchObject({
    dataState: 'offline',
    items: [],
    payablesByCurrency: { SAR: null },
    receivablesByCurrency: { SAR: null }
  });
  expect(request).not.toHaveBeenCalled();
  expect(token).not.toHaveBeenCalled();
});

it('reads saved salary settings and the recorded opening-paid obligation amount offline', async () => {
  const profile = {
    ...financialPlanningSeed.salaryProfiles![0],
    nextExpectedDate: '2026-11-25' as const
  };
  const obligation = {
    ...financialPlanningSeed.obligations![0],
    id: 'local-obligation',
    direction: 'payable' as const,
    status: 'active' as const,
    currencyCode: 'SAR',
    contractedTotalMinor: 10000,
    openingPaidMinor: 2500
  };
  const { service, request } = offlineService(
    new FinancialPlanningRepository({
      salaryProfiles: [profile],
      obligations: [obligation]
    })
  );
  await expect(service.getSalaryProfile()).resolves.toEqual(profile);
  await expect(
    service.getSalaryOverview({ today: '2026-10-30', timeZone: 'Asia/Riyadh' })
  ).resolves.toMatchObject({ profileId: profile.id, dataState: 'offline' });
  await expect(service.getObligationsOverview({})).resolves.toMatchObject({
    dataState: 'offline',
    items: [obligation],
    payablesByCurrency: { SAR: 7500 },
    remainingByObligationId: { 'local-obligation': 7500 }
  });
  expect(request).not.toHaveBeenCalled();
  expect(token).not.toHaveBeenCalled();
});

it('rejects an owner change during the offline probe instead of exposing saved planning data', async () => {
  probe.mockImplementationOnce(async () => {
    session = {
      ...originalSession,
      id: 'other-session',
      userId: 'other-owner'
    };
    return false;
  });
  const { service } = offlineService(
    new FinancialPlanningRepository(financialPlanningSeed)
  );
  await expect(service.getObligationsOverview({})).rejects.toMatchObject({
    code: 'session_expired'
  });
});

it('does not conceal a live authoritative denial with local planning data', async () => {
  probe.mockResolvedValue(true);
  const service = createLiveFinancialPlanningService({
    repository: new FinancialPlanningRepository(financialPlanningSeed),
    persistent: false,
    baseUrl: 'https://inert.invalid',
    request: jest.fn(
      async () =>
        new Response(JSON.stringify({ code: 'FORBIDDEN' }), { status: 403 })
    )
  });
  await expect(service.getObligationsOverview({})).rejects.toMatchObject({
    code: 'forbidden'
  });
});

it('does not declare the service offline when the native connectivity probe fails', async () => {
  probe.mockRejectedValue(new Error('probe unavailable'));
  const { service, request } = offlineService();
  await expect(
    service.getSalaryOverview({ today: '2026-10-30', timeZone: 'Asia/Riyadh' })
  ).rejects.toMatchObject({ code: 'provider_unavailable' });
  expect(request).toHaveBeenCalled();
});

it('uses the persisted prior-day salary snapshot after reopening in another language and marks it offline', async () => {
  const previous = deriveSalaryCycle({
    profile: financialPlanningSeed.salaryProfiles![0],
    receipts: [],
    transactions: [],
    today: '2026-10-29'
  });
  mockPlanningReads = [
    {
      key: [
        'planning',
        'snapshot',
        originalSession.userId,
        '2026-10-29',
        'Asia/Riyadh'
      ],
      data: {
        salary: {
          ...previous,
          income: available(money(10000, 'SAR')),
          suggestedDaily: available(money(500, 'SAR'))
        }
      },
      updatedAt: Date.parse('2026-10-29T09:00:00Z')
    }
  ];
  usePreferenceStore.setState({ locale: 'en' });
  const repository = new FinancialPlanningRepository();
  jest.spyOn(repository, 'hydrate').mockResolvedValue(undefined);
  const service = createLiveFinancialPlanningService({
    repository,
    persistent: true
  });
  await expect(
    service.getSalaryOverview({ today: '2026-10-30', timeZone: 'Asia/Riyadh' })
  ).resolves.toMatchObject({
    profileId: previous.profileId,
    dataState: 'offline',
    income: {
      value: { minorUnits: 10000 },
      asOf: mockPlanningReads[0].updatedAt
    },
    suggestedDaily: { status: 'unavailable' }
  });
  expect(token).not.toHaveBeenCalled();
});

it('does not revive an older salary snapshot after a persisted authoritative denial', async () => {
  mockPlanningReads = [
    { key: ['planning', 'salary', 'denied'], data: null, updatedAt: Date.now() }
  ];
  const repository = new FinancialPlanningRepository(financialPlanningSeed);
  jest.spyOn(repository, 'hydrate').mockResolvedValue(undefined);
  const service = createLiveFinancialPlanningService({
    repository,
    persistent: true
  });
  await expect(
    service.getSalaryOverview({ today: '2026-10-30', timeZone: 'Asia/Riyadh' })
  ).rejects.toMatchObject({ code: 'forbidden' });
  expect(token).not.toHaveBeenCalled();
});

it('ignores malformed persisted salary data rather than exposing a partially shaped model', async () => {
  mockPlanningReads = [
    {
      key: ['planning', 'salary', '2026-10-29', 'Asia/Riyadh'],
      data: { income: 99 },
      updatedAt: Date.now()
    }
  ];
  const repository = new FinancialPlanningRepository();
  jest.spyOn(repository, 'hydrate').mockResolvedValue(undefined);
  const service = createLiveFinancialPlanningService({
    repository,
    persistent: true
  });
  await expect(
    service.getSalaryOverview({ today: '2026-10-30', timeZone: 'Asia/Riyadh' })
  ).resolves.toMatchObject({ profileId: null, dataState: 'offline' });
});

it('treats an impossible projected salary date as an unusable cached cycle', async () => {
  const cycle = deriveSalaryCycle({
    profile: financialPlanningSeed.salaryProfiles![0],
    receipts: [],
    transactions: [],
    today: '2026-10-29'
  });
  mockPlanningReads = [
    {
      key: ['planning', 'salary', '2026-10-29', 'Asia/Riyadh'],
      data: { ...cycle, projectedNextSalaryDate: '2026-13-25' },
      updatedAt: Date.now()
    }
  ];
  const repository = new FinancialPlanningRepository();
  jest.spyOn(repository, 'hydrate').mockResolvedValue(undefined);
  const service = createLiveFinancialPlanningService({
    repository,
    persistent: true
  });
  await expect(
    service.getSalaryOverview({ today: '2026-10-30', timeZone: 'Asia/Riyadh' })
  ).resolves.toMatchObject({ profileId: null, dataState: 'offline' });
});
