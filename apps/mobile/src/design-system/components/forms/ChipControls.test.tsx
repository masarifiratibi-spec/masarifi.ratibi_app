import React, { useState } from 'react';
import { fireEvent } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils/render';
import { changeLocale, translate } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';
import { ChipSelector, KeywordChipEditor } from './ChipControls';

describe('ChipControls', () => {
  beforeEach(() => {
    changeLocale('ar');
    usePreferenceStore.setState({ locale: 'ar', direction: 'rtl' });
  });

  it('starts option rows from the right in Arabic', () => {
    const screen = renderWithProviders(
      <ChipSelector options={['الأول', 'الثاني']} selected={[]} onToggle={jest.fn()} />
    );
    const selector = screen.getByTestId('chip-selector');
    expect(selector).toHaveStyle({ flexDirection: 'row-reverse' });
  });

  it('renders shared chip labels with semantic text', () => {
    changeLocale('en');
    usePreferenceStore.setState({ locale: 'en', direction: 'ltr' });
    const screen = renderWithProviders(
      <ChipSelector options={['All']} selected={[]} onToggle={jest.fn()} />
    );

    expect(screen.getByText('All')).toHaveStyle({
      fontFamily: 'MasarifiLatin-600'
    });
  });

  it('supports selection, deletion, duplicate prevention, disabled default, and wrapping', () => {
    function Harness() {
      const [keywords, setKeywords] = useState(['rent']);
      return (
        <>
          <ChipSelector
            options={['Food', 'Bills']}
            selected={['Food']}
            disabledOptions={['Bills']}
            onToggle={jest.fn()}
          />
          <KeywordChipEditor keywords={keywords} onChange={setKeywords} />
        </>
      );
    }

    const screen = renderWithProviders(<Harness />);
    expect(
      screen.getByLabelText(
        `Food ${translate('designSystem.state.selected', 'ar')}`
      )
    ).toBeTruthy();
    expect(
      screen.getByLabelText(
        `Bills ${translate('designSystem.state.disabled', 'ar')}`
      ).props.accessibilityState
    ).toMatchObject({ disabled: true });
    fireEvent.changeText(
      screen.getByLabelText(translate('designSystem.form.keyword', 'ar')),
      'rent'
    );
    fireEvent.press(
      screen.getByLabelText(translate('designSystem.form.addKeyword', 'ar'))
    );
    expect(screen.getAllByText('rent')).toHaveLength(1);
    fireEvent.press(
      screen.getByLabelText(
        `${translate('designSystem.action.remove', 'ar')} rent`
      )
    );
    expect(screen.queryByText('rent')).toBeNull();
  });
});
