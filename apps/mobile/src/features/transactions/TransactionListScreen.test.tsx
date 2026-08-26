import React from 'react';
import { FlatList, PixelRatio } from 'react-native';
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within
} from '@testing-library/react-native';
import { router } from 'expo-router';

import {
  emptyTransactionFilters,
  type HomeSummary
} from '@/domain/core-finance';
import { coreFinanceKeys } from '@/features/core-finance/core-finance-queries';
import { monthPeriod, periodFilters } from '@/features/filters/date-period';
import { changeLocale, currentLocale, translate } from '@/localization/i18n';
import {
  fixtureAccounts,
  fixtureCategories,
  fixtureTransactions,
  makeTransaction
} from '@/test-utils/core-finance-fixtures';
import { renderWithQueryData } from '@/test-utils/render';
import { lightThemeColors } from '@/design-system/tokens';
import { TransactionListScreen } from './TransactionListScreen';
import {
  applyAccountScope,
  useCoreFinanceViewState
} from '@/state/core-finance-view-state';
import { usePreferenceStore } from '@/state/preferences';
import { coreFinanceService } from '@/services/mocks/core-finance-service';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() }
}));
jest.mock('@/features/settings/settings-queries', () => ({
  useSettingsProfile: () => ({ data: { name: 'Dana', email: null } })
}));

const homeSummary: HomeSummary = {
  totalBalanceMinor: 0,
  currencyCode: 'SAR',
  isEstimated: false,
  components: [],
  excludedAccountIds: [],
  periodIncomeMinor: 343_000,
  periodExpenseMinor: 3_527_144,
  activeAccountCount: 3,
  recentTransactions: [],
  reviewCount: 0,
  pendingSyncCount: 0,
  dataState: 'ready'
};

const summarySeed = [
  coreFinanceKeys.home('SAR', periodFilters(monthPeriod(Date.UTC(2026, 7, 1)))),
  homeSummary
] as const;

beforeEach(() => {
  jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(1);
  changeLocale('en');
  usePreferenceStore.setState({
    locale: 'en',
    direction: 'ltr',
    firstDayOfWeek: 'sunday',
    baseCurrencyCode: 'SAR',
    timeZone: 'UTC',
    hideBalances: false
  });
  useCoreFinanceViewState.getState().clearFilters();
  jest.mocked(router.push).mockClear();
  jest.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 7, 16, 12));
});

afterEach(() => jest.restoreAllMocks());

it('renders populated ledger rows from the service query', () => {
  renderWithQueryData(<TransactionListScreen />, [
    [
      coreFinanceKeys.transactionPages(emptyTransactionFilters),
      {
        pages: [
          { items: fixtureTransactions.slice(0, 2), nextCursor: null, total: 2 }
        ],
        pageParams: [null]
      }
    ],
    [coreFinanceKeys.accounts(true), fixtureAccounts],
    [coreFinanceKeys.categories(true), fixtureCategories],
    summarySeed
  ]);
  const transaction = fixtureTransactions[1];
  const account = fixtureAccounts.find(
    (item) => item.id === transaction.accountId
  )!;
  const category = fixtureCategories.find(
    (item) => item.id === transaction.categoryId
  )!;
  expect(screen.getAllByText(transaction.title).length).toBeGreaterThan(0);
  expect(screen.getAllByText(account.name).length).toBeGreaterThan(0);
  expect(
    screen.getAllByText(
      currentLocale() === 'ar' ? category.labelAr : category.labelEn
    ).length
  ).toBeGreaterThan(0);
  expect(screen.queryByText(transaction.accountId)).toBeNull();
  expect(
    screen.getAllByTestId('transaction-date-header').length
  ).toBeGreaterThan(0);
  expect(
    screen.getByTestId(`category-visual-openmoji-${category.iconKey}`)
  ).toBeTruthy();

  fireEvent.press(screen.getByText(transaction.title));
  expect(router.push).toHaveBeenCalledWith(
    `/transactions/${transaction.id}/edit`
  );
});

it('renders one continuous card per real time group', () => {
  const sameDayTransactions = fixtureTransactions.slice(0, 2).map((item) => ({
    ...item,
    occurredAt: Date.UTC(2026, 7, 16, 12)
  }));
  renderWithQueryData(<TransactionListScreen />, [
    [
      coreFinanceKeys.transactionPages(emptyTransactionFilters),
      {
        pages: [{ items: sameDayTransactions, nextCursor: null, total: 2 }],
        pageParams: [null]
      }
    ],
    [coreFinanceKeys.accounts(true), fixtureAccounts],
    [coreFinanceKeys.categories(true), fixtureCategories],
    summarySeed
  ]);

  expect(screen.getAllByTestId('transaction-row')).toHaveLength(2);
  expect(screen.getAllByTestId('transaction-row-divider')).toHaveLength(1);
  expect(screen.queryByTestId('transaction-card')).toBeNull();
  expect(screen.getAllByTestId('transaction-date-header')).toHaveLength(1);
});

it.each([
  ['en', 'ltr', 'row'],
  ['ar', 'rtl', 'row-reverse']
] as const)(
  'normalizes inherited direction before mirroring transaction rows for %s',
  (locale, direction, flexDirection) => {
    changeLocale(locale);
    usePreferenceStore.setState({ locale, direction });
    renderWithQueryData(<TransactionListScreen />, [
      [
        coreFinanceKeys.transactionPages(emptyTransactionFilters),
        {
          pages: [{ items: [], nextCursor: null, total: 0 }],
          pageParams: [null]
        }
      ],
      [coreFinanceKeys.accounts(true), fixtureAccounts],
      [coreFinanceKeys.categories(true), fixtureCategories],
      summarySeed
    ]);

    expect(screen.getByTestId('primary-shell-header')).toHaveStyle({
      writingDirection: 'ltr'
    });
    const titleActions = screen.getByTestId('transaction-toolbar-actions');
    expect(titleActions).toHaveStyle({
      writingDirection: 'ltr',
      flexDirection
    });
    expect(screen.getByTestId('transaction-header-actions')).toHaveStyle({
      writingDirection: 'ltr',
      flexDirection
    });
    expect(
      within(titleActions)
        .getAllByRole('button')
        .map((action) => action.props.testID)
    ).toEqual(['transaction-search-action', 'transaction-filter-action']);
    expect(screen.getByTestId('transaction-summary-values')).toHaveStyle({
      writingDirection: 'ltr',
      flexDirection
    });
    expect(screen.getByTestId('transaction-summary-income-header')).toHaveStyle(
      {
        writingDirection: 'ltr',
        flexDirection
      }
    );
    expect(
      screen.getByTestId('transaction-summary-expense-header')
    ).toHaveStyle({
      writingDirection: 'ltr',
      flexDirection
    });
    expect(screen.getByTestId('transaction-period-control')).toHaveStyle({
      writingDirection: 'ltr',
      flexDirection
    });
    expect(screen.queryByTestId('transaction-quick-scope-rail')).toBeNull();
    expect(screen.queryByTestId('transaction-quick-scopes')).toBeNull();

    fireEvent.press(screen.getByTestId('transaction-search-action'));
    expect(screen.getByTestId('transaction-search-control')).toHaveStyle({
      writingDirection: 'ltr',
      flexDirection
    });
  }
);

it('hides Reports and the avatar while retaining transaction actions in the shared header', () => {
  renderWithQueryData(<TransactionListScreen />, [
    [
      coreFinanceKeys.transactionPages(emptyTransactionFilters),
      { pages: [{ items: [], nextCursor: null, total: 0 }], pageParams: [null] }
    ],
    [coreFinanceKeys.accounts(true), fixtureAccounts],
    [coreFinanceKeys.categories(true), fixtureCategories],
    summarySeed
  ]);

  expect(
    screen.queryByLabelText(translate('appShell.navigation.reports'))
  ).toBeNull();
  expect(screen.queryByTestId('primary-shell-avatar')).toBeNull();
  expect(
    screen.queryByLabelText(translate('appShell.navigation.more'))
  ).toBeNull();
  const sharedCenter = screen.getByTestId('primary-shell-center');
  expect(
    within(sharedCenter).getByLabelText(translate('coreFinance.ledger.search'))
  ).toBeTruthy();
  expect(
    within(sharedCenter).getByLabelText(
      translate('designSystem.navigation.moreOptions')
    )
  ).toBeTruthy();
});

it('opens the lens search, submits it, and clears it', () => {
  renderWithQueryData(<TransactionListScreen />, [
    [
      coreFinanceKeys.transactionPages(emptyTransactionFilters),
      { pages: [{ items: [], nextCursor: null, total: 0 }], pageParams: [null] }
    ],
    [
      coreFinanceKeys.transactionPages({
        ...emptyTransactionFilters,
        search: 'coffee'
      }),
      { pages: [{ items: [], nextCursor: null, total: 0 }], pageParams: [null] }
    ],
    [coreFinanceKeys.accounts(true), fixtureAccounts],
    [coreFinanceKeys.categories(true), fixtureCategories],
    summarySeed
  ]);

  expect(
    screen.queryByPlaceholderText(translate('coreFinance.ledger.search'))
  ).toBeNull();
  fireEvent.press(
    screen.getByLabelText(translate('coreFinance.ledger.search'))
  );
  const search = screen.getByPlaceholderText(
    translate('coreFinance.ledger.search')
  );
  fireEvent.changeText(search, 'coffee');
  fireEvent(search, 'submitEditing');
  expect(useCoreFinanceViewState.getState().filters.search).toBe('coffee');
  fireEvent.press(
    screen.getByLabelText(translate('coreFinance.ledger.clearSearch'))
  );
  expect(useCoreFinanceViewState.getState().filters.search).toBe('');
});

it.each([
  ['en', 'ltr', 'MasarifiLatin-400'],
  ['ar', 'rtl', 'MasarifiArabic-400']
] as const)(
  'uses semantic %s typography for search and summary',
  (locale, direction, bodyFamily) => {
    changeLocale(locale);
    usePreferenceStore.setState({ locale, direction });
    renderWithQueryData(<TransactionListScreen />, [
      [
        coreFinanceKeys.transactionPages(emptyTransactionFilters),
        {
          pages: [{ items: [], nextCursor: null, total: 0 }],
          pageParams: [null]
        }
      ],
      [coreFinanceKeys.accounts(true), fixtureAccounts],
      [coreFinanceKeys.categories(true), fixtureCategories],
      summarySeed
    ]);

    const searchLabel = translate('coreFinance.ledger.search');
    expect(screen.getByText(translate('coreFinance.home.income'))).toHaveStyle({
      fontFamily: bodyFamily
    });

    fireEvent.press(screen.getByTestId('transaction-search-action'));
    expect(screen.getByPlaceholderText(searchLabel)).toHaveStyle({
      fontFamily: bodyFamily
    });
  }
);

it('applies compact quick sort and type choices immediately', () => {
  const initial = {
    ...emptyTransactionFilters,
    periodStart: Date.UTC(2026, 7, 1),
    periodEnd: Date.UTC(2026, 8, 1) - 1,
    sources: ['automatic' as const]
  };
  const applied = {
    ...initial,
    types: ['expense' as const],
    sort: 'amount_high' as const
  };
  useCoreFinanceViewState.setState({ filters: initial, draftFilters: initial });
  renderWithQueryData(<TransactionListScreen />, [
    [
      coreFinanceKeys.transactionPages(initial),
      { pages: [{ items: [], nextCursor: null, total: 0 }], pageParams: [null] }
    ],
    [
      coreFinanceKeys.transactionPages(applied),
      { pages: [{ items: [], nextCursor: null, total: 0 }], pageParams: [null] }
    ],
    [coreFinanceKeys.accounts(true), fixtureAccounts],
    [coreFinanceKeys.categories(true), fixtureCategories],
    summarySeed
  ]);

  fireEvent.press(
    screen.getByLabelText(translate('designSystem.navigation.moreOptions'))
  );
  const menu = screen.getByTestId('transaction-quick-filter-menu');
  expect(screen.queryByTestId('app-sheet-menu')).toBeNull();
  expect(
    within(menu).queryByText(translate('coreFinance.filters.period'))
  ).toBeNull();
  expect(
    within(menu).queryByText(translate('coreFinance.filters.accounts'))
  ).toBeNull();
  expect(
    within(menu).queryByText(translate('coreFinance.filters.sources'))
  ).toBeNull();
  expect(
    within(menu).queryByText(translate('coreFinance.filters.apply'))
  ).toBeNull();

  fireEvent.press(
    within(menu).getByText(translate('coreFinance.filters.type.expenses'))
  );
  expect(
    within(menu).getByLabelText(translate('coreFinance.filters.type.expenses'))
  ).toHaveAccessibilityState({ selected: true });
  expect(useCoreFinanceViewState.getState().filters).toMatchObject({
    periodStart: Date.UTC(2026, 7, 1),
    periodEnd: Date.UTC(2026, 8, 1) - 1,
    types: ['expense'],
    sources: ['automatic'],
    sort: 'newest'
  });
  fireEvent.press(
    within(menu).getByText(translate('coreFinance.filters.sort.amount_high'))
  );
  expect(
    within(menu).getByLabelText(
      translate('coreFinance.filters.sort.amount_high')
    )
  ).toHaveAccessibilityState({ selected: true });
  expect(screen.getByTestId('transaction-quick-filter-menu')).toBeTruthy();
  expect(useCoreFinanceViewState.getState().filters).toMatchObject({
    periodStart: Date.UTC(2026, 7, 1),
    periodEnd: Date.UTC(2026, 8, 1) - 1,
    types: ['expense'],
    sources: ['automatic'],
    sort: 'amount_high'
  });
});

it('applies a quick category without resetting the selected sort or type', () => {
  const category = fixtureCategories[0];
  const initial = {
    ...emptyTransactionFilters,
    types: ['expense' as const],
    sources: ['automatic' as const],
    sort: 'amount_high' as const
  };
  const applied = { ...initial, categoryIds: [category.id] };
  useCoreFinanceViewState.setState({ filters: initial, draftFilters: initial });
  renderWithQueryData(<TransactionListScreen />, [
    [
      coreFinanceKeys.transactionPages(initial),
      { pages: [{ items: [], nextCursor: null, total: 0 }], pageParams: [null] }
    ],
    [
      coreFinanceKeys.transactionPages(applied),
      { pages: [{ items: [], nextCursor: null, total: 0 }], pageParams: [null] }
    ],
    [coreFinanceKeys.accounts(true), fixtureAccounts],
    [coreFinanceKeys.categories(true), fixtureCategories],
    summarySeed
  ]);

  fireEvent.press(
    screen.getByLabelText(translate('designSystem.navigation.moreOptions'))
  );
  fireEvent.press(
    within(screen.getByTestId('transaction-quick-filter-menu')).getByText(
      'Category'
    )
  );
  const picker = screen.getByTestId('transaction-quick-category-picker');
  fireEvent.press(within(picker).getByText(category.labelEn));

  expect(screen.queryByTestId('transaction-quick-category-picker')).toBeNull();
  expect(useCoreFinanceViewState.getState().filters).toMatchObject({
    categoryIds: [category.id],
    types: ['expense'],
    sources: ['automatic'],
    sort: 'amount_high'
  });
});

it('keeps dense transaction list useful and mounted rows bounded', () => {
  const dense = Array.from({ length: 1_000 }, (_, index) =>
    makeTransaction(index)
  );
  renderWithQueryData(<TransactionListScreen />, [
    [
      coreFinanceKeys.transactionPages(emptyTransactionFilters),
      {
        pages: [{ items: dense, nextCursor: null, total: 1_000 }],
        pageParams: [null]
      }
    ],
    [coreFinanceKeys.accounts(true), fixtureAccounts],
    [coreFinanceKeys.categories(true), fixtureCategories],
    summarySeed
  ]);

  expect(screen.getAllByText(dense[0].title).length).toBeGreaterThan(0);
  expect(screen.queryByText(dense[999].title)).toBeNull();
  expect(
    screen.UNSAFE_getAllByType(
      require('@/design-system/components/financial/TransactionRow')
        .TransactionRow
    ).length
  ).toBeLessThan(100);
});

it('deduplicates records accumulated across cursor pages', () => {
  renderWithQueryData(<TransactionListScreen />, [
    [
      coreFinanceKeys.transactionPages(emptyTransactionFilters),
      {
        pages: [
          {
            items: fixtureTransactions.slice(0, 2),
            nextCursor: 'next',
            total: 3
          },
          { items: fixtureTransactions.slice(1, 3), nextCursor: null, total: 3 }
        ],
        pageParams: [null, 'next']
      }
    ],
    [coreFinanceKeys.accounts(true), fixtureAccounts],
    [coreFinanceKeys.categories(true), fixtureCategories],
    summarySeed
  ]);

  expect(screen.getAllByText(fixtureTransactions[1].title)).toHaveLength(1);
  expect(screen.getByText(fixtureTransactions[2].title)).toBeTruthy();
  const list = screen.UNSAFE_getByType(FlatList);
  const keys = list.props.data.map(list.props.keyExtractor);
  expect(new Set(keys).size).toBe(keys.length);
});

it('shows next-page progress and error before retrying the page', async () => {
  const nextTransaction = makeTransaction(900, { id: 'next-page-transaction' });
  let rejectNextPage!: (reason: Error) => void;
  const pendingPage = new Promise<never>((_resolve, reject) => {
    rejectNextPage = reject;
  });
  jest
    .spyOn(coreFinanceService, 'listTransactions')
    .mockImplementationOnce(() => pendingPage)
    .mockResolvedValueOnce({
      items: [nextTransaction],
      nextCursor: null,
      total: 2
    });

  renderWithQueryData(<TransactionListScreen />, [
    [
      coreFinanceKeys.transactionPages(emptyTransactionFilters),
      {
        pages: [
          { items: [fixtureTransactions[0]], nextCursor: 'page-2', total: 2 }
        ],
        pageParams: [null]
      }
    ],
    [coreFinanceKeys.accounts(true), fixtureAccounts],
    [coreFinanceKeys.categories(true), fixtureCategories],
    summarySeed
  ]);

  fireEvent(screen.UNSAFE_getByType(FlatList), 'onEndReached');
  expect(
    await screen.findByLabelText(translate('coreFinance.state.loading'))
  ).toBeTruthy();

  await act(async () => {
    rejectNextPage(new Error('next page unavailable'));
  });
  expect(
    await screen.findByRole('alert', {
      name: translate('coreFinance.state.error')
    })
  ).toBeTruthy();

  fireEvent.press(
    screen.getByRole('button', {
      name: translate('coreFinance.action.retry')
    })
  );
  expect(await screen.findByText(nextTransaction.title)).toBeTruthy();
});

it('shows category and type descriptors after removing the quick-scope rail', () => {
  useCoreFinanceViewState.getState().editFilters({
    categoryIds: ['food'],
    types: ['transfer']
  });
  useCoreFinanceViewState.getState().applyFilters();
  const filters = useCoreFinanceViewState.getState().filters;
  renderWithQueryData(<TransactionListScreen />, [
    [
      coreFinanceKeys.transactionPages(filters),
      { pages: [{ items: [], nextCursor: null, total: 0 }], pageParams: [null] }
    ],
    [coreFinanceKeys.accounts(true), fixtureAccounts],
    [coreFinanceKeys.categories(true), fixtureCategories],
    summarySeed
  ]);

  expect(
    screen.getByRole('button', {
      name: `${translate('designSystem.action.remove')} ${translate('coreFinance.filters.categories')}: 1`
    })
  ).toBeTruthy();
  expect(
    screen.getByRole('button', {
      name: `${translate('designSystem.action.remove')} ${translate('coreFinance.filters.types')}: 1`
    })
  ).toBeTruthy();
});

it('shows account scope beside the period when one active account exists', () => {
  renderWithQueryData(<TransactionListScreen />, [
    [
      coreFinanceKeys.transactionPages(emptyTransactionFilters),
      { pages: [{ items: [], nextCursor: null, total: 0 }], pageParams: [null] }
    ],
    [coreFinanceKeys.accounts(true), [fixtureAccounts[0]]],
    [coreFinanceKeys.categories(true), fixtureCategories],
    summarySeed
  ]);

  const filterBar = screen.getByTestId('transaction-filter-bar');
  expect(
    within(filterBar).getByTestId('transaction-account-scope')
  ).toBeTruthy();
  expect(
    within(filterBar).getByTestId('transaction-period-control')
  ).toBeTruthy();
});

it.each([
  ['periodStart', 'coreFinance.filters.periodStart'],
  ['periodEnd', 'coreFinance.filters.periodEnd']
] as const)(
  'clears the complete period when removing the %s chip after the final review regression',
  (_periodKey, labelKey) => {
    const july = monthPeriod(Date.UTC(2026, 6, 1));
    const august = monthPeriod(Date.UTC(2026, 7, 1));
    const initialFilters = {
      ...emptyTransactionFilters,
      periodStart: july.periodStart,
      periodEnd: july.periodEnd,
      sources: ['manual' as const]
    };
    const defaultPeriodFilters = {
      ...emptyTransactionFilters,
      sources: ['manual' as const]
    };
    const defaultPeriodTransaction = makeTransaction(911, {
      id: `default-period-${_periodKey}`,
      title: `Default period ${_periodKey}`,
      occurredAt: Date.UTC(2026, 7, 16, 10)
    });
    useCoreFinanceViewState.setState({
      filters: initialFilters,
      draftFilters: initialFilters
    });

    renderWithQueryData(<TransactionListScreen />, [
      [
        coreFinanceKeys.transactionPages(initialFilters),
        {
          pages: [{ items: [], nextCursor: null, total: 0 }],
          pageParams: [null]
        }
      ],
      [
        coreFinanceKeys.transactionPages(defaultPeriodFilters),
        {
          pages: [
            { items: [defaultPeriodTransaction], nextCursor: null, total: 1 }
          ],
          pageParams: [null]
        }
      ],
      [coreFinanceKeys.accounts(true), fixtureAccounts],
      [coreFinanceKeys.categories(true), fixtureCategories],
      [
        coreFinanceKeys.home('SAR', periodFilters(july)),
        { ...homeSummary, periodIncomeMinor: 11_100 }
      ],
      [
        coreFinanceKeys.home('SAR', periodFilters(august)),
        { ...homeSummary, periodIncomeMinor: 22_200 }
      ]
    ]);

    fireEvent.press(
      screen.getByRole('button', {
        name: `${translate('designSystem.action.remove')} ${translate(labelKey)}`
      })
    );

    expect(useCoreFinanceViewState.getState().filters).toMatchObject({
      periodStart: null,
      periodEnd: null,
      sources: ['manual']
    });
    expect(screen.getByText('August 2026')).toBeTruthy();
    expect(screen.getByText('+222.00 SAR')).toBeTruthy();
    expect(screen.getByText(defaultPeriodTransaction.title)).toBeTruthy();
  }
);

it('renders the approved light composition independently of filters', () => {
  useCoreFinanceViewState.getState().editFilters({ sources: ['manual'] });
  useCoreFinanceViewState.getState().applyFilters();
  const filters = useCoreFinanceViewState.getState().filters;

  renderWithQueryData(<TransactionListScreen />, [
    [
      coreFinanceKeys.transactionPages(filters),
      { pages: [{ items: [], nextCursor: null, total: 0 }], pageParams: [null] }
    ],
    [coreFinanceKeys.accounts(true), fixtureAccounts],
    [coreFinanceKeys.categories(true), fixtureCategories],
    summarySeed
  ]);

  expect(screen.getByText('August 2026')).toBeTruthy();
  expect(screen.queryByTestId('transactions-horizon-hero')).toBeNull();
  expect(screen.getByTestId('transactions-page-header')).toHaveStyle({
    backgroundColor: lightThemeColors.surfaces.page
  });
  expect(
    within(screen.getByTestId('primary-shell-center')).getByLabelText(
      translate('coreFinance.ledger.search')
    )
  ).toBeTruthy();
  expect(
    within(screen.getByTestId('primary-shell-center')).getByLabelText(
      translate('designSystem.navigation.moreOptions')
    )
  ).toBeTruthy();
  expect(screen.getByTestId('transaction-period-control')).toHaveStyle({
    alignSelf: 'center'
  });
  expect(screen.getByText(translate('coreFinance.home.income'))).toBeTruthy();
  expect(screen.getByText(translate('coreFinance.home.expense'))).toBeTruthy();
  expect(screen.getByText('+3,430.00 SAR')).toBeTruthy();
  expect(screen.getByText('-35,271.44 SAR')).toBeTruthy();
  expect(screen.getByTestId('transaction-summary-income')).toBeTruthy();
  expect(screen.getByTestId('transaction-summary-expense')).toBeTruthy();
  expect(screen.getByTestId('transaction-search-action')).toBeTruthy();
  expect(screen.getByTestId('transaction-filter-action')).toBeTruthy();
  expect(screen.getByTestId('transaction-account-scope')).toBeTruthy();
  expect(screen.queryByTestId('transaction-quick-scope-rail')).toBeNull();
  expect(screen.queryByTestId('transaction-quick-scopes')).toBeNull();
  expect(
    screen.getByText(translate('appShell.security.protectedContent'))
  ).toBeTruthy();
});

it('uses semantic cards without text-glyph trend arrows', () => {
  renderWithQueryData(<TransactionListScreen />, [
    [
      coreFinanceKeys.transactionPages(emptyTransactionFilters),
      { pages: [{ items: [], nextCursor: null, total: 0 }], pageParams: [null] }
    ],
    [coreFinanceKeys.accounts(true), fixtureAccounts],
    [coreFinanceKeys.categories(true), fixtureCategories],
    summarySeed
  ]);

  const incomeCard = screen.getByTestId('transaction-summary-income');
  const expenseCard = screen.getByTestId('transaction-summary-expense');

  expect(incomeCard).toHaveStyle({
    backgroundColor: lightThemeColors.financial.incomeSurface,
    borderColor: lightThemeColors.borders.subtle
  });
  expect(expenseCard).toHaveStyle({
    backgroundColor: lightThemeColors.financial.expenseSurface,
    borderColor: lightThemeColors.borders.subtle
  });
  expect(within(incomeCard).getByText('+3,430.00 SAR')).toHaveStyle({
    color: lightThemeColors.financial.income
  });
  expect(within(expenseCard).getByText('-35,271.44 SAR')).toHaveStyle({
    color: lightThemeColors.financial.expense
  });
  expect(screen.queryByText('↗')).toBeNull();
  expect(screen.queryByText('↘')).toBeNull();
});

it('stacks both monthly summary values at 200% text', () => {
  jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(2);
  renderWithQueryData(<TransactionListScreen />, [
    [
      coreFinanceKeys.transactionPages(emptyTransactionFilters),
      { pages: [{ items: [], nextCursor: null, total: 0 }], pageParams: [null] }
    ],
    [coreFinanceKeys.accounts(true), fixtureAccounts],
    [coreFinanceKeys.categories(true), fixtureCategories],
    summarySeed
  ]);

  expect(screen.getByTestId('transaction-summary-values')).toHaveStyle({
    flexDirection: 'column'
  });
  expect(screen.getByTestId('transaction-filter-bar')).toHaveStyle({
    alignItems: 'stretch',
    flexDirection: 'column'
  });
  expect(screen.getByTestId('transaction-account-scope')).toHaveStyle({
    height: 'auto',
    minHeight: 52
  });
  expect(screen.getByTestId('transaction-period-control')).toHaveStyle({
    height: 'auto',
    minHeight: 52
  });
  expect(
    screen
      .getAllByTestId(/^transaction-summary-(income|expense)$/)
      .map((metric) => metric.props.testID)
  ).toEqual(['transaction-summary-income', 'transaction-summary-expense']);
});

it('gives supported large summary amounts full-width cards at normal text size', () => {
  const largeSummary = {
    ...homeSummary,
    periodIncomeMinor: 99_999_999_999,
    periodExpenseMinor: 99_999_999_999
  };
  renderWithQueryData(<TransactionListScreen />, [
    [
      coreFinanceKeys.transactionPages(emptyTransactionFilters),
      { pages: [{ items: [], nextCursor: null, total: 0 }], pageParams: [null] }
    ],
    [coreFinanceKeys.accounts(true), fixtureAccounts],
    [coreFinanceKeys.categories(true), fixtureCategories],
    [
      coreFinanceKeys.home(
        'SAR',
        periodFilters(monthPeriod(Date.UTC(2026, 7, 1)))
      ),
      largeSummary
    ]
  ]);

  expect(screen.getByTestId('transaction-summary-values')).toHaveStyle({
    writingDirection: 'ltr',
    flexDirection: 'column'
  });
  expect(screen.getByText('+999,999,999.99 SAR')).toBeTruthy();
  expect(screen.getByText('-999,999,999.99 SAR')).toBeTruthy();
});

it('opens the shared period flow and preserves unrelated transaction filters', async () => {
  const july = monthPeriod(Date.UTC(2026, 6, 1));
  const september = monthPeriod(Date.UTC(2026, 8, 1));
  const filters = {
    ...emptyTransactionFilters,
    periodStart: july.periodStart,
    periodEnd: july.periodEnd,
    sources: ['manual' as const]
  };
  const septemberFilters = {
    ...filters,
    periodStart: september.periodStart,
    periodEnd: september.periodEnd
  };
  useCoreFinanceViewState.setState({ filters, draftFilters: filters });

  renderWithQueryData(<TransactionListScreen />, [
    [
      coreFinanceKeys.transactionPages(filters),
      { pages: [{ items: [], nextCursor: null, total: 0 }], pageParams: [null] }
    ],
    [
      coreFinanceKeys.transactionPages(septemberFilters),
      { pages: [{ items: [], nextCursor: null, total: 0 }], pageParams: [null] }
    ],
    [coreFinanceKeys.accounts(true), fixtureAccounts],
    [coreFinanceKeys.categories(true), fixtureCategories],
    [
      coreFinanceKeys.home('SAR', periodFilters(july)),
      {
        ...homeSummary,
        periodIncomeMinor: 11_100
      }
    ],
    [
      coreFinanceKeys.home('SAR', periodFilters(september)),
      {
        ...homeSummary,
        periodIncomeMinor: 22_200
      }
    ]
  ]);

  expect(screen.getByText('July 2026')).toBeTruthy();
  expect(screen.getByText('+111.00 SAR')).toBeTruthy();
  fireEvent.press(screen.getByTestId('transaction-period-control'));
  expect(screen.getByText('Choose Date Range')).toBeTruthy();
  fireEvent.press(screen.getByTestId('date-period-option-thisMonth'));

  expect(useCoreFinanceViewState.getState().filters).toMatchObject({
    periodStart: Date.UTC(2026, 7, 1),
    periodEnd: Date.UTC(2026, 7, 17) - 1,
    sources: ['manual']
  });
  expect(screen.getByText('Aug 1, 2026 – Aug 16, 2026')).toBeTruthy();
});

it('uses shared transfer and income visuals when no category owns the row', () => {
  const transfer = makeTransaction(700, {
    id: 'transfer-mark',
    type: 'transfer',
    categoryId: null
  });
  const income = makeTransaction(701, {
    id: 'income-mark',
    type: 'income',
    categoryId: null
  });

  renderWithQueryData(<TransactionListScreen />, [
    [
      coreFinanceKeys.transactionPages(emptyTransactionFilters),
      {
        pages: [{ items: [transfer, income], nextCursor: null, total: 2 }],
        pageParams: [null]
      }
    ],
    [coreFinanceKeys.accounts(true), fixtureAccounts],
    [coreFinanceKeys.categories(true), fixtureCategories],
    summarySeed
  ]);

  expect(screen.getByTestId('category-visual-openmoji-transfers')).toBeTruthy();
  expect(screen.getByTestId('category-visual-openmoji-salary')).toBeTruthy();
});

it.each([
  ['en', 'ltr', 'row'],
  ['ar', 'rtl', 'row-reverse']
] as const)(
  'places contextual back navigation inside the mirrored %s toolbar',
  (locale, direction, flexDirection) => {
    changeLocale(locale);
    usePreferenceStore.setState({ locale, direction });
    const onBack = jest.fn();
    renderWithQueryData(<TransactionListScreen onBack={onBack} />, [
      [
        coreFinanceKeys.transactionPages(emptyTransactionFilters),
        {
          pages: [{ items: [], nextCursor: null, total: 0 }],
          pageParams: [null]
        }
      ],
      [coreFinanceKeys.accounts(true), fixtureAccounts],
      [coreFinanceKeys.categories(true), fixtureCategories],
      summarySeed
    ]);

    const header = screen.getByTestId('primary-shell-header');
    expect(header).toHaveStyle({
      writingDirection: 'ltr',
      flexDirection
    });
    fireEvent.press(
      screen.getByLabelText(translate('appShell.navigation.back'))
    );
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByLabelText(translate('appShell.navigation.reports'))
    ).toBeNull();
    expect(screen.queryByTestId('primary-shell-avatar')).toBeNull();
    expect(
      within(header)
        .getAllByRole('button')
        .map((action) => action.props.testID)
    ).toEqual([
      'primary-shell-back-action',
      'transaction-search-action',
      'transaction-filter-action'
    ]);
  }
);

it('masks both monthly summary values with the existing privacy preference', () => {
  usePreferenceStore.setState({ hideBalances: true });
  renderWithQueryData(<TransactionListScreen />, [
    [
      coreFinanceKeys.transactionPages(emptyTransactionFilters),
      { pages: [{ items: [], nextCursor: null, total: 0 }], pageParams: [null] }
    ],
    [coreFinanceKeys.accounts(true), fixtureAccounts],
    [coreFinanceKeys.categories(true), fixtureCategories],
    summarySeed
  ]);

  expect(screen.getAllByText('•••• SAR')).toHaveLength(2);
});

it('keeps the ledger available while the monthly summary loads', () => {
  jest
    .spyOn(coreFinanceService, 'getHomeSummary')
    .mockImplementationOnce(() => new Promise(() => undefined));
  renderWithQueryData(<TransactionListScreen />, [
    [
      coreFinanceKeys.transactionPages(emptyTransactionFilters),
      { pages: [{ items: [], nextCursor: null, total: 0 }], pageParams: [null] }
    ],
    [coreFinanceKeys.accounts(true), fixtureAccounts],
    [coreFinanceKeys.categories(true), fixtureCategories]
  ]);

  expect(
    screen.getAllByTestId('skeleton-block', { includeHiddenElements: true })
  ).toHaveLength(2);
  expect(screen.getByText(translate('coreFinance.ledger.empty'))).toBeTruthy();
});

it('keeps the ledger available when the monthly summary fails', async () => {
  jest
    .spyOn(coreFinanceService, 'getHomeSummary')
    .mockRejectedValueOnce(new Error('summary unavailable'));
  renderWithQueryData(<TransactionListScreen />, [
    [
      coreFinanceKeys.transactionPages(emptyTransactionFilters),
      { pages: [{ items: [], nextCursor: null, total: 0 }], pageParams: [null] }
    ],
    [coreFinanceKeys.accounts(true), fixtureAccounts],
    [coreFinanceKeys.categories(true), fixtureCategories]
  ]);

  expect(
    await screen.findByText(translate('coreFinance.ledger.summaryError'))
  ).toBeTruthy();
  expect(
    screen.getByRole('button', {
      name: translate('coreFinance.action.retry')
    })
  ).toHaveStyle({ minHeight: 44, minWidth: 44 });
  expect(screen.getByText(translate('coreFinance.ledger.empty'))).toBeTruthy();
});

describe('selected account scope', () => {
  const scopedFilters = applyAccountScope(
    emptyTransactionFilters,
    'account-wallet'
  );
  const scopedSummarySeed = [
    coreFinanceKeys.home(
      'SAR',
      applyAccountScope(
        periodFilters(monthPeriod(Date.UTC(2026, 7, 1))),
        'account-wallet'
      )
    ),
    { ...homeSummary, periodIncomeMinor: 10_000, periodExpenseMinor: 40_000 }
  ] as const;
  const walletTransactions = [
    makeTransaction(5, { accountId: 'account-wallet' }),
    makeTransaction(6, { accountId: 'account-wallet' })
  ];

  beforeEach(() => {
    useCoreFinanceViewState.getState().selectAccount(null);
  });

  it('scopes ledger rows and the monthly summary to the selected account', () => {
    useCoreFinanceViewState.getState().selectAccount('account-wallet');
    renderWithQueryData(<TransactionListScreen />, [
      [
        coreFinanceKeys.transactionPages(scopedFilters),
        {
          pages: [{ items: walletTransactions, nextCursor: null, total: 2 }],
          pageParams: [null]
        }
      ],
      [coreFinanceKeys.accounts(true), fixtureAccounts],
      [coreFinanceKeys.categories(true), fixtureCategories],
      scopedSummarySeed
    ]);

    expect(screen.getAllByTestId('transaction-row')).toHaveLength(2);
    expect(screen.getByText('Merchant 5')).toBeTruthy();
    expect(screen.queryByText('Salary')).toBeNull();
    expect(screen.getByTestId('transaction-account-scope')).toHaveTextContent(
      'Wallet'
    );
    expect(screen.getByTestId('transaction-summary-income')).toBeTruthy();
    expect(screen.getByTestId('transaction-summary-expense')).toBeTruthy();
  });

  it('combines the account scope with a date range filter', () => {
    useCoreFinanceViewState.getState().selectAccount('account-wallet');
    const dateFilters = applyAccountScope(
      {
        ...emptyTransactionFilters,
        periodStart: Date.UTC(2026, 7, 10),
        periodEnd: Date.UTC(2026, 7, 12)
      },
      'account-wallet'
    );
    useCoreFinanceViewState.setState({
      filters: {
        ...emptyTransactionFilters,
        periodStart: Date.UTC(2026, 7, 10),
        periodEnd: Date.UTC(2026, 7, 12)
      }
    });
    renderWithQueryData(<TransactionListScreen />, [
      [
        coreFinanceKeys.transactionPages(dateFilters),
        {
          pages: [
            { items: [walletTransactions[0]], nextCursor: null, total: 1 }
          ],
          pageParams: [null]
        }
      ],
      [coreFinanceKeys.accounts(true), fixtureAccounts],
      [coreFinanceKeys.categories(true), fixtureCategories],
      summarySeed
    ]);

    expect(screen.getAllByTestId('transaction-row')).toHaveLength(1);
    expect(screen.getByText('Merchant 5')).toBeTruthy();
  });

  it('combines the account scope with a type filter', () => {
    useCoreFinanceViewState.getState().selectAccount('account-wallet');
    useCoreFinanceViewState.setState({
      filters: { ...emptyTransactionFilters, types: ['expense'] }
    });
    const typeFilters = applyAccountScope(
      { ...emptyTransactionFilters, types: ['expense'] },
      'account-wallet'
    );
    renderWithQueryData(<TransactionListScreen />, [
      [
        coreFinanceKeys.transactionPages(typeFilters),
        {
          pages: [{ items: walletTransactions, nextCursor: null, total: 2 }],
          pageParams: [null]
        }
      ],
      [coreFinanceKeys.accounts(true), fixtureAccounts],
      [coreFinanceKeys.categories(true), fixtureCategories],
      summarySeed
    ]);

    expect(screen.getAllByTestId('transaction-row')).toHaveLength(2);
    expect(screen.getByText('Merchant 5')).toBeTruthy();
  });

  it('shows an account-specific empty state when the account has no transactions', () => {
    useCoreFinanceViewState.getState().selectAccount('account-wallet');
    renderWithQueryData(<TransactionListScreen />, [
      [
        coreFinanceKeys.transactionPages(scopedFilters),
        {
          pages: [{ items: [], nextCursor: null, total: 0 }],
          pageParams: [null]
        }
      ],
      [coreFinanceKeys.accounts(true), fixtureAccounts],
      [coreFinanceKeys.categories(true), fixtureCategories],
      summarySeed
    ]);

    expect(
      screen.getByText('No transactions in this account yet')
    ).toBeTruthy();
  });

  it('reconciles a stale selection back to All Accounts', async () => {
    useCoreFinanceViewState.getState().selectAccount('account-missing');
    renderWithQueryData(<TransactionListScreen />, [
      [
        coreFinanceKeys.transactionPages(emptyTransactionFilters),
        {
          pages: [
            {
              items: fixtureTransactions.slice(0, 2),
              nextCursor: null,
              total: 2
            }
          ],
          pageParams: [null]
        }
      ],
      [coreFinanceKeys.accounts(true), fixtureAccounts],
      [coreFinanceKeys.categories(true), fixtureCategories],
      summarySeed
    ]);

    await waitFor(() =>
      expect(useCoreFinanceViewState.getState().selectedAccountId).toBe(null)
    );
    expect(screen.getAllByTestId('transaction-row')).toHaveLength(2);
  });

  it.each([
    ['ar', 'row-reverse'],
    ['en', 'row']
  ] as const)(
    'mirrors the account scope control in %s',
    (locale, flexDirection) => {
      changeLocale(locale);
      usePreferenceStore.setState({
        locale,
        direction: locale === 'ar' ? 'rtl' : 'ltr'
      });
      renderWithQueryData(<TransactionListScreen />, [
        [
          coreFinanceKeys.transactionPages(emptyTransactionFilters),
          {
            pages: [{ items: [], nextCursor: null, total: 0 }],
            pageParams: [null]
          }
        ],
        [coreFinanceKeys.accounts(true), fixtureAccounts],
        [coreFinanceKeys.categories(true), fixtureCategories],
        summarySeed
      ]);

      expect(screen.getByTestId('transaction-account-scope')).toHaveStyle({
        flexDirection
      });
    }
  );
});
