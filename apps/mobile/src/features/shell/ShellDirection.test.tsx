import { backIconForDirection, tabOrderForDirection, utilityIcon } from './navigation-context';

describe('shell direction', () => {
  it('mirrors directional back icons and tab order without changing utility icons', () => {
    expect(tabOrderForDirection('ltr')[0]).toBe('/(tabs)/home');
    expect(tabOrderForDirection('rtl')[0]).toBe('/(tabs)/more');
    expect(backIconForDirection('ltr')).toBe('chevron-left');
    expect(backIconForDirection('rtl')).toBe('chevron-right');
    expect(utilityIcon('close')).toBe(utilityIcon('close'));
  });
});
