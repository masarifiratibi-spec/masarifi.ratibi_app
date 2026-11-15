import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { screen } from '@testing-library/react-native';
import { StyledText } from './StyledText';
import { AppSheet } from '@/design-system/components/overlays/AppSheet';
import { CurrencyRow } from '@/features/accounts/CurrencyRow';
import { TransactionDateField } from '@/features/transactions/TransactionDateField';
import { VoiceProcessingConsentDialog } from '@/features/voice/VoiceProcessingConsentDialog';
import { changeLocale, translate } from '@/localization/i18n';
import { renderWithProviders } from '@/test-utils/render';
import { formatDate } from '@/utils/format-financial-value';

jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: () => null,
  DateTimePickerAndroid: { open: jest.fn() }
}));

const originalPlatform = Platform.OS;

beforeEach(() => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  changeLocale('ar');
});

afterEach(() => {
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: originalPlatform
  });
  changeLocale('ar');
});

describe('iOS physical text layout', () => {
  it.each([
    ['ar', 'rtl', 'right'],
    ['en', 'ltr', 'left']
  ] as const)('aligns %s paragraphs without Fabric mirroring', (locale, writingDirection, textAlign) => {
    changeLocale(locale);
    renderWithProviders(
      <View style={{ direction: writingDirection }}>
        <StyledText>Mixed SAR 123.45 عربي</StyledText>
      </View>
    );

    expect(screen.getByText('Mixed SAR 123.45 عربي')).toHaveStyle({
      direction: 'ltr',
      writingDirection,
      textAlign
    });
  });

  it('resolves automatic paragraph direction from the app language', () => {
    renderWithProviders(
      <StyledText style={{ textAlign: 'auto', writingDirection: 'auto' }}>
        نص عربي مع AI
      </StyledText>
    );
    expect(screen.getByText('نص عربي مع AI')).toHaveStyle({
      direction: 'ltr',
      writingDirection: 'rtl',
      textAlign: 'right'
    });
  });

  it('preserves explicit centered headings and directional overrides', () => {
    renderWithProviders(
      <>
        <StyledText style={{ textAlign: 'center' }}>Centered heading</StyledText>
        <StyledText style={{ textAlign: 'left', writingDirection: 'ltr' }}>
          Reference ABC 123
        </StyledText>
      </>
    );
    expect(screen.getByText('Centered heading')).toHaveStyle({
      direction: 'ltr', textAlign: 'center', writingDirection: 'rtl'
    });
    expect(screen.getByText('Reference ABC 123')).toHaveStyle({
      direction: 'ltr', textAlign: 'left', writingDirection: 'ltr'
    });
  });

  it('keeps financial content LTR with its explicit placement', () => {
    renderWithProviders(
      <StyledText variant="amount" style={{ textAlign: 'right' }}>
        1,250.50 SAR
      </StyledText>
    );
    expect(screen.getByText('1,250.50 SAR')).toHaveStyle({
      direction: 'ltr', writingDirection: 'ltr', textAlign: 'right',
      fontFamily: 'MasarifiLatin-900'
    });
  });

  it('keeps the sheet RTL while rendering its right-aligned title physically', () => {
    renderWithProviders(
      <AppSheet title="اختر الحساب" visible appearance="menu" onDismiss={jest.fn()}>
        <StyledText>خيارات الحساب</StyledText>
      </AppSheet>
    );
    expect(screen.getByTestId('app-sheet-menu')).toHaveStyle({ direction: 'rtl' });
    expect(screen.getByText('اختر الحساب')).toHaveStyle({
      direction: 'ltr', writingDirection: 'rtl', textAlign: 'right'
    });
  });

  it.each([
    ['ar', 'rtl', 'right'],
    ['en', 'ltr', 'left']
  ] as const)('keeps %s voice disclosure paragraphs on a shared reading edge', (locale, writingDirection, textAlign) => {
    changeLocale(locale);
    renderWithProviders(
      <VoiceProcessingConsentDialog
        granted={false} busy={false} failed={false}
        onDismiss={jest.fn()} onConfirm={jest.fn()} onManual={jest.fn()}
      />
    );
    for (const key of [
      'voice.processingConsent.data',
      'voice.processingConsent.purpose',
      'voice.processingConsent.choice'
    ] as const) {
      expect(screen.getByText(translate(key))).toHaveStyle({
        direction: 'ltr', writingDirection, textAlign, alignSelf: 'stretch'
      });
    }
    expect(screen.getByText(translate('voice.processingConsent.title'))).toHaveStyle({
      textAlign: 'center'
    });
  });

  it.each([
    ['ar', 'rtl', 'right'],
    ['en', 'ltr', 'left']
  ] as const)('keeps raw currency and date text aligned in %s', (locale, writingDirection, textAlign) => {
    changeLocale(locale);
    const value = Date.UTC(2026, 10, 15, 9);
    renderWithProviders(
      <>
        <CurrencyRow currencyCode="SAR" />
        <TransactionDateField value={value} onChange={jest.fn()} />
      </>
    );
    for (const text of [
      translate('coreFinance.accounts.currency'),
      translate('coreFinance.transaction.date'),
      formatDate(value, locale)
    ]) {
      expect(screen.getByText(text)).toHaveStyle({
        direction: 'ltr', writingDirection, textAlign
      });
    }
  });

  it('preserves Android automatic text and the existing raw-label styles', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    renderWithProviders(
      <>
        <StyledText>Legacy automatic direction</StyledText>
        <CurrencyRow currencyCode="SAR" />
      </>
    );
    const body = StyleSheet.flatten(screen.getByText('Legacy automatic direction').props.style);
    expect(body.writingDirection).toBe('auto');
    expect(body.direction).toBeUndefined();
    expect(body.textAlign).toBeUndefined();
    const label = screen.getByText(translate('coreFinance.accounts.currency'));
    expect(label).toHaveStyle({ textAlign: 'right', writingDirection: 'rtl' });
    expect(StyleSheet.flatten(label.props.style).direction).toBeUndefined();
  });
});
