import ar from './messages/ar';
import en from './messages/en';

it('keeps Arabic and English core-finance keys in parity', () => {
  const enKeys = Object.keys(en).filter((key) => key.startsWith('coreFinance.'));
  const arKeys = Object.keys(ar).filter((key) => key.startsWith('coreFinance.'));
  expect(arKeys.sort()).toEqual(enKeys.sort());
  expect(enKeys.length).toBeGreaterThan(50);
});
