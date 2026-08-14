import { createMockExchangeRateService } from './exchange-rate-service';

it('returns profile-currency identity and unavailable pairs explicitly', async () => {
  const service = createMockExchangeRateService([]);
  await expect(service.getRate('SAR', 'SAR')).resolves.toMatchObject({
    rate: 1,
    status: 'available'
  });
  await expect(service.getRate('SAR', 'JPY')).resolves.toEqual({
    rate: null,
    asOf: null,
    status: 'unavailable'
  });
});

it('retains mock rate timestamp and status', async () => {
  const service = createMockExchangeRateService([
    {
      baseCurrencyCode: 'SAR',
      quoteCurrencyCode: 'USD',
      rate: 3.75,
      asOf: 123,
      status: 'stale'
    }
  ]);
  await expect(service.getRate('SAR', 'USD')).resolves.toEqual({
    rate: 3.75,
    asOf: 123,
    status: 'stale'
  });
});

it('keeps original components knowable by returning rate and timestamp', async () => {
  const service = createMockExchangeRateService([
    {
      baseCurrencyCode: 'SAR',
      quoteCurrencyCode: 'USD',
      rate: 3.75,
      asOf: 123,
      status: 'available'
    }
  ]);
  const rate = await service.getRate('SAR', 'USD');
  expect(Math.round(100 * rate.rate!)).toBe(375);
  expect(rate.asOf).toBe(123);
});
