import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';

const source = readFileSync(
  new URL('./check-reports-boundaries.mjs', import.meta.url),
  'utf8'
);

assert.match(source, /reports screens may not access SQLite directly/);
assert.match(source, /reports may not import real file\/share\/email\/background providers/);
assert.match(source, /reports may not log sensitive report data/);
assert.match(source, /reports Zustand state stores only transient view context/);

console.log('Reports boundary regression passed.');
