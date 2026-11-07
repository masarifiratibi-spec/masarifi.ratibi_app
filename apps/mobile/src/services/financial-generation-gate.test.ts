import {
  captureWriteGeneration,
  bindGenerationGate,
  generationHeaders,
  financialMutation
} from './financial-generation-gate';

it('keeps the version of a prepared write when another device resets the account', async () => {
  let generation = 0;
  let owner = 'one';
  const stop = bindGenerationGate({
    owner: () => owner,
    check: async () => String(generation)
  });
  try {
    const prepared = await captureWriteGeneration();
    generation++;
    expect(generationHeaders(prepared)).toEqual({
      'X-Financial-Generation': '0'
    });
    expect(generationHeaders(await captureWriteGeneration())).toEqual({
      'X-Financial-Generation': '1'
    });
    owner = 'two';
    expect(() => generationHeaders(prepared)).toThrow('owner changed');
  } finally {
    stop();
  }
});

it('covers direct, queued and background financial writes without changing identity calls', () => {
  for (const path of [
    'transfers',
    'sync/mutations',
    'imports',
    'assistant/conversations',
    'voice/sessions',
    'report-schedules'
  ])
    expect(financialMutation('/api/v1/' + path, 'POST')).toBe(true);
  expect(financialMutation('/api/v1/accounts', 'GET')).toBe(false);
  expect(financialMutation('/api/v1/me/deletion', 'POST')).toBe(false);
});
