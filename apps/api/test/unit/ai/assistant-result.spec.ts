import { AiService } from '../../../src/ai/ai.service';
const owner = { userId: 'owner', sessionId: 'session', factorAgeSeconds: 0 };
const conversation = '99000000-0000-4000-8000-000000000001';
const message = '99000000-0000-4000-8000-000000000002';
describe('owner-bound resumable assistant result', () => {
  const repository = { getMessage: jest.fn(), messageResult: jest.fn(), cancelMessage: jest.fn() };
  const service = new AiService(
    repository as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  beforeEach(() => jest.clearAllMocks());
  it('exposes only the captured action timezone from the owned question context', async () => {
    repository.getMessage.mockResolvedValue({
      id: message,
      conversationId: conversation,
      role: 'user',
      contextPayload: { timezone: 'Asia/Riyadh', privateOwnerData: 'hidden' },
    });
    const result = await service.getMessage(owner, conversation, message);
    expect(result).toMatchObject({ actionTimezone: 'Asia/Riyadh' });
    expect(result).not.toHaveProperty('contextPayload');
    expect(result).not.toHaveProperty('privateOwnerData');
  });
  it('returns a terminal failed user status without requiring an assistant reply', async () => {
    repository.getMessage.mockResolvedValue({
      id: message,
      conversationId: conversation,
      role: 'user',
      contentRedacted: 'sample',
      workStatus: 'failed',
    });
    repository.messageResult.mockResolvedValue({
      id: message,
      status: 'failed',
      failureCode: 'AI_QUOTA_EXCEEDED',
    });
    await expect(service.getMessageResult(owner, conversation, message)).resolves.toMatchObject({
      id: message,
      conversationId: conversation,
      status: 'failed',
      response: null,
    });
    expect(repository.cancelMessage).not.toHaveBeenCalled();
  });
  it('rejects a message from a different conversation before reading its result', async () => {
    repository.getMessage.mockResolvedValue({ id: message, conversationId: 'other', role: 'user' });
    await expect(service.getMessageResult(owner, conversation, message)).rejects.toMatchObject({
      status: 404,
    });
    expect(repository.messageResult).not.toHaveBeenCalled();
  });
});
