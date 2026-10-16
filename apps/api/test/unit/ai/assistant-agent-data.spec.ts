import {
  ASSISTANT_DATA_QUERY_SCHEMA,
  parseAssistantDataQuery,
} from '../../../src/ai/assistant-agent-data';

describe('assistant financial read query', () => {
  it.each(['overview', 'accounts', 'transactions', 'summary', 'planning', 'profile', 'tracking'])(
    'accepts the strict provider null collection for %s without selecting a collection',
    (tool) => {
      expect(ASSISTANT_DATA_QUERY_SCHEMA.properties.collection.type).toContain('null');
      expect(ASSISTANT_DATA_QUERY_SCHEMA.properties.collection.enum).toContain(null);
      expect(parseAssistantDataQuery({ tool, collection: null })).toEqual({ tool });
    },
  );
  it('allows only a known collection in its matching read domain', () => {
    expect(
      parseAssistantDataQuery({ tool: 'tracking', collection: 'voice_session', limit: 2 }),
    ).toEqual({ tool: 'tracking', collection: 'voice_session', limit: 2 });
    expect(() =>
      parseAssistantDataQuery({ tool: 'transactions', collection: 'voice_session' }),
    ).toThrow('ASSISTANT_DATA_QUERY_INVALID');
    expect(() => parseAssistantDataQuery({ tool: 'planning', collection: 'secret' })).toThrow(
      'ASSISTANT_DATA_QUERY_INVALID',
    );
  });
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
