import React from 'react';

import { changeLocale, translate } from '@/localization/i18n';
import { renderWithProviders } from '@/test-utils/render';
import { ComparisonIndicator } from './ComparisonIndicator';
import { ReportMetricCard } from './ReportMetricCard';

test('comparison and metric cards expose non-color cues and hidden-value labels', () => {
  changeLocale('en');
  const screen = renderWithProviders(
    <ReportMetricCard
      title="Expense"
      value={1200}
      currency="SAR"
      masked
      comparison={<ComparisonIndicator direction="higher" label="10%" />}
    />
  );

  expect(screen.getByLabelText(translate('designSystem.privacy.hidden'))).toBeTruthy();
  expect(screen.getByLabelText('10% higher')).toBeTruthy();
});
