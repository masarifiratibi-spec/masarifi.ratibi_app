import { assistantMessage } from '../../../src/ai/ai.dto';
import { hashNormalizedCommand } from '../../../src/ledger/idempotency';

it.each(['كم صرفت هذا الشهر', 'How much did I spend in October 2026?'])(
  'hashes a typed question without an optional intent: %s',
  (content) => {
    const request = assistantMessage({ content, responseMode: 'async' });
    expect(() => hashNormalizedCommand(request)).not.toThrow();
    expect(hashNormalizedCommand(request)).toBe(
      hashNormalizedCommand(assistantMessage({ content, responseMode: 'async' })),
    );
  },
);

it('retains explicit suggestion intent in the request identity', () => {
  const typed = assistantMessage({ content: 'Spend?', responseMode: 'async' });
  const suggested = assistantMessage({
    content: 'Spend?',
    responseMode: 'async',
    intent: 'spending_summary',
  });
  expect(suggested.intent).toBe('spending_summary');
  expect(hashNormalizedCommand(suggested)).not.toBe(hashNormalizedCommand(typed));
});
