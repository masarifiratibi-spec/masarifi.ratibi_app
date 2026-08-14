import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { checkValidationLedger } from './check-frontend-quality-gates.mjs';

const now = Date.UTC(2026, 7, 13);

assert.equal(checkValidationLedger(writeLedger({ gateStatus: 'pass', required: 'CASE-PASS' }), { now }).ok, true);
assert.match(
  checkValidationLedger(writeLedger({ caseStatus: 'fail', gateStatus: 'fail', required: 'CASE-PASS' }), { now }).failures.join('\n'),
  /failed required case/
);
assert.match(
  checkValidationLedger(writeLedger({ caseStatus: 'blocked', gateStatus: 'blocked', required: 'CASE-PASS' }), { now }).failures.join('\n'),
  /blocked without current exception/
);
assert.equal(
  checkValidationLedger(writeLedger({ caseStatus: 'blocked', gateStatus: 'blocked', required: 'CASE-PASS', exception: `EX-1 expires=${now + 1}` }), { now }).ok,
  true
);
assert.match(checkValidationLedger(writeLedger({ required: 'MISSING' }), { now }).failures.join('\n'), /missing cases MISSING/);
assert.throws(() => checkValidationLedger(writeLedger({ duplicate: true }), { now }), /duplicate case id/);

console.log('frontend quality gate checker tests passed');

function writeLedger({
  caseStatus = 'pass',
  gateStatus = 'pass',
  required = 'CASE-PASS',
  exception = '',
  duplicate = false
} = {}) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'spec010-gates-'));
  const file = path.join(dir, 'validation.md');
  const duplicateRow = duplicate
    ? `| CASE-PASS | FR-055 | automated | 2026-08-13 | local | cmd | ok | ok | pass | terminal |  |  |  |\n`
    : '';
  writeFileSync(file, `# SPEC-010 Validation Ledger

## Validation Cases

| Case ID | Requirements | Kind | Date | Environment / Device | Procedure | Expected | Actual | Status | Evidence | Warnings | Risks | Exception |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CASE-PASS | FR-055 | automated | 2026-08-13 | local | cmd | ok | ok | ${caseStatus} | terminal |  |  |  |
${duplicateRow}
## Delivery Gates

| Gate ID | Required cases | Status | Exception ID | Evidence | Warnings | Risks |
|---|---|---|---|---|---|---|
| architecture | ${required} | ${gateStatus} | ${exception} | terminal |  |  |
`);
  return file;
}
