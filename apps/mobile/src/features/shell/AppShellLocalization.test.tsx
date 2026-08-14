import { changeLocale, translate } from '@/localization/i18n';
import { backIconForDirection, tabOrderForDirection } from './navigation-context';

describe('app shell localization', () => {
  it('keeps RTL/LTR labels, English numerals, tabs, and back controls coherent', () => {
    changeLocale('ar');
    expect(translate('appShell.security.pinError')).toContain('6');
    expect(backIconForDirection('rtl')).toBe('chevron-right');
    expect(tabOrderForDirection('rtl')).toHaveLength(5);

    changeLocale('en');
    expect(translate('appShell.security.pinError')).toContain('6');
    expect(backIconForDirection('ltr')).toBe('chevron-left');
    expect(tabOrderForDirection('ltr')).toHaveLength(5);
  });
});
