import { normalizeTrackingInstallationConsent } from '../../../src/tracking/tracking.dto';

const device = 'aaaaaaaa-1111-4111-8111-111111111111';
const at = '2026-11-04T16:00:00.000Z';
const request = () => ({
  expectedVersion: 0,
  deviceRegistration: {
    deviceFingerprint: 'synthetic-android-fingerprint',
    platform: 'android',
    appVersion: '1.0.0',
  },
  sources: {
    smsEnabled: true,
    notificationEnabled: false,
    smsActivatedAt: at,
    smsActivationId: '42',
    notificationActivatedAt: null,
  },
});

describe('explicit production Tracking consent input', () => {
  it('accepts initial explicit source approval and preserves the observed SMS boundary', () => {
    expect(normalizeTrackingInstallationConsent(device.toUpperCase(), request())).toEqual({
      deviceId: device,
      ...request(),
    });
  });
  it('accepts explicit disable without inheriting old activation boundaries', () => {
    const input = {
      ...request(),
      expectedVersion: 7,
      sources: { smsEnabled: false, notificationEnabled: false },
    };
    expect(normalizeTrackingInstallationConsent(device, input)).toMatchObject({
      expectedVersion: 7,
      sources: {
        smsEnabled: false,
        notificationEnabled: false,
        smsActivatedAt: null,
        smsActivationId: null,
        notificationActivatedAt: null,
      },
    });
  });
  it.each([-1, 1.5, Number.MAX_SAFE_INTEGER, '0', null])(
    'rejects invalid optimistic version %p',
    (expectedVersion) => {
      expect(() =>
        normalizeTrackingInstallationConsent(device, { ...request(), expectedVersion }),
      ).toThrow('VALIDATION_FAILED');
    },
  );
  it.each(['ownerId', 'userId', 'sessionId', 'generation', 'enabled'])(
    'rejects caller authority field %s',
    (key) => {
      expect(() =>
        normalizeTrackingInstallationConsent(device, { ...request(), [key]: 'caller-value' }),
      ).toThrow('VALIDATION_FAILED');
    },
  );
  it.each(['../device', '', 'not-a-device'])(
    'rejects an invalid installation selector %p',
    (selector) => {
      expect(() => normalizeTrackingInstallationConsent(selector, request())).toThrow(
        'VALIDATION_FAILED',
      );
    },
  );
  it.each([
    { smsEnabled: true, notificationEnabled: false },
    { smsEnabled: true, notificationEnabled: false, smsActivatedAt: at, smsActivationId: '-1' },
    {
      smsEnabled: true,
      notificationEnabled: false,
      smsActivatedAt: at,
      smsActivationId: '9223372036854775808',
    },
    { smsEnabled: false, notificationEnabled: true },
    {
      smsEnabled: false,
      notificationEnabled: true,
      notificationActivatedAt: '2026-11-04T16:00:00',
    },
    { smsEnabled: false, notificationEnabled: false, smsActivatedAt: at },
    {
      smsEnabled: true,
      notificationEnabled: false,
      smsActivatedAt: at,
      smsActivationId: '42',
      ownerId: 'foreign',
    },
  ])('requires explicit valid consent and activation bounds: %p', (sources) => {
    expect(() => normalizeTrackingInstallationConsent(device, { ...request(), sources })).toThrow(
      'VALIDATION_FAILED',
    );
  });
  it('requires an Android registration and rejects caller registration IDs', () => {
    for (const deviceRegistration of [
      { ...request().deviceRegistration, platform: 'ios' },
      { ...request().deviceRegistration, deviceId: device },
      { ...request().deviceRegistration, appVersion: 'bad version' },
    ])
      expect(() =>
        normalizeTrackingInstallationConsent(device, { ...request(), deviceRegistration }),
      ).toThrow('VALIDATION_FAILED');
  });
});
