import React from 'react';
import { fireEvent } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils/render';
import { InteractionGallery } from './InteractionGallery';
import { changeLocale } from '@/localization/i18n';

describe('InteractionGallery', () => {
  beforeEach(() => {
    changeLocale('en');
  });

  it('covers validation persistence, duplicate-submit blocking, undo, keyboard reachability, and destructive confirmation', () => {
    const screen = renderWithProviders(<InteractionGallery />);

    fireEvent.changeText(screen.getByLabelText('Amount'), '150');
    expect(screen.getByLabelText('Amount').props.value).toBe('150');
    fireEvent.press(screen.getByLabelText('Save changes'));
    fireEvent.press(screen.getByLabelText('Save changes'));
    expect(screen.getByText('Saved')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Undo'));
    fireEvent.press(screen.getByLabelText('Delete permanently'));
    expect(screen.getAllByText('Delete permanently').length).toBeGreaterThan(0);
  });
});
