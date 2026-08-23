import React from 'react';
import { PixelRatio, StyleSheet } from 'react-native';

import { changeLocale, translate } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';
import { renderWithProviders } from '@/test-utils/render';
import { lightThemeColors } from '@/design-system/tokens';
import { TransactionRow } from './TransactionRow';

describe('transaction row', () => {
  beforeEach(() => {
    changeLocale('en');
    usePreferenceStore.setState({ hideBalances: false });
  });

  it('keeps source accessible and renders exceptional status without repeating financial meaning', () => {
    usePreferenceStore.setState({ hideBalances: true });
    const screen = renderWithProviders(
      <TransactionRow
        title="Market"
        category="Groceries"
        date="6 Aug"
        account="Main account"
        source="Manual"
        meaning="expense"
        statusLabel="Needs review"
        amount={85}
        currency="EGP"
        categoryIcon="shopping"
      />
    );

    expect(screen.getByText('Market')).toBeTruthy();
    expect(screen.getByText('Groceries')).toBeTruthy();
    expect(screen.getByText('6 Aug')).toBeTruthy();
    expect(screen.getByText('Main account')).toBeTruthy();
    expect(
      screen.getByLabelText(
        'Market, Groceries, 6 Aug, Main account, Manual, Needs review'
      )
    ).toBeTruthy();
    expect(screen.getByText('Needs review')).toBeTruthy();
    expect(
      screen.queryByText(translate('coreFinance.meaning.expense'))
    ).toBeNull();
    expect(screen.getByText('•••• EGP')).toHaveStyle({ fontSize: 16 });
    expect(
      screen.getByTestId('transaction-category-icon-shopping')
    ).toBeTruthy();
  });

  it.each([
    ['ar', 'row-reverse', 'rtl', 'right', 'المطاعم'],
    ['en', 'row', 'ltr', 'left', 'Restaurants']
  ] as const)(
    'keeps %s content beside the leading icon',
    (locale, flexDirection, writingDirection, textAlign, category) => {
      const fontScale = jest
        .spyOn(PixelRatio, 'getFontScale')
        .mockReturnValue(1);
      changeLocale(locale);
      const screen = renderWithProviders(
        <TransactionRow
          title="Market"
          category={category}
          categoryIcon="restaurant"
          date="6 Aug"
          account="Main account"
          source="Manual"
          meaning="expense"
          statusLabel="Needs review"
          amount={85}
          currency="EGP"
        />
      );

      expect(screen.getByTestId('transaction-row')).toHaveStyle({
        writingDirection: 'ltr',
        flexDirection
      });
      expect(screen.getByTestId('transaction-row-main')).toHaveStyle({
        writingDirection
      });
      expect(screen.getByTestId('transaction-category-label')).toHaveStyle({
        textAlign,
        writingDirection
      });
      expect(screen.getByText(category)).toHaveStyle({
        fontFamily:
          locale === 'ar' ? 'MasarifiArabic-600' : 'MasarifiLatin-600',
        fontWeight: '600'
      });
      expect(screen.getByText('Market')).toHaveStyle({
        fontFamily:
          locale === 'ar' ? 'MasarifiArabic-700' : 'MasarifiLatin-700',
        fontWeight: '700'
      });
      expect(screen.getByText('6 Aug')).toHaveStyle({
        fontFamily:
          locale === 'ar' ? 'MasarifiArabic-400' : 'MasarifiLatin-400',
        fontWeight: '400'
      });
      expect(screen.getByText('Main account')).toHaveStyle({
        fontFamily: locale === 'ar' ? 'MasarifiArabic-400' : 'MasarifiLatin-400'
      });
      expect(screen.getByText('Needs review')).toHaveStyle({
        fontFamily: locale === 'ar' ? 'MasarifiArabic-400' : 'MasarifiLatin-400'
      });
      fontScale.mockRestore();
    }
  );

  it('keeps a growing column row at 200% text', () => {
    const fontScale = jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(2);
    const screen = renderWithProviders(
      <TransactionRow
        title="Market"
        category="Groceries"
        date="6 Aug"
        account="Main account"
        source="Manual"
        meaning="expense"
        amount={85}
        currency="EGP"
        groupedPosition="only"
      />
    );

    expect(screen.getByTestId('transaction-row')).toHaveStyle({
      borderRadius: 22,
      borderWidth: StyleSheet.hairlineWidth,
      flexDirection: 'column',
      minHeight: 88
    });
    expect(screen.getByTestId('transaction-row')).not.toHaveStyle({
      borderTopLeftRadius: 0
    });
    fontScale.mockRestore();
  });

  it('gives a supported large amount the full row width at normal text size', () => {
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(1);
    const screen = renderWithProviders(
      <TransactionRow
        title="Large transfer"
        category="Transfer"
        date="6 Aug"
        account="Main account"
        source="Manual"
        meaning="transfer"
        amount={999_999_999.99}
        currency="SAR"
      />
    );

    expect(screen.getByTestId('transaction-row')).toHaveStyle({
      alignItems: 'stretch',
      flexDirection: 'column'
    });
    expect(screen.getByTestId('transaction-row-amount')).toHaveStyle({
      maxWidth: '100%'
    });
    expect(screen.getByText('+999,999,999.99 SAR')).toBeTruthy();
  });

  it.each([
    [
      'first',
      {
        borderBottomWidth: 0,
        borderLeftWidth: StyleSheet.hairlineWidth,
        borderRightWidth: StyleSheet.hairlineWidth,
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        borderTopWidth: StyleSheet.hairlineWidth
      },
      true
    ],
    [
      'middle',
      {
        borderBottomWidth: 0,
        borderLeftWidth: StyleSheet.hairlineWidth,
        borderRightWidth: StyleSheet.hairlineWidth,
        borderTopWidth: 0
      },
      true
    ],
    [
      'last',
      {
        borderBottomLeftRadius: 22,
        borderBottomRightRadius: 22,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderLeftWidth: StyleSheet.hairlineWidth,
        borderRightWidth: StyleSheet.hairlineWidth,
        borderTopWidth: 0
      },
      false
    ],
    [
      'only',
      {
        borderRadius: 22,
        borderWidth: StyleSheet.hairlineWidth
      },
      false
    ]
  ] as const)(
    'owns %s continuous-card boundary and divider state',
    (groupedPosition, boundaryStyle, hasDivider) => {
      const screen = renderWithProviders(
        <TransactionRow
          title="Market"
          category="Groceries"
          categoryIcon="shopping"
          categoryColor={lightThemeColors.financial.transfer}
          date="6 Aug"
          account="Main account"
          source="Manual"
          meaning="expense"
          amount={85}
          currency="EGP"
          groupedPosition={groupedPosition}
        />
      );

      expect(screen.getByTestId('transaction-row')).toHaveStyle(boundaryStyle);
      if (hasDivider) {
        expect(screen.getByTestId('transaction-row-divider')).toBeTruthy();
      } else {
        expect(screen.queryByTestId('transaction-row-divider')).toBeNull();
      }
      expect(
        screen.getByTestId('transaction-category-icon-shopping')
      ).toHaveStyle({
        backgroundColor: lightThemeColors.iconBadges.primary.background,
        borderColor: lightThemeColors.financial.transfer
      });
    }
  );

  it('uses the shared colored visual for a stable category key', () => {
    const screen = renderWithProviders(
      <TransactionRow
        title="Market"
        category="Food"
        categoryVisualKey="food"
        date="6 Aug"
        account="Main account"
        source="Manual"
        meaning="expense"
        amount={85}
        currency="EGP"
      />
    );

    expect(screen.getByTestId('category-visual-openmoji-food')).toBeTruthy();
  });
});
