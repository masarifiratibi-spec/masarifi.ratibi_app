import { resolvePlatformPath } from './platform-path';

describe('resolvePlatformPath', () => {
  it.each([
    [{ os: 'android', smsAvailable: true }, 'android'],
    [{ os: 'ios', smsAvailable: false }, 'ios'],
    [{ os: 'web', smsAvailable: false }, 'conservative'],
    [{ os: 'android', smsAvailable: false }, 'conservative'],
    [{ os: 'unknown', smsAvailable: true }, 'conservative']
  ] as const)('maps platform %# honestly', (input, expected) => {
    expect(resolvePlatformPath(input)).toBe(expected);
  });

  it('recomputes changed-on-resume results instead of keeping stale paths', () => {
    expect(
      resolvePlatformPath(
        { os: 'android', smsAvailable: false },
        { previousPath: 'android' }
      )
    ).toBe('conservative');
  });
});
