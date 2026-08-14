import { usePendingAction } from './usePendingAction';

describe('usePendingAction helper', () => {
  it('blocks rapid repeated calls and recovers after failure', async () => {
    let resolveAction!: () => void;
    const action = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveAction = resolve;
        })
    );
    const pending = usePendingAction(action);

    const first = pending.run();
    const second = pending.run();
    expect(second).resolves.toBe(false);
    expect(action).toHaveBeenCalledTimes(1);

    resolveAction();
    await first;

    action.mockRejectedValueOnce(new Error('fail'));
    await expect(pending.run()).rejects.toThrow('fail');
    action.mockResolvedValueOnce(undefined);
    await expect(pending.run()).resolves.toBe(true);
  });
});
