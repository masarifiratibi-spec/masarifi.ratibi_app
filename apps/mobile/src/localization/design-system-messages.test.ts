import ar from './messages/ar';
import en from './messages/en';

describe('design-system message namespace', () => {
  it('keeps Arabic and English design-system keys in parity', () => {
    const enKeys = designSystemKeys(en);
    const arKeys = designSystemKeys(ar);

    expect(arKeys).toEqual(enKeys);
    expect(enKeys.length).toBeGreaterThanOrEqual(30);
  });

  it('does not contain empty design-system messages', () => {
    for (const catalog of [ar, en]) {
      for (const key of designSystemKeys(catalog)) {
        expect((catalog as Record<string, string>)[key].trim()).not.toBe('');
      }
    }
  });
});

function designSystemKeys(catalog: Record<string, string>) {
  return Object.keys(catalog)
    .filter((key) => key.startsWith('designSystem.'))
    .sort();
}
