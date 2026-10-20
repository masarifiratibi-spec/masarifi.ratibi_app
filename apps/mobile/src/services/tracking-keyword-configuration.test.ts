import { trackingKeywordConfiguration } from './tracking-keyword-configuration';
import { automaticTrackingService } from './automatic-tracking-service';
import { useAppShellStore } from '@/state/app-shell';
import { TrackingError } from './contracts/automatic-tracking-service';
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
    [],
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
    trackingKeywordConfiguration.save([rule], [], onPersist)
  ).rejects.toThrow('tracking_owner_changed');
  expect(onPersist).not.toHaveBeenCalled();
});

it('reloads the authoritative keyword list after a conflict so the editor can retry safely', async () => {
  const current = [
    { ...rule, value: 'إيداع', recentUseCount: 0, lastUsedAt: null }
  ];
  jest
    .mocked(automaticTrackingService.saveKeywordRules)
    .mockRejectedValue(new TrackingError('conflict'));
  jest
    .mocked(automaticTrackingService.listKeywordRules)
    .mockResolvedValue(current);
  const onPersist = jest.fn();
  await expect(
    trackingKeywordConfiguration.save(
      [{ ...rule, enabled: false }],
      [rule],
      onPersist
    )
  ).rejects.toMatchObject({ code: 'conflict' });
  expect(onPersist).toHaveBeenCalledWith(current);
});

it.each(['before_reload', 'during_reload'])(
  'fences an owner change %s while recovering a keyword conflict',
  async (stage) => {
    const switchOwner = () =>
      useAppShellStore.setState({
        session: { ...useAppShellStore.getState().session!, userId: 'another' }
      });
    jest
      .mocked(automaticTrackingService.saveKeywordRules)
      .mockImplementation(async () => {
        if (stage === 'before_reload') switchOwner();
        throw new TrackingError('conflict');
      });
    jest
      .mocked(automaticTrackingService.listKeywordRules)
      .mockImplementation(async () => {
        switchOwner();
        return [{ ...rule, recentUseCount: 0, lastUsedAt: null }];
      });
    const onPersist = jest.fn();
    await expect(
      trackingKeywordConfiguration.save([rule], [rule], onPersist)
    ).rejects.toThrow('tracking_owner_changed');
    expect(onPersist).not.toHaveBeenCalled();
    if (stage === 'before_reload')
      expect(automaticTrackingService.listKeywordRules).not.toHaveBeenCalled();
  }
);
