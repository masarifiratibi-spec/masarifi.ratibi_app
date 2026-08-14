import ar from './messages/ar';
import en from './messages/en';

it('keeps financial planning localization keys in Arabic and English', () => {
  const planningKeys = Object.keys(en).filter((key) =>
    key.startsWith('planning.')
  );
  expect(planningKeys.length).toBeGreaterThan(20);
  for (const key of planningKeys) {
    expect(ar[key as keyof typeof ar]).toEqual(expect.any(String));
  }
});
