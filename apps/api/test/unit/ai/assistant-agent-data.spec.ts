import { parseAssistantDataQuery } from '../../../src/ai/assistant-agent-data';

describe('assistant financial read query', () => {
  it('accepts a bounded historical merchant query without losing selectors', () => {
    expect(
      parseAssistantDataQuery({
        tool: 'transactions',
        startDate: '2024-02-29',
        endDate: '2024-03-01',
        currency: 'SAR',
        account: 'ACCOUNT-2',
        category: 'طعام',
        search: 'coffee',
        sort: 'largest',
        limit: 50,
        offset: 100,
      }),
    ).toEqual({
      tool: 'transactions',
      startDate: '2024-02-29',
      endDate: '2024-03-01',
      currency: 'SAR',
      account: 'ACCOUNT-2',
      category: 'طعام',
      search: 'coffee',
      sort: 'largest',
      limit: 50,
      offset: 100,
    });
  });
  it.each<unknown>([
    { tool: 'sql', query: 'select 1' },
    { tool: 'accounts', owner: 'someone-else' },
    { tool: 'accounts', constructor: 'unexpected' },
    { tool: 'transactions', kind: 'arbitrary' },
    { tool: 'transactions', minAmountMinor: '10' },
    { tool: 'transactions', currency: 'SAR', minAmountMinor: '10.5' },
    { tool: 'transactions', currency: 'SAR', minAmountMinor: '100', maxAmountMinor: '50' },
    { tool: 'transactions', startDate: '2025-02-29' },
    { tool: 'summary', startDate: '2025-04-01', endDate: '2025-03-01' },
    { tool: 'transactions', limit: 51 },
    { tool: 'transactions', offset: -1 },
    { tool: 'transactions', currency: 'sar' },
    { tool: 'transactions', search: 'x'.repeat(161) },
  ])('rejects unsafe or unbounded query %j', (query) => {
    expect(() => parseAssistantDataQuery(query)).toThrow('ASSISTANT_DATA_QUERY_INVALID');
  });
});
