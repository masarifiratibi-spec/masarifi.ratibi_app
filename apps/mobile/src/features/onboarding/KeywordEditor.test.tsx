import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils/render';
import { defaultKeywordRules } from '@/services/mocks/default-keywords';
import { KeywordEditor } from './KeywordEditor';

describe('KeywordEditor', () => {
  it('searches, filters, edits custom values, toggles defaults, and restores safely', () => {
    const onChange = jest.fn();
    renderWithProviders(<KeywordEditor onChange={onChange} rules={defaultKeywordRules} />);

    fireEvent.press(screen.getByText('English'));
    expect(screen.queryByText('راتب')).toBeNull();
    expect(screen.getAllByText('إيقاف').length).toBeGreaterThan(0);
    fireEvent.changeText(screen.getByLabelText('بحث في الكلمات'), 'grocery');
    expect(screen.getByText('Grocery')).toBeOnTheScreen();

    fireEvent.changeText(screen.getByLabelText('كلمة جديدة'), 'Cafe');
    fireEvent.press(screen.getByLabelText('إضافة كلمة'));
    expect(onChange).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ normalizedValue: 'cafe' })])
    );

    fireEvent.press(screen.getAllByLabelText(/إيقاف/)[0]);
    expect(onChange).toHaveBeenCalled();

    fireEvent.changeText(screen.getByLabelText('كلمة جديدة'), 'grocery');
    fireEvent.press(screen.getByLabelText('إضافة كلمة'));
    expect(screen.getByText('هذه الكلمة موجودة بالفعل.')).toBeOnTheScreen();

    fireEvent.press(screen.getByLabelText('استعادة الافتراضيات'));
    expect(onChange).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ origin: 'default', enabled: true })])
    );
  });
});
