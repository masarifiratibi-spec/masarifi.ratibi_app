import React from 'react';
import { screen } from '@testing-library/react-native';
import { changeLocale } from '@/localization/i18n';
import { renderWithProviders } from '@/test-utils/render';
import { VoiceBatchStatus } from './VoiceBatchStatus';

it.each([
  ['en', false, 'Analyzing recording...', 'Checking the result…'],
  ['en', true, 'Analyzing recording...', 'Checking the result…'],
  ['ar', false, 'جاري تحليل التسجيل...', 'جارٍ التحقق من النتيجة…'],
  ['ar', true, 'جاري تحليل التسجيل...', 'جارٍ التحقق من النتيجة…']
] as const)(
  'shows an honest pending status in %s when uncertainty is %s',
  (locale, uncertain, analyzing, checking) => {
    changeLocale(locale);
    const batches = {
      submit: () => undefined,
      recover: async () => undefined,
      cancel: async () => undefined,
      results: [],
      pendingIds: ['capture-pending'],
      cancelIds: ['capture-pending'],
      uncertain,
      localFailure: false,
      processing: true,
      latest: null
    };
    renderWithProviders(<VoiceBatchStatus batches={batches} />);
    expect(screen.getByText(uncertain ? checking : analyzing)).toBeTruthy();
    expect(screen.queryByText(uncertain ? analyzing : checking)).toBeNull();
  }
);
