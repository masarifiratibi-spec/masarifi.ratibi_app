import { createRequire } from 'node:module';
import { resolve } from 'node:path';

type Reference = { alias: string; id: string; kind: string; data: Record<string, unknown> };
const { inspectCategory } = createRequire(__filename)(
  resolve(process.cwd(), '../../scripts/voice-category-acceptance.cjs'),
) as {
  inspectCategory: (
    value: unknown,
    references: Reference[],
    expectedCategoryId: string,
  ) => Record<string, boolean>;
};
const id = '04000000-0000-4000-8000-000000000002';
const references = [
  {
    alias: 'CATEGORY-2',
    id,
    kind: 'category',
    data: { kind: 'expense', labelEn: 'Food', labelAr: 'الطعام' },
  },
  {
    alias: 'CATEGORY-6',
    id: '04000000-0000-4000-8000-000000000006',
    kind: 'category',
    data: { kind: 'expense', labelEn: 'Shopping', labelAr: 'التسوق' },
  },
  {
    alias: 'ACCOUNT-1',
    id: 'account',
    kind: 'account',
    data: { kind: 'expense', labelEn: 'Groceries' },
  },
];
describe('content-free canary category acceptance', () => {
  it.each(['CATEGORY-2', id])(
    'accepts the correct supplied category as %s using production alias-or-ID semantics',
    (value) => {
      expect(inspectCategory(value, references, id)).toMatchObject({ categoryCorrect: true });
    },
  );
  it.each([null, '', 'CATEGORY-999', 'ACCOUNT-1', 'account', 'foreign', 'CATEGORY-6'])(
    'fails closed for %s',
    (value) => {
      expect(inspectCategory(value, references, id).categoryCorrect).toBe(false);
    },
  );
  it('rejects stale/missing references and reports only booleans without identifiers or labels', () => {
    expect(inspectCategory('CATEGORY-2', [], id).categoryCorrect).toBe(false);
    const result = inspectCategory(id, references, id);
    expect(Object.values(result).every((value) => typeof value === 'boolean')).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/04000000|Food|CATEGORY-2/);
  });
  it('ignores label translations and alias ordering while retaining identity', () => {
    const renamed = [...references].reverse().map((x) => ({
      ...x,
      alias: x.id === id ? 'CATEGORY-19' : x.alias,
      data: { ...x.data, labelEn: 'renamed', labelAr: 'جديد' },
    }));
    expect(inspectCategory('CATEGORY-19', renamed, id).categoryCorrect).toBe(true);
    expect(inspectCategory(id, renamed, id).categoryCorrect).toBe(true);
  });
  it('rejects duplicated identities, absent expected identity and wrong financial kind', () => {
    expect(
      inspectCategory(id, [...references, ...references.slice(0, 1)], id).categoryCorrect,
    ).toBe(false);
    expect(inspectCategory(id, references, 'foreign').categoryCorrect).toBe(false);
    expect(
      inspectCategory(
        id,
        references.map((x) => ({ ...x, data: { ...x.data, kind: 'income' } })),
        id,
      ).categoryCorrect,
    ).toBe(false);
  });
});
