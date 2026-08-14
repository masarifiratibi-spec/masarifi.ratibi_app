import { validateSenderRule } from './sender-rules';

describe('sender rules', () => {
  it('normalizes sender identity and rejects empty values', () => {
    expect(validateSenderRule(' MASARIFI Bank ')).toBe('masarifibank');
    expect(validateSenderRule('   ')).toBeNull();
  });
});
