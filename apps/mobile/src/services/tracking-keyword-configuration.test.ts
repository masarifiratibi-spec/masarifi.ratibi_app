import { trackingKeywordConfiguration } from './tracking-keyword-configuration';
import { automaticTrackingService } from './automatic-tracking-service';
import { useAppShellStore } from '@/state/app-shell';
jest.mock('./automatic-tracking-service', () => ({
  automaticTrackingService: {
    listKeywordRules: jest.fn(),
    saveKeywordRules: jest.fn(),
    restoreDefaultKeywords: jest.fn()
  }
}));
const rule = {
  id: 'server-id',
  group: 'financial' as const,
  language: 'ar' as const,
  value: 'دفع',
  normalizedValue: 'دفع',
  origin: 'custom' as const,
  enabled: true
};
beforeEach(() => {
  jest.clearAllMocks();
  useAppShellStore.setState({
    session: {
      status: 'authenticated',
      userId: 'owner',
      method: 'google',
      issuedAt: 1,
      expiresAt: 2,
      restoration: 'restored'
    }
  });
});
it('presents canonical persisted server identities after saving temporary editor rows', async () => {
  jest.mocked(automaticTrackingService.saveKeywordRules).mockResolvedValue({
    value: [{ ...rule, recentUseCount: 0, lastUsedAt: null }],
    affectedScopes: ['tracking.keywords']
  });
  const onPersist = jest.fn();
  const result = await trackingKeywordConfiguration.save(
    [{ ...rule, id: 'temporary' }],
    onPersist
  );
  expect(result[0]?.id).toBe('server-id');
  expect(onPersist).toHaveBeenCalledWith(result);
});
it('rejects a stale owner before installing effective capture rules', async () => {
  jest
    .mocked(automaticTrackingService.saveKeywordRules)
    .mockImplementation(async () => {
      useAppShellStore.setState({
        session: {
          status: 'authenticated',
          userId: 'another',
          method: 'google',
          issuedAt: 1,
          expiresAt: 2,
          restoration: 'restored'
        }
      });
      return { value: [], affectedScopes: [] };
    });
  const onPersist = jest.fn();
  await expect(
    trackingKeywordConfiguration.save([rule], onPersist)
  ).rejects.toThrow('tracking_owner_changed');
  expect(onPersist).not.toHaveBeenCalled();
});
