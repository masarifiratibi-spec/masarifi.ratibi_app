import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const pngs = fs.readdirSync(root, { recursive: true })
  .filter((file) => file.endsWith('.png'));
const arabic = pngs.filter((file) => file.endsWith('-ar.png'));
const missing = arabic.filter((file) => !pngs.includes(file.replace(/-ar\.png$/, '-en.png')));

if (missing.length) throw new Error(`Missing English counterparts:\n${missing.join('\n')}`);
if (arabic.length < 100) throw new Error(`Expected the complete Arabic set, found ${arabic.length}`);

const generator = fs.readFileSync(path.join(root, 'generate-final-visual-mockups.mjs'), 'utf8');
if (!generator.includes("transform:${rtl ? 'scaleX(-1)' : 'none'}")) {
  throw new Error('Back arrow must point right in RTL and left in LTR.');
}

console.log(`PASS: ${arabic.length} Arabic mockups have matching English LTR mockups.`);
