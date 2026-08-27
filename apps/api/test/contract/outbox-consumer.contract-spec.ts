type OutboxEvent = {
  eventId: string;
  eventType: string;
  payload: Record<string, unknown>;
};

class IdempotentConsumerFixture {
  private readonly processed = new Set<string>();
  readonly effects: string[] = [];

  consume(event: OutboxEvent): 'applied' | 'duplicate' {
    if (this.processed.has(event.eventId)) return 'duplicate';
    this.effects.push(event.eventType);
    this.processed.add(event.eventId);
    return 'applied';
  }
}

describe('outbox consumer contract', () => {
  it('applies one effect and returns a deterministic no-op for duplicate eventId', () => {
    const consumer = new IdempotentConsumerFixture();
    const event = {
      eventId: 'event-1',
      eventType: 'account.changed',
      payload: {},
    };

    expect(consumer.consume(event)).toBe('applied');
    expect(consumer.consume(event)).toBe('duplicate');
    expect(consumer.effects).toEqual(['account.changed']);
  });
});
