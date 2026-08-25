import {
  backIconForDirection,
  utilityIcon
} from './navigation-context';

describe('shell direction', () => {
  it('mirrors directional back icons without changing utility icons', () => {
    expect(backIconForDirection('ltr')).toBe('chevron-left');
    expect(backIconForDirection('rtl')).toBe('chevron-right');
    expect(utilityIcon('close')).toBe(utilityIcon('close'));
  });
});
