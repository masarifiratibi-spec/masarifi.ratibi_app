import { OutboxRepository } from '../../../src/platform/outbox/outbox.repository';

describe('OutboxRepository', () => {
  it('claims through the bounded database function', async () => {
    const database = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    const repository = new OutboxRepository(database as never);

    await repository.claim('worker-1', 50, 30);

    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('private.claim_outbox_batch'),
      ['worker-1', 50, 30],
    );
  });

  it('completes only the current lease owner and clears the lease', async () => {
    const database = {
      query: jest.fn().mockResolvedValue({ rowCount: 1, rows: [{ id: 'event-1' }] }),
    };
    const repository = new OutboxRepository(database as never);

    await expect(repository.complete('event-1', 'worker-1')).resolves.toBe(true);
    expect(database.query).toHaveBeenCalledWith(
      expect.stringMatching(/id = \$1[\s\S]*locked_by = \$2/),
      ['event-1', 'worker-1'],
    );
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('locked_by = null'),
      expect.any(Array),
    );
    expect(database.query).toHaveBeenCalledWith(
      expect.not.stringContaining('payload ='),
      expect.any(Array),
    );
  });

  it('reports a stale completion as false', async () => {
    const database = {
      query: jest.fn().mockResolvedValue({ rowCount: 0, rows: [] }),
    };
    const repository = new OutboxRepository(database as never);

    await expect(repository.complete('event-1', 'stale-worker')).resolves.toBe(false);
  });
});
