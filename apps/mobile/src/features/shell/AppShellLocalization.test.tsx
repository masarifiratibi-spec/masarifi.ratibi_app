import { changeLocale, translate } from '@/localization/i18n';
import { backIconForDirection, primaryTabRoutes } from './navigation-context';

describe('app shell localization', () => {
  it('keeps RTL/LTR security labels, tabs, and back controls coherent', () => {
    changeLocale('ar');
    expect(translate('appShell.security.settingsTitle')).toBe('إعدادات الأمان');
    expect(translate('appShell.security.nativeLock')).toBe('استخدام مصادقة الجهاز');
    expect(translate('appShell.security.nativeLockSubtitle')).toMatch(/بصمة.*رمز.*نمط.*جهازك/u);
    expect(backIconForDirection('rtl')).toBe('chevron-right');
    expect(primaryTabRoutes).toHaveLength(3);

    changeLocale('en');
    expect(translate('appShell.security.settingsTitle')).toBe(
      'Security settings'
    );
    expect(translate('appShell.security.nativeLock')).toBe('Use device authentication');
    expect(translate('appShell.security.nativeLockSubtitle')).toMatch(/fingerprint.*passcode.*pattern.*device/i);
    expect(backIconForDirection('ltr')).toBe('chevron-left');
    expect(primaryTabRoutes).toHaveLength(3);
  });
});
