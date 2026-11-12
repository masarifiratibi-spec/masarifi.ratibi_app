import { translate, translateDynamic } from '@/localization/i18n';

function updateMessages(locale: 'ar' | 'en') {
  return {
    title: translate('app-update.title', locale),
    page: translate('app-update.page', locale),
    check: translate('app-update.check', locale),
    update: translate('app-update.update', locale),
    later: translate('app-update.later', locale),
    retry: translate('app-update.retry', locale),
    body: (version: string) =>
      translateDynamic('app-update.body', { version }, locale),
    checking: translate('app-update.checking', locale),
    current: translate('app-update.current', locale),
    unavailable: translate('app-update.unavailable', locale),
    storeError: translate('app-update.storeError', locale),
    unsupported: translate('app-update.unsupported', locale)
  };
}

export const updateCopy = {
  ar: updateMessages('ar'),
  en: updateMessages('en')
};
