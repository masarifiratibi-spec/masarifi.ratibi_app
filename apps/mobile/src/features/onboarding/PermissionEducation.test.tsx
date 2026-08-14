import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';

import { PermissionEducation } from './PermissionEducation';
import { renderWithProviders } from '@/test-utils/render';

describe('PermissionEducation', () => {
  it('explains purpose, data use, benefit, denial result, privacy, disable, review, and fallbacks', () => {
    const onEnable = jest.fn();
    const onSkip = jest.fn();

    renderWithProviders(<PermissionEducation onEnable={onEnable} onSkip={onSkip} />);

    expect(screen.getByText('السماح بتتبع الرسائل')).toBeOnTheScreen();
    expect(screen.getByText(/على هذا الجهاز فقط/)).toBeOnTheScreen();
    expect(screen.getByText(/لا تتم إضافة الأكواد/)).toBeOnTheScreen();
    expect(screen.getByText(/التعديل والتراجع/)).toBeOnTheScreen();
    expect(screen.getByText(/الإدخال اليدوي والصوتي/)).toBeOnTheScreen();
    expect(screen.getByText(/إيقاف تتبع الرسائل/)).toBeOnTheScreen();
    expect(screen.getByText(/مراجعة/)).toBeOnTheScreen();

    fireEvent.press(screen.getByLabelText('تفعيل التتبع'));
    fireEvent.press(screen.getByLabelText('ليس الآن'));
    expect(onEnable).toHaveBeenCalledTimes(1);
    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});
