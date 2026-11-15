import React from 'react';
import {
  Dimensions,
  PixelRatio,
  Platform,
  StyleSheet,
  View
} from 'react-native';
import { fireEvent, screen } from '@testing-library/react-native';
import { AppIcon, directionalIconNames } from '@/design-system/icons';
import { PickerField } from '@/design-system/components/forms/PickerField';
import { SelectionScreen } from '@/design-system/components/selection/SelectionScreen';
import { FinancialPulse } from '@/design-system/components/financial/FinancialPulse';
import { AccountListScreen } from '@/features/accounts/AccountListScreen';
import { AccountDetailScreen } from '@/features/accounts/AccountDetailScreen';
import { AccountScopeSheet } from '@/features/accounts/AccountScopeSheet';
import { CategoryForm } from '@/features/categories/CategoryForm';
import { CategoryListScreen } from '@/features/categories/CategoryListScreen';
import { CategorySelectionScreen } from '@/features/categories/CategorySelectionScreen';
import { CurrencySelectionScreen } from '@/features/settings/CurrencySelectionScreen';
import { ProfilePhoneScreen } from '@/features/settings/ProfilePhoneScreen';
import { SalaryProfileForm } from '@/features/salary/SalaryProfileForm';
import { AssistantSuggestedQuestions } from '@/features/assistant/components/AssistantSuggestedQuestions';
import { DateRangeSheet } from '@/features/filters/DateRangeSheet';
import { ReportDrillDownScreen } from '@/features/reports/ReportDrillDownScreen';
import { reportsService } from '@/services/reports-service';
import { useReportsViewState } from '@/state/reports-view-state';
import { todayPeriod } from '@/features/filters/date-period';
import { coreFinanceKeys } from '@/features/core-finance/core-finance-queries';
import { financialPlanningKeys } from '@/features/financial-planning/financial-planning-queries';
import { changeLocale, translate, translateDynamic } from '@/localization/i18n';
import {
  fixtureAccounts,
  fixtureCategories
} from '@/test-utils/core-finance-fixtures';
import { renderWithQueryData } from '@/test-utils/render';
import {
  nativeColumnEdge,
  nativeLayoutDirection,
  nativeRowFlow,
  nativeTextAlignment,
  nearestStyledAncestor
} from '@/test-utils/native-direction';
import { settingsKeys } from '@/features/settings/settings-queries';
import { createMockSettingsService } from '@/services/mocks/subscription-settings-service';
import type { UserProfile } from '@/domain/settings';
import { emptyTransactionFilters } from '@/domain/core-finance';

jest.mock('expo-router', () => {
  const router = { back: jest.fn(), push: jest.fn(), replace: jest.fn() };
  return { router, useRouter: () => router };
});
jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: () => null,
  DateTimePickerAndroid: { open: jest.fn() }
}));
jest.mock('expo-symbols', () => ({
  SymbolView: (props: Record<string, unknown>) => {
    const ReactActual = jest.requireActual<typeof React>('react');
    const { View: NativeView } =
      jest.requireActual<typeof import('react-native')>('react-native');
    return ReactActual.createElement(NativeView, props);
  }
}));

const originalPlatform = Platform.OS;
const seeds = () => [
  [coreFinanceKeys.accounts(), fixtureAccounts],
  [coreFinanceKeys.accounts(true), fixtureAccounts],
  [coreFinanceKeys.account(fixtureAccounts[0].id), fixtureAccounts[0]],
  [coreFinanceKeys.accountBalances(true), []],
  [coreFinanceKeys.accountBalances(false), []],
  [coreFinanceKeys.transactions({
    ...emptyTransactionFilters, accountIds: [fixtureAccounts[0].id]
  }), { items: [], nextCursor: null, total: 0 }],
  [coreFinanceKeys.categories(), fixtureCategories],
  [coreFinanceKeys.categories(true), fixtureCategories],
  [financialPlanningKeys.salaryProfile(), null]
] as const;
let profile: UserProfile;
const open = (component: React.ReactElement) =>
  renderWithQueryData(component, [...seeds(), [settingsKeys.profile(), profile]]);

beforeEach(async () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  profile = await createMockSettingsService().getProfile();
});
afterEach(() => {
  jest.restoreAllMocks();
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: originalPlatform
  });
  changeLocale('ar');
});

describe.each(['ar', 'en'] as const)('iOS %s direction audit', (locale) => {
  const direction = locale === 'ar' ? 'rtl' : 'ltr';
  const edge = locale === 'ar' ? 'right' : 'left';
  beforeEach(() => changeLocale(locale));

  it('keeps shared picker values on the reading edge', () => {
    open(
      <PickerField
        label={translate('coreFinance.accounts.currency')}
        placeholder={translate('coreFinance.categoryPicker.title')}
        onPress={jest.fn()}
      />
    );
    expect(
      nativeTextAlignment(
        screen.getByText(translate('coreFinance.categoryPicker.title'))
      )
    ).toBe(edge);
  });

  it('keeps shared selection title and subtitle on the reading edge', () => {
    open(
      <SelectionScreen
        title="Audit title"
        subtitle="Audit subtitle"
        items={[]}
        onSelect={jest.fn()}
      />
    );
    expect(nativeTextAlignment(screen.getByText('Audit title'))).toBe(edge);
    expect(nativeTextAlignment(screen.getByText('Audit subtitle'))).toBe(edge);
  });

  it('keeps financial statement and support placement on the reading edge', () => {
    open(
      <FinancialPulse
        statement="1,250.50 SAR"
        scope="Scope"
        supportingValue="Audit support"
      />
    );
    expect(
      nativeTextAlignment(screen.getByTestId('financial-pulse-statement'))
    ).toBe(edge);
    expect(nativeTextAlignment(screen.getByText('Audit support'))).toBe(edge);
    expect(
      StyleSheet.flatten(
        screen.getByTestId('financial-pulse-statement').props.style
      ).writingDirection
    ).toBe('ltr');
  });

  it('keeps the account hero labels on the reading edge', () => {
    open(<AccountDetailScreen id={fixtureAccounts[0].id} />);
    expect(
      nativeTextAlignment(
        screen.getByText(translate('coreFinance.accounts.balanceCurrent'))
      )
    ).toBe(edge);
    expect(
      nativeTextAlignment(
        screen.getByText(translate('coreFinance.accounts.balanceCalculated'))
      )
    ).toBe(edge);
  });

  it('keeps account-sheet navigation labels on the reading edge', () => {
    open(<AccountScopeSheet visible onDismiss={jest.fn()} />);
    expect(
      nativeTextAlignment(
        screen.getByText(translate('coreFinance.home.manageAccounts'))
      )
    ).toBe(edge);
    expect(
      nativeTextAlignment(
        screen.getByText(translate('coreFinance.home.allAccounts'))
      )
    ).toBe(edge);
  });

  it('keeps category form labels on the reading edge', () => {
    open(<CategoryForm />);
    expect(
      nativeTextAlignment(
        screen.getByText(translate('coreFinance.categories.groupName'))
      )
    ).toBe(edge);
    expect(
      nativeTextAlignment(
        screen.getByText(translate('coreFinance.filters.type'))
      )
    ).toBe(edge);
  });

  it('keeps category picker section headings on the reading edge', () => {
    open(
      <CategorySelectionScreen
        excludedIds={[]}
        onBack={jest.fn()}
        onSelect={jest.fn()}
        selectedId="food"
      />
    );
    expect(
      nativeTextAlignment(
        screen.getByText(translate('coreFinance.categoryPicker.others'))
      )
    ).toBe(edge);
  });

  it('keeps the category-list title on the reading edge', () => {
    open(<CategoryListScreen />);
    expect(
      nativeTextAlignment(
        screen.getByText(locale === 'ar' ? 'الفئات' : 'Categories')
      )
    ).toBe(edge);
  });

  it('keeps report breakdown questions on the reading edge', async () => {
    useReportsViewState.setState({
      followToday: false,
      anchorDate: '2026-08-08',
      selectedKind: 'monthly'
    });
    const getReport = jest.spyOn(reportsService, 'getReport');
    open(<ReportDrillDownScreen />);
    await screen.findByTestId('report-drill-down-row-0');
    const report = await getReport.mock.results[0].value;
    expect(
      nativeTextAlignment(
        screen.getByText(translateDynamic(report.breakdowns[0].questionKey))
      )
    ).toBe(edge);
  });

  it('keeps date instructions and duration prose on the reading edge', () => {
    open(
      <DateRangeSheet
        visible
        period={todayPeriod(Date.UTC(2026, 10, 16), {
          timeZone: 'Asia/Riyadh',
          monthStartDay: 1
        })}
        onApply={jest.fn()}
        onDismiss={jest.fn()}
      />
    );
    expect(
      nativeTextAlignment(
        screen.getByText(translate('coreFinance.home.period.instruction'))
      )
    ).toBe(edge);
    fireEvent.press(screen.getByTestId('date-period-option-custom'));
    expect(
      nativeTextAlignment(
        screen.getByText(
          translateDynamic('coreFinance.home.period.duration', { count: 1 })
        )
      )
    ).toBe(edge);
  });

  it('keeps the accounts search row in the locale reading order', () => {
    open(<AccountListScreen />);
    const row = nearestStyledAncestor(
      screen.getByTestId('accounts-list-search'),
      'flexDirection'
    );
    expect(nativeRowFlow(row)).toBe(direction);
  });

  it('keeps the currency-name block beside its leading flag', () => {
    open(<CurrencySelectionScreen />);
    const label = screen.getByText(
      locale === 'ar' ? 'الريال السعودي' : 'Saudi Riyal'
    );
    const block = nearestStyledAncestor(label, 'alignItems');
    expect(
      nativeColumnEdge(block, StyleSheet.flatten(block.props.style).alignItems)
    ).toBe(edge);
  });

  it('keeps salary settings prose on the reading edge', async () => {
    open(<SalaryProfileForm />);
    const subtitle = await screen.findByText(
      translate('planning.salary.setupSubtitle')
    );
    expect(nativeTextAlignment(subtitle)).toBe(edge);
  });

  it('keeps the salary toggle copy at the column reading start', async () => {
    open(<SalaryProfileForm />);
    const label = await screen.findByText(
      translate('planning.salary.automaticDetection')
    );
    const column = nearestStyledAncestor(label, 'alignItems');
    expect(
      nativeColumnEdge(
        column,
        StyleSheet.flatten(column.props.style).alignItems
      )
    ).toBe(edge);
  });

  it('does not impose directional mirroring on universal icons', () => {
    open(
      <View style={{ direction: 'ltr' }}>
        <AppIcon
          name="search"
          direction={direction}
          label="Search"
          testID="search-icon"
        />
      </View>
    );
    expect(
      nativeLayoutDirection(screen.getByTestId('search-icon-symbol'))
    ).toBe('ltr');
    expect(screen.getByTestId('search-icon-symbol').props.name.ios).toBe(
      'magnifyingglass'
    );
  });

  it('keeps the actual saved phone a complete LTR run', () => {
    open(<ProfilePhoneScreen />);
    expect(
      StyleSheet.flatten(screen.getByText('+966500000000').props.style)
        .writingDirection
    ).toBe('ltr');
  });

  it('keeps the missing-phone fallback in the locale direction', () => {
    profile = { ...profile, phone: null };
    open(<ProfilePhoneScreen />);
    const label = screen.getByText(
      translateDynamic('settings.profile.phone.notSet')
    );
    expect(nativeTextAlignment(label)).toBe(edge);
    expect(StyleSheet.flatten(label.props.style).writingDirection).toBe(
      direction
    );
  });

  it('keeps custom-date back action at reading start', () => {
    open(
      <DateRangeSheet
        visible
        period={todayPeriod(Date.UTC(2026, 10, 16), {
          timeZone: 'Asia/Riyadh',
          monthStartDay: 1
        })}
        onApply={jest.fn()}
        onDismiss={jest.fn()}
      />
    );
    fireEvent.press(screen.getByTestId('date-period-option-custom'));
    const back = screen.getByRole('button', {
      name: translate('appShell.navigation.back')
    });
    expect(
      nativeColumnEdge(back, StyleSheet.flatten(back.props.style).alignSelf)
    ).toBe(edge);
  });

  it.each(directionalIconNames)(
    'gives the %s SF symbol the explicit app direction inside an LTR row',
    (name) => {
      open(
        <View style={{ direction: 'ltr' }}>
          <AppIcon
            name={name}
            direction={direction}
            label="Navigation"
            testID="navigation-icon"
          />
        </View>
      );
      expect(
        nativeLayoutDirection(screen.getByTestId('navigation-icon-symbol'))
      ).toBe(direction);
    }
  );

  it('derives an unspecified directional icon from the iOS app language', () => {
    open(
      <View style={{ direction: 'ltr' }}>
        <AppIcon name="chevronEnd" label="Open" testID="implicit-icon" />
      </View>
    );
    expect(
      nativeLayoutDirection(screen.getByTestId('implicit-icon-symbol'))
    ).toBe(direction);
  });

  it.each([
    [320, 1],
    [390, 2]
  ] as const)(
    'keeps vertical question order at width%s and fontScale%s',
    (width, fontScale) => {
      jest
        .spyOn(Dimensions, 'get')
        .mockReturnValue({ width, height: 800, scale: 3, fontScale });
      jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(fontScale);
      open(<AssistantSuggestedQuestions onSelectQuestion={jest.fn()} />);
      expect(
        screen.getAllByRole('button').map((node) => node.props.testID)
      ).toEqual([
        'suggestion-card-spending',
        'suggestion-card-highest',
        'suggestion-card-weekly',
        'suggestion-card-budget'
      ]);
    }
  );
});
