import assert from 'node:assert/strict';

import {
  toMarkdownRow,
  validateValidationCase
} from './record-frontend-quality-validation.mjs';

const now = Date.UTC(2026, 7, 13);

const base = {
  id: 'V010-AUTO',
  requirements: ['FR-055'],
  kind: 'automated',
  environment: 'Local Jest',
  procedure: 'npm test',
  expected: 'exit 0',
  actual: 'exit 0',
  status: 'pass',
  evidencePaths: ['specs\\010-frontend-quality\\evidence\\visual\\matrix.md'],
  executedAt: now
};

assert.match(toMarkdownRow(base), /^\| V010-AUTO \| FR-055 \| automated \| 2026-08-13 \|/);
assert.equal(validateValidationCase({ ...base, status: 'fail' }).status, 'fail');
assert.equal(validateValidationCase({ ...base, status: 'blocked', blockedBy: 'USB phone', executedAt: undefined }).status, 'blocked');
assert.throws(() => validateValidationCase({ ...base, environment: '' }), /missing environment/);
assert.throws(() => validateValidationCase({ ...base, amountMinor: 1 }), /invalid field/);
assert.throws(() => validateValidationCase({ ...base, evidencePaths: ['C:\\raw.log'] }), /workspace-relative/);
assert.throws(
  () => validateValidationCase({ ...base, status: 'blocked', blockedBy: 'USB', exception: { id: 'EX-1', expiresAt: now - 1 } }, now),
  /expired exception/
);

console.log('record frontend quality validation tests passed');
