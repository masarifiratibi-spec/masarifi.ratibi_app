import React from 'react';
import { screen } from '@testing-library/react-native';

import { StateView, type FeedbackState } from '@/design-system/components/feedback/StateView';
import { renderWithProviders } from '@/test-utils/render';
import { changeLocale } from '@/localization/i18n';

test.each<[FeedbackState, string, 'polite' | 'assertive']>([
  ['loading', 'Loading notifications', 'polite'],
  ['empty', 'No notifications yet', 'polite'],
  ['offline', 'Notifications are unavailable offline', 'assertive'],
  ['error', 'Tickets are unavailable. Try again.', 'assertive'],
  ['permission', 'Notification permission is required.', 'polite']
])('renders the real %s state with safe recovery semantics', (state, title, liveRegion) => {
  changeLocale('en');
  const view = renderWithProviders(<StateView state={state} title={title} actionLabel="notifications.center.retry" onAction={() => undefined} />);
  expect(screen.getByLabelText(title).props.accessibilityLiveRegion).toBe(liveRegion);
  expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
  expect(JSON.stringify(view.toJSON())).not.toMatch(/SQLITE|stack|provider/i);
});
