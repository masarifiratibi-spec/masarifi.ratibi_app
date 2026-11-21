import { recordMobileForeground } from './mobile-activity';
import { captureLiveClerkIdentity } from './auth-service';
import { requestJson } from './http-client';
import { ensureTrackingSyncDevice } from '../tracking-sync-device';
jest.mock('./auth-service', () => ({ captureLiveClerkIdentity: jest.fn() }));
jest.mock('./http-client', () => ({ requestJson: jest.fn() }));
jest.mock('../tracking-sync-device', () => ({
  ensureTrackingSyncDevice: jest.fn()
}));
describe('native foreground measurement', () => {
  it('binds to the current authenticated owner, sends no content, and throttles repeated foregrounds', async () => {
    const assertCurrent = jest.fn().mockResolvedValue(undefined);
    jest
      .mocked(captureLiveClerkIdentity)
      .mockResolvedValue({
        userId: 'customer',
        token: 'token',
        assertCurrent
      } as never);
    jest.mocked(requestJson).mockResolvedValue({});
    await recordMobileForeground('ios', 1000000);
    await recordMobileForeground('ios', 1000001);
    expect(ensureTrackingSyncDevice).toHaveBeenCalledWith('customer');
    expect(requestJson).toHaveBeenCalledTimes(1);
    expect(requestJson).toHaveBeenCalledWith(
      '/api/v1/me/mobile-activity',
      expect.anything(),
      expect.objectContaining({ method: 'POST', body: { platform: 'ios' } })
    );
    await recordMobileForeground('ios', 1800000);
    expect(requestJson).toHaveBeenCalledTimes(2);
    await recordMobileForeground('web', 2000000);
    expect(requestJson).toHaveBeenCalledTimes(2);
  });
});
