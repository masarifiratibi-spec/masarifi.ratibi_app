import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

it('includes every mobile asset copied by the normal backend Dockerfile', () => {
  const root = resolve(__dirname, '../../../../..');
  const dockerfile = readFileSync(resolve(root, 'docker/backend.Dockerfile'), 'utf8');
  const exclusions = readFileSync(resolve(root, '.dockerignore'), 'utf8').split(/\r?\n/);
  const assets: string[] = [];
  for (const match of dockerfile.matchAll(/^COPY(?: --\S+)* (apps\/mobile\/\S+) /gm)) {
    const asset = match[1];
    if (!asset) throw new Error('Dockerfile mobile asset path missing');
    assets.push(asset);
  }
  expect(assets.length).toBeGreaterThan(0);
  for (const asset of assets) {
    expect(existsSync(resolve(root, asset))).toBe(true);
    if (exclusions.includes('apps/mobile/**')) expect(exclusions).toContain('!' + asset);
  }
});
