import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';

import { translate } from '@/localization/i18n';
import { renderWithProviders } from '@/test-utils/render';
import { VoiceRecorder } from './VoiceRecorder';

it('exposes text recording status and working controls', () => {
  const start = jest.fn();
  const first = renderWithProviders(
    <VoiceRecorder state="ready" durationMs={0} onStart={start} onStop={jest.fn()} onCancel={jest.fn()} />
  );
  fireEvent.press(screen.getByText(translate('voice.record.start')));
  expect(start).toHaveBeenCalledTimes(1);
  first.unmount();
  renderWithProviders(
    <VoiceRecorder state="recording" durationMs={51_000} onStart={start} onStop={jest.fn()} onCancel={jest.fn()} />
  );
  expect(screen.getByText('00:51')).toBeTruthy();
  expect(screen.getByText(translate('voice.record.warning'))).toBeTruthy();
  expect(screen.getByTestId('voice-recorder')).toHaveStyle({
    alignSelf: 'center',
    maxWidth: 320,
    width: '100%'
  });
  expect(screen.getByLabelText(translate('voice.record.stop'))).toHaveStyle({
    borderRadius: 44,
    height: 88,
    width: 88
  });
});
