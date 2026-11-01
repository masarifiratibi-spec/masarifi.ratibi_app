import {
  readTransactionDraftSnapshot,
  withTransactionDraftWrite
} from './transaction-draft-snapshots';
import {
  resetRuntimeIdentityData,
  resetRuntimeUserData
} from './runtime-user-data-reset';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const owner = {
  userId: 'snapshot-owner',
  assertCurrent: async () => undefined
};
beforeEach(async () => {
  await resetRuntimeIdentityData();
});

it('does not return an entry invalidated while its actor check is pending', async () => {
  const entered = deferred(),
    resume = deferred();
  const read = jest.fn(async () => null);
  await readTransactionDraftSnapshot(
    {
      ...owner,
      assertCurrent: async () => {
        entered.resolve();
        await resume.promise;
      }
    },
    'manual',
    read
  );
  const pending = readTransactionDraftSnapshot(owner, 'manual', read);
  await entered.promise;
  await withTransactionDraftWrite(async () => undefined);
  resume.resolve();
  await pending;
  expect(read).toHaveBeenCalledTimes(2);
});

it('does not retain a durable read completed after an intervening write', async () => {
  const entered = deferred(),
    resume = deferred();
  const pending = readTransactionDraftSnapshot(owner, 'manual', async () => {
    entered.resolve();
    await resume.promise;
    return null;
  });
  await entered.promise;
  await withTransactionDraftWrite(async () => undefined);
  resume.resolve();
  await pending;
  const next = jest.fn(async () => null);
  await readTransactionDraftSnapshot(owner, 'manual', next);
  expect(next).toHaveBeenCalledTimes(1);
});

it('does not cache reads during overlapping producers even when a reset occurs', async () => {
  const first = deferred(),
    second = deferred();
  const writes = [
    withTransactionDraftWrite(async () => first.promise),
    withTransactionDraftWrite(async () => second.promise)
  ];
  await resetRuntimeUserData();
  const read = jest.fn(async () => null);
  await readTransactionDraftSnapshot(owner, 'manual', read);
  await readTransactionDraftSnapshot(owner, 'manual', read);
  first.resolve();
  await writes[0];
  await readTransactionDraftSnapshot(owner, 'manual', read);
  await readTransactionDraftSnapshot(owner, 'manual', read);
  expect(read).toHaveBeenCalledTimes(4);
  second.resolve();
  await writes[1];
  await readTransactionDraftSnapshot(owner, 'manual', read);
  await readTransactionDraftSnapshot(owner, 'manual', read);
  expect(read).toHaveBeenCalledTimes(5);
});

it('rejects an invalid current actor even when the durable snapshot is cached', async () => {
  await readTransactionDraftSnapshot(owner, 'manual', async () => null);
  const read = jest.fn(async () => null);
  await expect(
    readTransactionDraftSnapshot(
      {
        ...owner,
        assertCurrent: async () => {
          throw new Error('new session expired');
        }
      },
      'manual',
      read
    )
  ).rejects.toThrow('new session expired');
  expect(read).not.toHaveBeenCalled();
});

it('bounds snapshots so old draft IDs are evicted', async () => {
  const read = jest.fn(async () => null);
  for (let index = 0; index < 33; index++)
    await readTransactionDraftSnapshot(owner, `manual-${index}`, read);
  await readTransactionDraftSnapshot(owner, 'manual-0', read);
  expect(read).toHaveBeenCalledTimes(34);
});
