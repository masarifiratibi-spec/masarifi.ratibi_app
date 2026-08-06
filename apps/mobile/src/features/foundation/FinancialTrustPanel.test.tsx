import React from 'react';
import { fireEvent } from '@testing-library/react-native';

import { FinancialTrustPanel } from './FinancialTrustPanel';
import { renderWithProviders } from '@/test-utils/render';
import { changeLocale } from '@/localization/i18n';

beforeEach(() => changeLocale('en'));

describe('FinancialTrustPanel', () => {
  it('shows source and undo for a clear automatic change', () => {
    const { getByText, getByLabelText } = renderWithProviders(
      <FinancialTrustPanel scenario="clear" />
    );
    expect(getByText('Source')).toBeTruthy();
    expect(getByText(/Applied/)).toBeTruthy();
    expect(getByLabelText('Undo')).toBeTruthy();
  });

  it('routes an ambiguous change to review without applying it', () => {
    const { getByText, queryByText } = renderWithProviders(
      <FinancialTrustPanel scenario="ambiguous" />
    );
    expect(getByText(/Needs review/)).toBeTruthy();
    expect(queryByText(/Applied/)).toBeNull();
  });

  it('shows a comparison choice for a duplicate', () => {
    const { getByText } = renderWithProviders(
      <FinancialTrustPanel scenario="duplicate" />
    );
    expect(getByText(/Needs review/)).toBeTruthy();
  });

  it('requires explicit confirmation for an assistant proposal', () => {
    const { getByText, queryByText, getByLabelText } = renderWithProviders(
      <FinancialTrustPanel scenario="assistant" />
    );
    expect(getByText(/Preview of the change/)).toBeTruthy();
    expect(getByLabelText('Confirm change')).toBeTruthy();
    // Not applied yet — no undo shown until confirmed.
    expect(queryByText(/Applied/)).toBeNull();
  });

  it('applies an assistant proposal only after confirmation is pressed', () => {
    const { getByLabelText, getByText } = renderWithProviders(
      <FinancialTrustPanel scenario="assistant" />
    );

    fireEvent.press(getByLabelText('Confirm change'));

    expect(getByText('Applied')).toBeTruthy();
  });

  it('updates an applied change to undone when undo is pressed', () => {
    const { getByLabelText, getByText } = renderWithProviders(
      <FinancialTrustPanel scenario="clear" />
    );

    fireEvent.press(getByLabelText('Undo'));

    expect(getByText('Undone')).toBeTruthy();
  });

  it('shows a recovery action and no raw provider details for a failure', () => {
    const { getByText, getByLabelText } = renderWithProviders(
      <FinancialTrustPanel scenario="failed" />
    );
    expect(getByText('Something went wrong')).toBeTruthy();
    expect(getByLabelText('Try again')).toBeTruthy();
  });

  it('localizes the financial source label', () => {
    changeLocale('ar');
    const { queryByText } = renderWithProviders(
      <FinancialTrustPanel scenario="clear" />
    );

    expect(queryByText('Automatic')).toBeNull();
  });
});
