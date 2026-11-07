import { defaultCategorySeeds } from '../../../../mobile/src/domain/default-categories';

import { supportedCurrencies } from '../../../../mobile/src/domain/currencies';

describe('Phase 04 client mapping', () => {
  it('pins executable Mobile reference keys without importing fixtures into production', () => {
    expect(supportedCurrencies.map(({ code }) => code)).toEqual([
      'SAR',
      'AED',
      'KWD',
      'QAR',
      'BHD',
      'OMR',
      'EGP',
      'USD',
      'EUR',
      'GBP',
      'JOD',
      'JPY',
    ]);
    const keys = defaultCategorySeeds.map(([key]) => key);
    expect(keys).toHaveLength(19);
    expect(keys).toContain('salary');
  });
});
