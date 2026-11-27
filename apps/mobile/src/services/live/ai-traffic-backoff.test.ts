import { AiTrafficBackoff, AiTrafficBusy } from './ai-traffic-backoff';

describe('AI traffic backoff', () => {
  const busy = (seconds: number) => ({
    status: 429, headers: new Headers({'X-Masarifi-AI-Limit':'traffic','Retry-After':String(seconds)})
  } as Response);
  it('retries the same operation once after a short pause and rechecks the owner', async () => {
    jest.useFakeTimers();
    try {
      const gate = new AiTrafficBackoff(), check = jest.fn(async () => {});
      const send = jest.fn().mockResolvedValueOnce(busy(1)).mockResolvedValueOnce({status:202});
      const result = gate.request('a','POST','/messages',new AbortController().signal,check,send);
      await jest.advanceTimersByTimeAsync(999);
      expect(send).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(1);
      await expect(result).resolves.toEqual({status:202});
      expect(check).toHaveBeenCalledTimes(1);
      expect(send).toHaveBeenCalledTimes(2);
    } finally { jest.useRealTimers(); }
  });
  it('suppresses premature retries while permitting cancellation and other owners', async () => {
    const gate = new AiTrafficBackoff(), check = async () => {};
    const send = jest.fn().mockResolvedValueOnce(busy(10)).mockResolvedValue({status:200});
    const run = (owner: string,path: string) => gate.request(owner,'POST',path,new AbortController().signal,check,send);
    await expect(run('one','/process')).rejects.toBeInstanceOf(AiTrafficBusy);
    await expect(run('one','/process')).rejects.toBeInstanceOf(AiTrafficBusy);
    expect(send).toHaveBeenCalledTimes(1);
    await expect(run('one','/cancel')).resolves.toEqual({status:200});
    await expect(run('two','/process')).resolves.toEqual({status:200});
  });
});
