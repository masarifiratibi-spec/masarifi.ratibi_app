import React from 'react';
import { screen } from '@testing-library/react-native';

import { translate } from '@/localization/i18n';
import { renderWithProviders } from '@/test-utils/render';
import { VoiceRecorder } from './VoiceRecorder';

it('announces recording state and exposes labelled controls without waveform meaning', () => {
  renderWithProviders(
    <VoiceRecorder state="recording" durationMs={1000} onStart={jest.fn()} onStop={jest.fn()} onCancel={jest.fn()} />
  );
  expect(screen.getByLabelText(translate('voice.record.stop'))).toHaveAccessibilityState({ disabled: false });
  expect(screen.getByText(translate('voice.record.active'))).toBeTruthy();
});
