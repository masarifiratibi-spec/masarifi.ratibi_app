import { changeLocale, translate } from '@/localization/i18n';
import { backIconForDirection, primaryTabRoutes } from './navigation-context';

describe('app shell localization', () => {
  it('keeps RTL/LTR security labels, tabs, and back controls coherent', () => {
    changeLocale('ar');
    expect(translate('appShell.security.settingsTitle')).toBe('إعدادات الأمان');
    expect(translate('appShell.security.pin.create')).toBe('إنشاء رمز PIN');
    expect(translate('appShell.security.biometric.requiresPin')).toContain(
      'رمز PIN'
    );
    expect(backIconForDirection('rtl')).toBe('chevron-right');
    expect(primaryTabRoutes).toHaveLength(3);

    changeLocale('en');
    expect(translate('appShell.security.settingsTitle')).toBe(
      'Security settings'
    );
    expect(translate('appShell.security.pin.create')).toBe('Create App PIN');
    expect(translate('appShell.security.biometric.requiresPin')).toContain(
      'App PIN'
    );
    expect(backIconForDirection('ltr')).toBe('chevron-left');
    expect(primaryTabRoutes).toHaveLength(3);
  });
});
