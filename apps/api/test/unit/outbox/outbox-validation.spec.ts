import { validateOutboxInput } from '../../../src/platform/outbox/outbox-validation';

describe('validateOutboxInput', () => {
  it('accepts bounded event data', () => {
    expect(() => {
      validateOutboxInput('account.changed', 'account', {});
    }).not.toThrow();
  });

  it.each([
    ['', 'account', {}, 'OUTBOX_EVENT_TYPE_INVALID'],
    ['bad', 'account', {}, 'OUTBOX_EVENT_TYPE_INVALID'],
    ['account.changed', '', {}, 'OUTBOX_AGGREGATE_TYPE_INVALID'],
    ['account.changed', 'A'.repeat(65), {}, 'OUTBOX_AGGREGATE_TYPE_INVALID'],
    ['account.changed', 'account', [], 'OUTBOX_PAYLOAD_INVALID'],
    ['account.changed', 'account', { token: 'secret' }, 'OUTBOX_PAYLOAD_SENSITIVE'],
    ['account.changed', 'account', { nested: { password: 'secret' } }, 'OUTBOX_PAYLOAD_SENSITIVE'],
  ])('rejects invalid data', (eventType, aggregateType, payload, code) => {
    expect(() => {
      validateOutboxInput(eventType, aggregateType, payload);
    }).toThrow(code);
  });

  it('enforces the 64 KiB serialized payload ceiling', () => {
    const exact = { value: 'x'.repeat(65_524) };
    expect(Buffer.byteLength(JSON.stringify(exact))).toBe(65_536);
    expect(() => {
      validateOutboxInput('account.changed', 'account', exact);
    }).not.toThrow();

    expect(() => {
      validateOutboxInput('account.changed', 'account', {
        value: `${exact.value}x`,
      });
    }).toThrow('OUTBOX_PAYLOAD_INVALID');
  });

  it('accepts exact aggregate and event name boundaries and rejects the first overflow', () => {
    expect(() => {
      validateOutboxInput(`a.${'a'.repeat(126)}`, 'a', {});
      validateOutboxInput('account.changed', 'a'.repeat(64), {});
    }).not.toThrow();

    expect(() => {
      validateOutboxInput(`a.${'a'.repeat(127)}`, 'a', {});
    }).toThrow('OUTBOX_EVENT_TYPE_INVALID');
    expect(() => {
      validateOutboxInput('account.changed', 'a'.repeat(65), {});
    }).toThrow('OUTBOX_AGGREGATE_TYPE_INVALID');
  });
});
