import { SchemaCompatibilityService } from '../../../src/platform/database/schema-compatibility';

describe('SchemaCompatibilityService', () => {
  it('accepts the minimum runtime schema contract without migration-history access', async () => {
    const database = {
      query: jest.fn().mockResolvedValue({ rows: [{ compatible: true }] }),
    };
    const service = new SchemaCompatibilityService(database as never);

    await expect(service.check()).resolves.toBeUndefined();
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining('resolve_category(text,uuid,text)'),
      [],
      1_000,
    );
  });

  it.each([false, null])('fails closed when the runtime schema contract is %s', async (compatible) => {
    const database = {
      query: jest.fn().mockResolvedValue({ rows: [{ compatible }] }),
    };
    const service = new SchemaCompatibilityService(database as never);

    await expect(service.check()).rejects.toThrow('SCHEMA_INCOMPATIBLE');
  });
});
