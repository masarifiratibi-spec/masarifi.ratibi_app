import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { translate } from '@/localization/i18n';

import { PermissionEducation } from './PermissionEducation';
import { renderWithProviders } from '@/test-utils/render';

describe('PermissionEducation', () => {
  it('keeps guidance brief and lets users read details without enabling capture', () => {
    const onEnable = jest.fn();
    const onSkip = jest.fn();
    const push = jest.spyOn(router, 'push').mockImplementation(() => undefined);

    renderWithProviders(
      <PermissionEducation onEnable={onEnable} onSkip={onSkip} />
    );

    expect(screen.getByText('السماح بتتبع الرسائل')).toBeOnTheScreen();
    expect(
      screen.getByText(translate('appShell.onboarding.permission.purpose'))
    ).toBeOnTheScreen();
    expect(
      screen.getByText(translate('appShell.onboarding.permission.dataUse'))
    ).toBeOnTheScreen();
    fireEvent.press(
      screen.getByRole('button', { name: translate('privacy.details') })
    );
    expect(push).toHaveBeenCalledWith({
      pathname: '/(public)/legal',
      params: { document: 'privacy' }
    });
    expect(onEnable).not.toHaveBeenCalled();

    fireEvent.press(screen.getByLabelText('تفعيل التتبع'));
    fireEvent.press(screen.getByLabelText('ليس الآن'));
    expect(onEnable).toHaveBeenCalledTimes(1);
    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});
