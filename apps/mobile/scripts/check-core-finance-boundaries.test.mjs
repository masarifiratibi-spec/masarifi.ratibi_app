/* eslint-env node */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { URL } from 'node:url';

const source = fs.readFileSync(
  new URL('./check-core-finance-boundaries.mjs', import.meta.url),
  'utf8'
);

assert.match(source, /expo-sqlite/);
assert.match(source, /hard-coded English UI/);
assert.match(source, /production provider import/);

console.log('Core-finance boundary regression passed.');
