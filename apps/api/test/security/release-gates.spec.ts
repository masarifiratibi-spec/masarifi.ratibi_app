const blockingGates = new Set([
  'secret-leak',
  'critical-vulnerability',
  'high-exploitable-vulnerability',
  'missing-sbom',
  'missing-provenance',
  'root-container',
  'writable-root-filesystem',
]);

describe('release gates', () => {
  it.each([...blockingGates])('blocks release for %s', (finding) => {
    expect(blockingGates.has(finding)).toBe(true);
  });
});
