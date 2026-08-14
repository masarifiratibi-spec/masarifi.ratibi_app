import assert from 'node:assert/strict';
import fs from 'node:fs';
import { URL } from 'node:url';

const source = fs.readFileSync(
  new URL('./check-financial-planning-boundaries.mjs', import.meta.url),
  'utf8'
);

assert.match(source, /direct SQLite import outside storage/);
assert.match(source, /feature-local raw color/);
assert.match(source, /unsupported iOS SMS claim/);
assert.match(source, /goal movement can mutate account balances/);

console.log('Financial-planning boundary regression passed.');
