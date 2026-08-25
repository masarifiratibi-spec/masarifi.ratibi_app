import React from 'react';
import { fireEvent } from '@testing-library/react-native';

import { changeLocale, translate } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';
import { renderWithProviders } from '@/test-utils/render';
import { AttentionRail } from '../feedback/AttentionRail';
import { FinancialPulse } from './FinancialPulse';
import { SourceMark } from './SourceMark';

describe('shared financial decision surfaces', () => {
  it('renders privacy-safe source, pulse evidence, and caller-ordered attention actions', () => {
    const onSource = jest.fn();
    const onEvidence = jest.fn();
    const onReview = jest.fn();

    const screen = renderWithProviders(
      <>
        <SourceMark label="Manual" description="Added by you" onPress={onSource} />
        <FinancialPulse
          statement="Cash flow is steady"
          scope="This month"
          scopeIcon="info"
          supportingValue="3 obligations covered"
          evidenceLabel="View evidence"
          onEvidence={onEvidence}
        />
        <AttentionRail
          label="Needs attention"
          items={[
            {
              title: 'Review salary split',
              reason: 'New estimate available',
              consequence: 'Budget totals stay unchanged until confirmed',
              status: 'Review',
              actionLabel: 'Open review',
              onPress: onReview
            }
          ]}
        />
      </>
    );

    fireEvent.press(screen.getByLabelText('Manual, Added by you'));
    fireEvent.press(screen.getByLabelText('View evidence'));
    fireEvent.press(
      screen.getByLabelText(
        'Review salary split, New estimate available, Budget totals stay unchanged until confirmed, Review'
      )
    );

    expect(onSource).toHaveBeenCalledTimes(1);
    expect(onEvidence).toHaveBeenCalledTimes(1);
    expect(onReview).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Cash flow is steady')).toBeTruthy();
    expect(screen.getByTestId('financial-pulse-scope')).toHaveStyle({
      alignSelf: 'stretch',
      writingDirection: 'ltr'
    });
    expect(screen.getByTestId('financial-pulse-statement')).toBeTruthy();
    expect(screen.getAllByTestId('financial-pulse-orbit', {
      includeHiddenElements: true
    })).toHaveLength(2);
    expect(screen.queryByLabelText('This month')).toBeNull();
    expect(screen.queryByText('raw-sms-body')).toBeNull();
  });

  it.each([
    ['en', 'Manual', 'MasarifiLatin-700', 'MasarifiLatin-600'],
    ['ar', 'يدوي', 'MasarifiArabic-700', 'MasarifiArabic-600']
  ] as const)(
    'uses semantic %s typography for source cues and labels',
    (locale, label, cueFamily, labelFamily) => {
      changeLocale(locale);
      usePreferenceStore.setState({ locale });
      const screen = renderWithProviders(<SourceMark label={label} />);

      expect(screen.getByText(translate('designSystem.financial.source'))).toHaveStyle({
        fontFamily: cueFamily
      });
      expect(screen.getByText(label)).toHaveStyle({ fontFamily: labelFamily });
    }
  );
});
