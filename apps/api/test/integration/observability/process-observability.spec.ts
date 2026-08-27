import { PlatformLogger } from '../../../src/platform/observability/platform-logger';
import { platformEvent } from '../../../src/platform/observability/platform-events';

describe('process observability', () => {
  it('emits startup/readiness fields and removes sentinel secrets', () => {
    const lines: string[] = [];
    const logger = new PlatformLogger((line) => lines.push(line));
    const event = platformEvent('platform.ready', {
      processKind: 'api',
      version: 'v1',
      state: 'ready',
    });

    logger.info(event.name, {
      processKind: event.processKind,
      version: event.version,
      state: event.state,
      code: 'sentinel-safe-code',
    });
    logger.error('startup.failed', { code: 'DATABASE_URL' });

    expect(lines.join('\n')).toContain('platform.ready');
    expect(lines.join('\n')).not.toContain('postgresql://user:sentinel-secret@host/db');
  });
});
