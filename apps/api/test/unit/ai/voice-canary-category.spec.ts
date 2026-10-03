import { createRequire } from 'node:module';
import { resolve } from 'node:path';

type Reference = { alias: string; id: string; kind: string; data: Record<string, unknown> };
const { inspectCategory } = createRequire(__filename)(
  resolve(process.cwd(), '../../scripts/voice-category-acceptance.cjs'),
) as {
  inspectCategory: (value: unknown, references: Reference[]) => Record<string, boolean>;
};
const id = '99000000-0000-4000-8000-000000000009';
const references = [
  { alias: 'CATEGORY-1', id, kind: 'category', data: { kind: 'expense', labelEn: 'Groceries' } },
  {
    alias: 'CATEGORY-2',
    id: 'other',
    kind: 'category',
    data: { kind: 'expense', labelEn: 'Transport' },
  },
  {
    alias: 'ACCOUNT-1',
    id: 'account',
    kind: 'account',
    data: { kind: 'expense', labelEn: 'Groceries' },
  },
];
describe('content-free canary category acceptance', () => {
  it.each(['CATEGORY-1', id])(
    'accepts the correct supplied category as %s using production alias-or-ID semantics',
    (value) => {
      expect(inspectCategory(value, references)).toMatchObject({ categoryCorrect: true });
    },
  );
  it.each([null, '', 'CATEGORY-999', 'ACCOUNT-1', 'account', 'foreign', 'CATEGORY-2'])(
    'fails closed for %s',
    (value) => {
      expect(inspectCategory(value, references).categoryCorrect).toBe(false);
    },
  );
  it('rejects stale/missing references and reports only booleans without identifiers or labels', () => {
    expect(inspectCategory('CATEGORY-1', []).categoryCorrect).toBe(false);
    const result = inspectCategory(id, references);
    expect(Object.values(result).every((value) => typeof value === 'boolean')).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/99000000|Groceries|CATEGORY-1/);
  });
});
