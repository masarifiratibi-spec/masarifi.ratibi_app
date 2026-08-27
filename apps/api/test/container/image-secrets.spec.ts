import { docker, dockerResult, imageUnderTest, inspectImage, runNode } from './docker-test.utils';

jest.setTimeout(240_000);

function evidence(image: string): string {
  const inspection = JSON.stringify(inspectImage(image));
  const history = docker(['history', '--no-trunc', '--format', '{{json .}}', image]);
  const files = runNode(
    `
    const fs = require('node:fs');
    const path = require('node:path');
    const output = [];
    const visit = (directory) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const target = path.join(directory, entry.name);
        if (entry.isDirectory()) visit(target); else output.push(target);
      }
    };
    visit('/app');
    console.log(JSON.stringify(output));
  `,
    image,
  );
  return `${inspection}\n${history}\n${files}`;
}

describe('production image secret evidence', () => {
  it('contains no build sentinel and detects the same sentinel in a disposable child image', () => {
    const sentinel = 'SPEC_BE_001_SENTINEL_SECRET_DO_NOT_SHIP';
    expect(evidence(imageUnderTest)).not.toContain(sentinel);

    const disposable = 'masarifi-backend:spec-be-001-sentinel';
    try {
      docker(
        ['build', '--quiet', '--tag', disposable, '-'],
        `FROM ${imageUnderTest}\nENV SENTINEL=${sentinel}\n`,
      );
      expect(evidence(disposable)).toContain(sentinel);
    } finally {
      dockerResult(['image', 'rm', '--force', disposable]);
    }
  });
});
