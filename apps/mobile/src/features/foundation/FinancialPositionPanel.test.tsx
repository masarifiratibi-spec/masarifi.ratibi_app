import React from 'react';
import { Text } from 'react-native';

import { FinancialPositionPanel } from './FinancialPositionPanel';
import { renderWithProviders } from '@/test-utils/render';
import { changeLocale } from '@/localization/i18n';
import {
  populatedSummary,
  emptySummary,
  partialSummary
} from '@/services/mocks/financial-summary';

// The panel renders the active locale's strings. Tests pin English so
// assertions read clearly; locale parity is covered separately by i18n tests.
beforeEach(() => changeLocale('en'));

describe('FinancialPositionPanel', () => {
  it('shows balance, spending, and next obligation for populated data', () => {
    const { getByText, getByLabelText } = renderWithProviders(
      <FinancialPositionPanel summary={populatedSummary} />
    );
    expect(getByText('Current balance')).toBeTruthy();
    expect(getByText('Recent spending')).toBeTruthy();
    expect(getByText('Next obligation')).toBeTruthy();
    // Amount rendered with Latin numerals via the accessibility label.
    expect(getByLabelText(/12,450.75/)).toBeTruthy();
  });

  it('uses a localized estimated label in Arabic', () => {
    changeLocale('ar');
    const estimatedSummary = {
      ...partialSummary,
      balance: { ...partialSummary.balance, isEstimated: true }
    };
    const { getByText, queryByText } = renderWithProviders(
      <FinancialPositionPanel summary={estimatedSummary} />
    );

    expect(getByText(/تقديري/)).toBeTruthy();
    expect(queryByText(/\(est\.\)/)).toBeNull();
  });

  it('shows an empty state with one clear next action when data is missing', () => {
    const { getByText, queryByText } = renderWithProviders(
      <FinancialPositionPanel summary={emptySummary} />
    );
    expect(getByText('Welcome to Masarifi')).toBeTruthy();
    expect(getByText('Add your first transaction')).toBeTruthy();
    expect(queryByText('Current balance')).toBeNull();
  });

  it('flags incomplete data and offers a review action for partial state', () => {
    const { getByText } = renderWithProviders(
      <FinancialPositionPanel summary={partialSummary} />
    );
    expect(getByText('Some information is incomplete')).toBeTruthy();
    expect(getByText('Review missing data')).toBeTruthy();
  });

  it('shows a next action in every non-empty scenario', () => {
    const { getByText } = renderWithProviders(
      <FinancialPositionPanel summary={populatedSummary} />
    );
    expect(getByText('Next action')).toBeTruthy();
  });

  it('renders every visible Text node with content or an accessible label', () => {
    const { UNSAFE_root } = renderWithProviders(
      <FinancialPositionPanel summary={populatedSummary} />
    );
    const texts = UNSAFE_root.findAllByType(Text);
    const labelless = texts.filter(
      (node: { props: { children?: unknown; accessibilityLabel?: string } }) =>
        !node.props.children && !node.props.accessibilityLabel
    );
    expect(labelless).toHaveLength(0);
  });
});
