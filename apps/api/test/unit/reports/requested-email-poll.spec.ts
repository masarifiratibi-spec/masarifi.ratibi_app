import { EventEmitter } from 'node:events';
import { Client } from 'pg';
import { RequestedEmailPoll } from '../../../src/reports/requested-email-poll';

jest.mock('pg', () => ({ Client: jest.fn() }));
const channel = 'masarifi_requested_pdf_email';

function session(ready = true) {
  const client = Object.assign(new EventEmitter(), {
    connect: jest.fn().mockResolvedValue(undefined),
    query: jest.fn().mockResolvedValue({ rows: [{ ready }] }),
    end: jest.fn().mockResolvedValue(undefined),
  });
  jest.mocked(Client).mockImplementationOnce(() => client as unknown as Client);
  return client;
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.resetAllMocks();
  jest.useRealTimers();
});

test('sleeps between safety scans, wakes on commit, and gives a backlog the original cadence', async () => {
  const client = session();
  const run = jest.fn().mockResolvedValue(false);
  const poll = new RequestedEmailPoll('fixture', 500, run, jest.fn());
  poll.start();
  await jest.advanceTimersByTimeAsync(29_999);
  expect(run).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(1);
  expect(run).toHaveBeenCalledTimes(2);
  run.mockResolvedValueOnce(true);
  client.emit('notification', { channel });
  await jest.advanceTimersByTimeAsync(0);
  expect(run).toHaveBeenCalledTimes(3);
  for (let i = 0; i < 5; ++i) client.emit('notification', { channel });
  expect(run).toHaveBeenCalledTimes(3);
  await jest.advanceTimersByTimeAsync(500);
  expect(run).toHaveBeenCalledTimes(4);
  poll.stop();
  client.emit('notification', { channel });
  await jest.advanceTimersByTimeAsync(30_000);
  expect(run).toHaveBeenCalledTimes(4);
  expect(client.end).toHaveBeenCalledTimes(1);
});

test('keeps a wake received in flight and retries a failed pass without waiting for the idle rescan', async () => {
  const client = session();
  let finish!: (found: boolean) => void;
  const run = jest
    .fn()
    .mockReturnValueOnce(
      new Promise<boolean>((res) => {
        finish = res;
      }),
    )
    .mockRejectedValueOnce(Error('transient'))
    .mockResolvedValue(false);
  const errors = jest.fn();
  const poll = new RequestedEmailPoll('fixture', 500, run, errors);
  poll.start();
  await jest.advanceTimersByTimeAsync(0);
  client.emit('notification', { channel });
  await jest.advanceTimersByTimeAsync(1000);
  expect(run).toHaveBeenCalledTimes(1);
  finish(false);
  await jest.advanceTimersByTimeAsync(1000);
  expect(run).toHaveBeenCalledTimes(3);
  expect(errors).toHaveBeenCalledWith('REPORT_EMAIL_POLL_FAILED', expect.any(Error));
  poll.stop();
});

test('uses normal polling with old schema, rechecks after subscribing and survives a disconnect', async () => {
  const old = session(false);
  const connected = session();
  const run = jest.fn().mockResolvedValue(false);
  const poll = new RequestedEmailPoll('fixture', 500, run, jest.fn());
  poll.start();
  await jest.advanceTimersByTimeAsync(9500);
  expect(old.end).toHaveBeenCalledTimes(1);
  expect(run).toHaveBeenCalledTimes(19);
  await jest.advanceTimersByTimeAsync(500);
  expect(connected.query).toHaveBeenCalledWith('LISTEN ' + channel);
  const afterListen = run.mock.calls.length;
  await jest.advanceTimersByTimeAsync(1000);
  expect(run.mock.calls.length).toBeLessThanOrEqual(afterListen + 1);
  connected.emit('error', Error('lost connection'));
  const disconnectedAt = run.mock.calls.length;
  await jest.advanceTimersByTimeAsync(1500);
  expect(run.mock.calls.length).toBe(disconnectedAt + 3);
  poll.stop();
});
