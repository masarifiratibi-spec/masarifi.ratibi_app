import React from 'react';
import { screen, waitFor } from '@testing-library/react-native';

import { translate } from '@/localization/i18n';
import { renderWithProviders } from '@/test-utils/render';
import { VoiceCaptureScreen } from './VoiceCaptureScreen';

jest.mock('@/features/core-finance/core-finance-queries', () => ({
  useAccounts: () => ({ data: [] }),
  useCategories: () => ({ data: [] }),
  scopeToKey: () => ['core-finance']
}));
jest.mock('@/services/platform/voice-recorder-service', () => ({
  voiceRecorderService: {
    getPermission: jest.fn(async () => 'denied'), requestPermission: jest.fn(),
    openSettings: jest.fn(), start: jest.fn(), stop: jest.fn(), cancel: jest.fn(), remove: jest.fn()
  }
}));

it('explains the mock and keeps manual capture available', async () => {
  renderWithProviders(<VoiceCaptureScreen onManual={jest.fn()} />);
  await waitFor(() => expect(screen.getByText(translate('voice.permission.title'))).toBeTruthy());
  expect(screen.getByText(translate('voice.demoNotice'))).toBeTruthy();
  expect(screen.getByText(translate('voice.action.manual'))).toBeTruthy();
});
