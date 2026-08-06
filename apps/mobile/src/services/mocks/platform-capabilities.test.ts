import {
  buildAndroidCapabilities,
  buildIosCapabilities,
  permissionTransition
} from './platform-capabilities';
import { InvalidTransitionError } from '@/storage/errors';
import type { PermissionStatus } from '@/domain/foundation';

describe('Android capabilities', () => {
  const caps = buildAndroidCapabilities();

  it('exposes SMS tracking as a permission-gated capability', () => {
    const sms = caps
      .listCapabilities('android')
      .find((c) => c.id === 'sms-tracking');
    expect(sms).toBeDefined();
    expect(sms?.availability).toBe('permission_required');
  });

  it('always offers a manual fallback alongside SMS', () => {
    const sms = caps
      .listCapabilities('android')
      .find((c) => c.id === 'sms-tracking');
    expect(sms?.fallbackCapabilityIds.length).toBeGreaterThan(0);
    const fallbacks = sms?.fallbackCapabilityIds ?? [];
    const hasManual = caps
      .listCaptureMethods('android')
      .some((m) => m.kind === 'manual' && m.availability === 'available');
    expect(hasManual).toBe(true);
    expect(fallbacks.length).toBeGreaterThan(0);
  });

  it('never marks SMS permission as blocking', () => {
    const perms = caps.listPermissions('android');
    perms.forEach((p) => expect(p.blocking).toBe(false));
  });
});

describe('iOS capabilities', () => {
  const caps = buildIosCapabilities();

  it('never exposes SMS tracking', () => {
    const sms = caps
      .listCapabilities('ios')
      .find((c) => c.id === 'sms-tracking');
    expect(sms).toBeUndefined();
  });

  it('offers manual and voice capture on iOS', () => {
    const methods = caps.listCaptureMethods('ios');
    expect(methods.some((m) => m.kind === 'manual')).toBe(true);
    expect(methods.some((m) => m.kind === 'voice')).toBe(true);
  });

  it('does not include automatic SMS as a capture method', () => {
    const methods = caps.listCaptureMethods('ios');
    const smsAutomatic = methods.find(
      (m) => m.kind === 'automatic' && m.permissionId === 'sms'
    );
    expect(smsAutomatic).toBeUndefined();
  });
});

describe('permissionTransition', () => {
  it.each<[PermissionStatus, PermissionStatus]>([
    ['not_requested', 'granted'],
    ['not_requested', 'denied'],
    ['denied', 'granted'],
    ['denied', 'permanently_denied'],
    ['granted', 'revoked'],
    ['revoked', 'granted']
  ])('permits %s -> %s', (from, to) => {
    expect(() => permissionTransition(from, to)).not.toThrow();
  });

  it.each<[PermissionStatus, PermissionStatus]>([
    ['permanently_denied', 'granted'],
    ['granted', 'denied'],
    ['unavailable', 'granted']
  ])('rejects invalid %s -> %s', (from, to) => {
    expect(() => permissionTransition(from, to)).toThrow(
      InvalidTransitionError
    );
  });
});
