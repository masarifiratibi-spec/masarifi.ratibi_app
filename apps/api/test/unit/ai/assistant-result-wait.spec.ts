import { AiService } from '../../../src/ai/ai.service';
import { assistantResultWait } from '../../../src/ai/ai.dto';
import { AiController } from '../../../src/ai/ai.controller';
import { EventEmitter } from 'node:events';

const owner = { userId: 'owner', sessionId: 'session', factorAgeSeconds: 0 };
const conversationId = '99000000-0000-4000-8000-000000000001';
const messageId = '99000000-0000-4000-8000-000000000002';
const responseId = '99000000-0000-4000-8000-000000000003';
const request = { id: messageId, conversationId, role: 'user' };
const response = {
  id: responseId,
  conversationId,
  replyToMessageId: messageId,
  role: 'assistant',
  contentRedacted: 'The grounded answer',
};

function fixture() {
  const repository = {
    getMessage: jest.fn((_owner: unknown, id: string) =>
      Promise.resolve(id === messageId ? request : response),
    ),
    messageResult: jest.fn(() => Promise.resolve({ id: messageId, status: 'processing' })),
    cancelMessage: jest.fn(),
  };
  const service = new AiService(
    repository as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  const read = (query: unknown = {}, signal = new AbortController().signal) =>
    service.getMessageResult(owner, conversationId, messageId, { query, signal });
  return { repository, read, service };
}

afterEach(() => jest.useRealTimers());

it('delivers completion in the original bounded result request instead of a second phone round trip', async () => {
  jest.useFakeTimers();
  const { repository, read } = fixture();
  const started = Date.now();
  repository.messageResult.mockImplementation(() =>
    Promise.resolve(
      Date.now() - started >= 700
        ? { id: messageId, status: 'completed', response: { id: responseId } }
        : { id: messageId, status: 'processing' },
    ),
  );
  const result = read({ waitMs: '8000' });
  await jest.advanceTimersByTimeAsync(750);
  await expect(result).resolves.toMatchObject({
    status: 'completed',
    request: { id: messageId },
    response: { id: responseId, content: 'The grounded answer' },
  });
  expect(repository.cancelMessage).not.toHaveBeenCalled();
});

it('keeps a legacy read immediate and never cancels the queued question', async () => {
  const { repository, read } = fixture();
  await expect(read()).resolves.toMatchObject({ status: 'processing', response: null });
  expect(repository.messageResult).toHaveBeenCalledTimes(1);
  expect(repository.cancelMessage).not.toHaveBeenCalled();
});

it('ends at the server wait bound with the original pending identity intact', async () => {
  jest.useFakeTimers();
  const { repository, read } = fixture();
  const result = read({ waitMs: '8000' });
  await jest.advanceTimersByTimeAsync(8000);
  await expect(result).resolves.toMatchObject({ id: messageId, status: 'processing' });
  expect(repository.messageResult).toHaveBeenCalledTimes(33);
  expect(repository.cancelMessage).not.toHaveBeenCalled();
});

it('stops waiting on disconnect without cancelling or replaying the durable question', async () => {
  jest.useFakeTimers();
  const { repository, read } = fixture();
  const controller = new AbortController();
  const result = read({ waitMs: '8000' }, controller.signal);
  await jest.advanceTimersByTimeAsync(400);
  controller.abort();
  await expect(result).resolves.toMatchObject({ status: 'processing' });
  const reads = repository.messageResult.mock.calls.length;
  await jest.advanceTimersByTimeAsync(8000);
  expect(repository.messageResult).toHaveBeenCalledTimes(reads);
  expect(repository.cancelMessage).not.toHaveBeenCalled();
});

it('rechecks the conversation after waiting and rejects deletion before publishing a completed answer', async () => {
  jest.useFakeTimers();
  const { repository, read } = fixture();
  repository.getMessage.mockResolvedValueOnce(request).mockRejectedValueOnce({ status: 404 });
  repository.messageResult
    .mockResolvedValueOnce({ id: messageId, status: 'processing' })
    .mockResolvedValueOnce({ id: messageId, status: 'completed' });
  const outcome = read({ waitMs: '8000' }).catch((error: unknown) => error);
  await jest.advanceTimersByTimeAsync(250);
  expect(await outcome).toMatchObject({ status: 404 });
  expect(repository.getMessage).toHaveBeenCalledTimes(2);
});

it('rejects an ownership denial that appears while the worker is running', async () => {
  jest.useFakeTimers();
  const { repository, read } = fixture();
  repository.messageResult
    .mockResolvedValueOnce({ id: messageId, status: 'processing' })
    .mockRejectedValueOnce({ status: 403 });
  const outcome = read({ waitMs: '8000' }).catch((error: unknown) => error);
  await jest.advanceTimersByTimeAsync(250);
  expect(await outcome).toMatchObject({ status: 403 });
  expect(repository.cancelMessage).not.toHaveBeenCalled();
});

it.each(['-1', '8001', '100000', '1.5', 'NaN', ' 250', ['250'], 250, null])(
  'rejects an invalid wait query %j before reading private data',
  async (waitMs) => {
    const { repository, read } = fixture();
    await expect(read({ waitMs })).rejects.toMatchObject({ status: 422 });
    expect(repository.getMessage).not.toHaveBeenCalled();
  },
);

it('keeps the wait opt-in exact and accepts the two bounds', () => {
  expect(assistantResultWait({})).toBe(0);
  expect(assistantResultWait({ waitMs: '0' })).toBe(0);
  expect(assistantResultWait({ waitMs: '8000' })).toBe(8000);
  expect(() => assistantResultWait({ waitMs: '250', other: 'value' })).toThrow();
});

it('wires HTTP disconnect to the bounded read and removes its listener after completion', async () => {
  jest.useFakeTimers();
  const { repository, service } = fixture();
  const response = new EventEmitter();
  const controller = new AiController(service);
  const result = controller.getMessageResult(
    { clerkPrincipal: owner, headers: {}, res: response } as never,
    conversationId,
    messageId,
    { waitMs: '8000' },
  );
  await jest.advanceTimersByTimeAsync(400);
  expect(response.listenerCount('close')).toBe(1);
  response.emit('close');
  await expect(result).resolves.toMatchObject({ id: messageId, status: 'processing' });
  expect(response.listenerCount('close')).toBe(0);
  expect(repository.cancelMessage).not.toHaveBeenCalled();
});

it('removes the HTTP listener on a rejected owner read', async () => {
  const { repository, service } = fixture();
  const response = new EventEmitter();
  repository.getMessage.mockRejectedValueOnce({ status: 403 });
  await expect(
    new AiController(service).getMessageResult(
      { clerkPrincipal: owner, headers: {}, res: response } as never,
      conversationId,
      messageId,
      { waitMs: '8000' },
    ),
  ).rejects.toMatchObject({ status: 403 });
  expect(response.listenerCount('close')).toBe(0);
});
