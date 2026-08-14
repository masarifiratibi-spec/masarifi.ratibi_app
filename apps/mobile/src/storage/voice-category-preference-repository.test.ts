const mockGetFirst = jest.fn();
const mockRun = jest.fn(async () => undefined);

jest.mock('./database', () => ({
  openDatabase: jest.fn(async () => ({ getFirstAsync: mockGetFirst, runAsync: mockRun }))
}));

// The database mock must be registered before this module is loaded.
// eslint-disable-next-line import/first
import { VoiceCategoryPreferenceRepository } from './voice-category-preference-repository';

beforeEach(() => jest.clearAllMocks());

it('normalizes and upserts only against an active category', async () => {
  mockGetFirst.mockResolvedValueOnce({ status: 'active' }).mockResolvedValueOnce(null);
  const value = await new VoiceCategoryPreferenceRepository().save('  NetFlix  ', 'subscriptions');
  expect(value.merchantKey).toBe('netflix');
  expect(mockRun).toHaveBeenCalledWith(
    expect.stringContaining('ON CONFLICT(merchant_key)'),
    expect.any(String),
    'netflix',
    'NetFlix',
    'subscriptions',
    expect.any(Number),
    expect.any(Number)
  );
});

it('rejects an archived category', async () => {
  mockGetFirst.mockResolvedValueOnce({ status: 'archived' });
  await expect(
    new VoiceCategoryPreferenceRepository().save('Merchant', 'archived')
  ).rejects.toThrow('invalid_category');
});
