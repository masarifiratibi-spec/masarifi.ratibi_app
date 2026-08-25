import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils/render';
import { TransactionDateField } from './TransactionDateField.web';

it('updates from the web date input event', () => {
  const onChange = jest.fn();
  renderWithProviders(
    <TransactionDateField
      label="Start date"
      value={new Date(2026, 7, 1, 12).getTime()}
      onChange={onChange}
    />
  );

  fireEvent(screen.getByLabelText('Start date'), 'input', {
    currentTarget: { value: '2026-08-02' }
  });

  expect(new Date(onChange.mock.calls[0][0]).getDate()).toBe(2);
});
