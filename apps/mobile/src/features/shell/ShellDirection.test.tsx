import {
  backIconForDirection,
  tabOrderForDirection,
  utilityIcon
} from './navigation-context';

describe('shell direction', () => {
  it('mirrors directional back icons and tab order without changing utility icons', () => {
    expect(tabOrderForDirection('ltr')).toEqual([
      '/(tabs)/home',
      '/assistant',
      '/(tabs)/transactions'
    ]);
    expect(tabOrderForDirection('rtl')).toEqual([
      '/(tabs)/transactions',
      '/assistant',
      '/(tabs)/home'
    ]);
    expect(backIconForDirection('ltr')).toBe('chevron-left');
    expect(backIconForDirection('rtl')).toBe('chevron-right');
    expect(utilityIcon('close')).toBe(utilityIcon('close'));
  });
});
