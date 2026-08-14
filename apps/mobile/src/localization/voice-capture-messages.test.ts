import ar from './messages/ar';
import en from './messages/en';

it('keeps complete Arabic and English voice key parity', () => {
  const voiceKeys = Object.keys(en).filter((key) => key.startsWith('voice.'));
  expect(voiceKeys.length).toBeGreaterThan(50);
  expect(voiceKeys.every((key) => Boolean(ar[key as keyof typeof ar]))).toBe(true);
});
