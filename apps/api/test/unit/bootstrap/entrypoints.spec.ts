describe('backend entry points', () => {
  it('exports API, worker, and migration bootstraps', async () => {
    const [api, worker, migration] = await Promise.all([
      import('../../../src/main'),
      import('../../../src/worker'),
      import('../../../src/migration'),
    ]);

    expect(api.bootstrapApi).toBeInstanceOf(Function);
    expect(worker.bootstrapWorker).toBeInstanceOf(Function);
    expect(migration.runMigrations).toBeInstanceOf(Function);
  });
});
