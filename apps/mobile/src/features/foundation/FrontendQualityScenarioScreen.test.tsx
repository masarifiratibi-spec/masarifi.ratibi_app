import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';

import { FrontendQualityScenarioScreen } from './FrontendQualityScenarioScreen';
import { changeLocale } from '@/localization/i18n';
import { renderWithProviders } from '@/test-utils/render';
import { requiredScenarioCoverage } from '@/test-utils/frontend-quality-scenarios';

beforeEach(() => changeLocale('en'));

describe('FrontendQualityScenarioScreen', () => {
  it('lists every required profile', () => {
    const { getByLabelText } = renderWithProviders(
      <FrontendQualityScenarioScreen />
    );

    for (const id of requiredScenarioCoverage) {
      getByLabelText(`Select ${id}`);
    }
  });

  it('refuses reset without disposable confirmation', async () => {
    const { getByLabelText, queryByTestId, queryByText } = renderWithProviders(
      <FrontendQualityScenarioScreen />
    );

    expect(queryByTestId('frontend-quality-confirm-icon')).toBeNull();

    fireEvent.press(getByLabelText('Reset selected scenario'));

    await waitFor(() => expect(queryByText('Seeded typical')).toBeNull());
    getByLabelText('Confirm disposable profile');
  });

  it('uses the shared icon after disposable confirmation', () => {
    const { getByLabelText, getByTestId } = renderWithProviders(
      <FrontendQualityScenarioScreen />
    );

    fireEvent.press(getByLabelText('Confirm disposable profile'));

    expect(
      getByTestId('frontend-quality-confirm-icon', {
        includeHiddenElements: true
      })
    ).toBeTruthy();
  });

  it('shows seeded route links after confirmation', async () => {
    const { getByLabelText, getByText } = renderWithProviders(
      <FrontendQualityScenarioScreen />
    );

    fireEvent.press(getByLabelText('Confirm disposable profile'));
    fireEvent.press(getByLabelText('Reset selected scenario'));

    await waitFor(() => getByText('Seeded typical'));
    getByText('/(tabs)');
    getByText('/transactions');
  });

  it('preserves failure state', async () => {
    const { getByLabelText, getByText } = renderWithProviders(
      <FrontendQualityScenarioScreen defaultProfileId="real-user" />
    );

    fireEvent.press(getByLabelText('Confirm disposable profile'));
    fireEvent.press(getByLabelText('Reset selected scenario'));

    await waitFor(() => getByText('Reset failed: non_disposable_profile'));
  });
});
