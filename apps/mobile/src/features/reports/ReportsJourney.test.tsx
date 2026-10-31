import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { act, fireEvent, waitFor, within } from '@testing-library/react-native';
import { notifyManager } from '@tanstack/react-query';
import { router } from 'expo-router';

import { darkThemeColors, lightThemeColors } from '@/design-system/tokens';
import { changeLocale } from '@/localization/i18n';
import { financialPlanningService } from '@/services/mocks/financial-planning-service';
import { coreFinanceService } from '@/services/mocks/core-finance-service';
import { translate } from '@/localization/i18n';
import { useReportsViewState } from '@/state/reports-view-state';
import { renderWithProviders } from '@/test-utils/render';
import { ReportsScreen } from './ReportsScreen';
import { useCoreFinanceViewState } from '@/state/core-finance-view-state';
import { reportsService } from '@/services/reports-service';
import { usePreferenceStore } from '@/state/preferences';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() }
}));

beforeAll(() => {
  notifyManager.setNotifyFunction((callback) => act(callback));
});

test.each(['ar', 'en'] as const)(
  'offers the current PDF download without a report history destination in %s',
  async (locale) => {
    changeLocale(locale);
    const view = renderWithProviders(<ReportsScreen />);
    expect(
      await view.findByRole('button', {
        name: locale === 'ar' ? 'إرسال تقرير PDF إلى بريدي' : 'Email report PDF'
      })
    ).toBeTruthy();
    expect(
      view.queryByRole('button', {
        name: locale === 'ar' ? 'سجل تقارير PDF' : 'PDF report history'
      })
    ).toBeNull();
  }
);

afterAll(() => {
  notifyManager.setNotifyFunction((callback) => callback());
});

test.each(['ar', 'en'] as const)(
  'keeps the original circular PDF action above clear scroll space during report failure in %s',
  async (locale) => {
    changeLocale(locale);
    const summary = jest
      .spyOn(reportsService, 'getReport')
      .mockRejectedValue(new Error('offline'));
    try {
      const view = renderWithProviders(<ReportsScreen />);
      const button = await view.findByRole('button', {
        name: locale === 'ar' ? 'إرسال تقرير PDF إلى بريدي' : 'Email report PDF'
      });
      const scroll = view.UNSAFE_getByType(ScrollView);
      expect(
        within(scroll).queryByRole('button', {
          name:
            locale === 'ar' ? 'إرسال تقرير PDF إلى بريدي' : 'Email report PDF'
        })
      ).toBeNull();
      expect(button).toHaveStyle({ width: 56, height: 56, borderRadius: 28 });
      expect(view.getByTestId('reports-pdf-overlay')).toHaveProp(
        'pointerEvents',
        'box-none'
      );
      expect(
        StyleSheet.flatten(view.getByTestId('reports-pdf-overlay').props.style)
      ).toMatchObject({
        position: 'absolute',
        right: 16,
        direction: 'ltr',
        alignItems: 'flex-end'
      });
      expect(
        StyleSheet.flatten(scroll.props.contentContainerStyle).paddingBottom
      ).toBeGreaterThanOrEqual(72);
      expect(
        StyleSheet.flatten(scroll.props.contentContainerStyle).paddingBottom
      ).toBeLessThanOrEqual(88);
      expect(view.queryByTestId('reports-pdf-dock')).toBeNull();
      expect(view.queryByText(translate('reports.pdf.download'))).toBeNull();
      expect(
        view.queryByRole('button', {
          name: locale === 'ar' ? 'تصدير البيانات' : 'Export Data'
        })
      ).toBeNull();
      expect(
        view.queryByText(translate('settings.privacy.localDelete'))
      ).toBeNull();
    } finally {
      summary.mockRestore();
    }
  }
);

test('keeps report cards, headings and financial values readable in the dark theme', async () => {
  changeLocale('en');
  usePreferenceStore.setState({ theme: 'dark' });
  const view = renderWithProviders(<ReportsScreen onBack={jest.fn()} />);
  try {
    await view.findByText('Net worth');
    expect(view.getByTestId('reports-net-worth')).toHaveStyle({
      backgroundColor: darkThemeColors.surfaces.card
    });
    expect(view.getByText(translate('reports.analytics.title'))).toHaveStyle({
      color: darkThemeColors.content.primary
    });
    expect(view.getAllByText('SAR')[0]).toHaveStyle({
      color: darkThemeColors.content.primary
    });
  } finally {
    view.unmount();
    usePreferenceStore.setState({ theme: 'system' });
  }
});

test('reports restricts the picker to monthly periods and refreshes its selection after a cycle preference change', async () => {
  const previous = usePreferenceStore.getState().monthStartDay;
  const clock = jest
    .spyOn(Date, 'now')
    .mockReturnValue(Date.UTC(2026, 7, 9, 12));
  changeLocale('en');
  usePreferenceStore.setState({ monthStartDay: 1, timeZone: 'Asia/Riyadh' });
  useReportsViewState.setState({
    followToday: false,
    anchorDate: '2026-08-09',
    selectedKind: 'monthly'
  });
  const view = renderWithProviders(<ReportsScreen />);
  try {
    fireEvent.press(await view.findByRole('button', { name: 'August 2026' }));
    expect(view.queryByTestId('date-period-option-today')).toBeNull();
    expect(
      view.getByTestId('date-period-option-thisMonth')
    ).toHaveAccessibilityState({ selected: true });
    act(() => usePreferenceStore.setState({ monthStartDay: 25 }));
    expect(
      view.getByTestId('date-period-option-thisMonth')
    ).toHaveAccessibilityState({ selected: true });
  } finally {
    view.unmount();
    usePreferenceStore.setState({ monthStartDay: previous });
    clock.mockRestore();
  }
});

test('keeps the complete cycle heading stable when the same non-calendar month is selected again', async () => {
  const previous = usePreferenceStore.getState().monthStartDay;
  const clock = jest
    .spyOn(Date, 'now')
    .mockReturnValue(Date.UTC(2026, 7, 29, 12));
  changeLocale('en');
  usePreferenceStore.setState({ monthStartDay: 25, timeZone: 'Asia/Riyadh' });
  useReportsViewState.setState({
    followToday: false,
    anchorDate: '2026-08-29',
    selectedKind: 'monthly'
  });
  const view = renderWithProviders(<ReportsScreen />);
  const heading = '25 August – 24 September 2026';
  try {
    fireEvent.press(await view.findByRole('button', { name: heading }));
    fireEvent.press(view.getByTestId('date-period-option-thisMonth'));
    expect(view.getByRole('button', { name: heading })).toBeTruthy();
  } finally {
    view.unmount();
    usePreferenceStore.setState({ monthStartDay: previous });
    clock.mockRestore();
  }
});

test.each(['ar', 'en'] as const)(
  'keeps trend dates aligned with the chronological SVG axis in %s',
  async (locale) => {
    changeLocale(locale);
    useReportsViewState.setState({
      followToday: false,
      anchorDate: '2026-08-09',
      selectedKind: 'monthly',
      scrollOffset: 0
    });
    const view = renderWithProviders(<ReportsScreen />);
    const axis = await view.findByTestId('reports-trend-dates');
    const format = new Intl.DateTimeFormat(`${locale}-u-nu-latn`, {
      day: 'numeric',
      month: 'short',
      timeZone: 'Asia/Riyadh'
    });
    expect(
      within(axis)
        .getAllByText(/.+/)
        .map((node) => node.props.children)
    ).toEqual([
      format.format(Date.UTC(2026, 7, 1, 12)),
      format.format(Date.UTC(2026, 7, 9, 12))
    ]);
    expect(axis).toHaveStyle({ direction: 'ltr', flexDirection: 'row' });
  }
);

test('shows a retryable trend failure while the financial report remains usable', async () => {
  changeLocale('en');
  const spy = jest
    .spyOn(coreFinanceService, 'listTransactions')
    .mockRejectedValue(new Error('Unavailable'));
  try {
    const view = renderWithProviders(<ReportsScreen />);
    expect(await view.findByText('Cash flow')).toBeTruthy();
    expect(
      await view.findByRole('button', {
        name: translate('reports.action.retry')
      })
    ).toBeTruthy();
    expect(view.queryByText(translate('reports.state.loading'))).toBeNull();
  } finally {
    spy.mockRestore();
  }
});

test('2026-08-23 approved analytics screen exposes the reference hierarchy in Arabic', async () => {
  changeLocale('ar');
  useReportsViewState.setState({
    followToday: false,
    anchorDate: '2026-08-09',
    selectedKind: 'monthly',
    scrollOffset: 0
  });
  const screen = renderWithProviders(<ReportsScreen onBack={jest.fn()} />);

  expect(await screen.findByText('صافي الثروة')).toBeTruthy();
  expect(screen.UNSAFE_getByType(ScrollView).props.style).toEqual({
    backgroundColor: lightThemeColors.surfaces.page
  });
  expect(screen.getByText('التحليلات')).toBeTruthy();
  expect(screen.getByLabelText('كل الحسابات')).toBeTruthy();
  expect(screen.getByText('كل الحسابات').props.numberOfLines).toBeUndefined();
  expect(screen.getByLabelText('أغسطس 2026')).toBeTruthy();
  expect(screen.getByText('التدفق المالي')).toBeTruthy();
  expect(screen.getByText('نسبة التوفير')).toBeTruthy();
  expect(screen.getByText('الميزانية')).toBeTruthy();
  expect(screen.getByText('تعيين الميزانية الشهرية')).toBeTruthy();
  expect(screen.getByTestId('reports-assistant-card')).toBeTruthy();
  expect(screen.getByText('المساعد الذكي')).toBeTruthy();
  expect(
    screen.getByText('مساعدك المالي الذكي للإجابة على أسئلتك المالية بسرعة.')
  ).toBeTruthy();
  expect(
    screen.getByTestId('reports-assistant-icon', {
      includeHiddenElements: true
    })
  ).toBeTruthy();
  expect(screen.getByText('اشرح هذا التقرير')).toBeTruthy();
  for (const suggestion of [
    'لماذا زادت المصروفات؟',
    'أين يمكنني التوفير؟',
    'قارن هذه الفترة',
    'أنشئ خطة ادخار'
  ]) {
    expect(screen.getByText(suggestion)).toHaveStyle({ textAlign: 'center' });
  }
  for (const timeframe of ['1W', '1M', '3M', '1Y', 'All']) {
    expect(screen.getByRole('button', { name: timeframe })).toBeTruthy();
  }
});

test('report AI action opens the assistant with the current report context', async () => {
  changeLocale('ar');
  useReportsViewState.setState({
    followToday: false,
    anchorDate: '2026-08-09'
  });
  const screen = renderWithProviders(<ReportsScreen />);

  fireEvent.press(
    await screen.findByRole('button', { name: 'اشرح هذا التقرير' })
  );

  expect(router.push).toHaveBeenLastCalledWith({
    pathname: '/assistant',
    params: {
      action: 'explain',
      reportKey: 'monthly:2026-08-09:SAR:Asia/Riyadh',
      reportContext: JSON.stringify({
        startDate: '2026-08-01',
        endDate: '2026-08-31',
        currencyCode: 'SAR',
        accountName: null
      }),
      returnTo: '/(tabs)/reports'
    }
  });
});

test('shows the financial report and assistant before unrelated balances finish loading', async () => {
  changeLocale('en');
  const spy = jest
    .spyOn(coreFinanceService, 'getHomeSummary')
    .mockImplementation(() => new Promise(() => {}));
  try {
    const view = renderWithProviders(<ReportsScreen />);
    expect(await view.findByText('Cash flow')).toBeTruthy();
    expect(
      view.getByRole('button', { name: 'Explain this report' })
    ).toBeTruthy();
    expect(view.queryByLabelText('0.00 SAR')).toBeNull();
  } finally {
    spy.mockRestore();
  }
});

test('keeps the report usable when balances fail and can open analysis from the assistant heading', async () => {
  changeLocale('en');
  const spy = jest
    .spyOn(coreFinanceService, 'getHomeSummary')
    .mockRejectedValue(new Error('Balances unavailable'));
  try {
    const view = renderWithProviders(<ReportsScreen />);
    expect(await view.findByText('Cash flow')).toBeTruthy();
    fireEvent.press(
      view.getByRole('button', { name: translate('assistant.hero.title') })
    );
    expect(router.push).toHaveBeenLastCalledWith(
      expect.objectContaining({ pathname: '/assistant' })
    );
  } finally {
    spy.mockRestore();
  }
});

test('report analysis preserves the selected account and the report period', async () => {
  changeLocale('en');
  const before = useCoreFinanceViewState.getState().selectedAccountId;
  const accounts = await coreFinanceService.listAccounts(false);
  const account = accounts.find((candidate) => candidate.status === 'active')!;
  useCoreFinanceViewState.setState({ selectedAccountId: account.id });
  useReportsViewState.setState({
    followToday: false,
    anchorDate: '2026-08-09'
  });
  try {
    const view = renderWithProviders(<ReportsScreen />);
    await view.findByText(account.name);
    fireEvent.press(
      await view.findByRole('button', { name: 'Explain this report' })
    );
    const target = jest.mocked(router.push).mock.calls.at(-1)?.[0] as any;
    expect(JSON.parse(target.params.reportContext)).toEqual({
      startDate: '2026-08-01',
      endDate: '2026-08-31',
      currencyCode: 'SAR',
      accountName: account.name
    });
  } finally {
    useCoreFinanceViewState.setState({ selectedAccountId: before });
  }
});

test('keeps scoped assistant analysis available when an account report fails', async () => {
  changeLocale('en');
  const before = useCoreFinanceViewState.getState().selectedAccountId;
  const accounts = await coreFinanceService.listAccounts(false);
  const account = accounts[0];
  expect(account).toBeDefined();
  useCoreFinanceViewState.setState({ selectedAccountId: account.id });
  const spy = jest
    .spyOn(reportsService, 'getReport')
    .mockRejectedValue(
      Object.assign(new Error('Unsupported scope'), {
        code: 'report_account_scope_unavailable'
      })
    );
  try {
    const view = renderWithProviders(<ReportsScreen />);
    expect(
      await view.findByText(translate('reports.state.error'))
    ).toBeTruthy();
    fireEvent.press(view.getByRole('button', { name: 'Explain this report' }));
    const target = jest.mocked(router.push).mock.calls.at(-1)?.[0] as any;
    expect(JSON.parse(target.params.reportContext).accountName).toBe(
      account.name
    );
  } finally {
    spy.mockRestore();
    useCoreFinanceViewState.setState({ selectedAccountId: before });
  }
});

test('uses the selected EGP account currency across report values and assistant analysis', async () => {
  changeLocale('en');
  const before = useCoreFinanceViewState.getState().selectedAccountId;
  const accounts = await coreFinanceService.listAccounts(false);
  const account = { ...accounts[0], currencyCode: 'EGP' };
  const spy = jest
    .spyOn(coreFinanceService, 'listAccounts')
    .mockResolvedValue([account]);
  useCoreFinanceViewState.setState({ selectedAccountId: account.id });
  useReportsViewState.setState({
    followToday: false,
    anchorDate: '2026-08-09'
  });
  try {
    const view = renderWithProviders(<ReportsScreen />);
    await view.findByText(account.name);
    await view.findByText('Cash flow');
    expect(view.getAllByText('EGP').length).toBeGreaterThan(0);
    fireEvent.press(view.getByRole('button', { name: 'Explain this report' }));
    const target = jest.mocked(router.push).mock.calls.at(-1)?.[0] as any;
    expect(JSON.parse(target.params.reportContext)).toEqual({
      startDate: '2026-08-01',
      endDate: '2026-08-31',
      currencyCode: 'EGP',
      accountName: account.name
    });
  } finally {
    spy.mockRestore();
    act(() => useCoreFinanceViewState.setState({ selectedAccountId: before }));
  }
});

test('unavailable report metrics remain unavailable instead of becoming zero amounts', async () => {
  changeLocale('en');
  const original = reportsService.getReport.bind(reportsService);
  const spy = jest
    .spyOn(reportsService, 'getReport')
    .mockImplementation(async (input) => {
      const report = await original(input);
      return {
        ...report,
        summary: {
          ...report.summary,
          income: {
            status: 'unavailable',
            value: null,
            reason: 'source_incomplete'
          },
          expense: {
            status: 'unavailable',
            value: null,
            reason: 'source_incomplete'
          },
          netCashFlow: {
            status: 'unavailable',
            value: null,
            reason: 'source_incomplete'
          },
          savingsRateBasisPoints: {
            status: 'unavailable',
            value: null,
            reason: 'source_incomplete'
          }
        }
      };
    });
  try {
    const view = renderWithProviders(<ReportsScreen />);
    expect(await view.findByText('Cash flow')).toBeTruthy();
    expect(
      view.getAllByLabelText(translate('reports.state.unavailable')).length
    ).toBeGreaterThanOrEqual(3);
  } finally {
    spy.mockRestore();
  }
});

test('approved analytics screen exposes the equivalent hierarchy in English', async () => {
  changeLocale('en');
  const screen = renderWithProviders(<ReportsScreen />);

  expect(await screen.findByText('Net worth')).toBeTruthy();
  expect(screen.getByText('Analytics')).toBeTruthy();
  expect(screen.getByLabelText('All Accounts')).toBeTruthy();
  expect(screen.getByText('All Accounts').props.numberOfLines).toBeUndefined();
  expect(screen.getByText('Cash flow')).toBeTruthy();
  expect(screen.getByText('Savings rate')).toBeTruthy();
  expect(screen.getByText('Budget')).toBeTruthy();
  expect(screen.getByText('Explain this report')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: '3M' }));
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: '3M' }).props.accessibilityState
    ).toEqual({ selected: true })
  );
});

test('budget card shows the aggregate remaining value when the month has budgets', async () => {
  changeLocale('en');
  useReportsViewState.setState({
    followToday: false,
    anchorDate: '2033-08-09',
    selectedKind: 'monthly',
    scrollOffset: 0
  });
  await financialPlanningService.saveBudget(
    {
      name: 'Client presentation',
      periodKey: '2033-08',
      currencyCode: 'SAR',
      configuredExpenseLimitMinor: 1_000_00,
      incomeTargetMinor: 0,
      savingsTargetMinor: 0,
      categories: []
    },
    'report-budget-card-2033-08'
  );

  const screen = renderWithProviders(<ReportsScreen />);

  expect(await screen.findByText('Budget remaining')).toBeTruthy();
  expect(screen.getByText(/1,000\.00/)).toBeTruthy();
});

test('2026-08-10 native regression preserves report scroll context after drill-down navigation', async () => {
  changeLocale('en');
  useReportsViewState.setState({ scrollOffset: 0 });
  const first = renderWithProviders(<ReportsScreen />);
  await first.findByText('Explain this report');

  fireEvent(first.UNSAFE_getByType(ScrollView), 'momentumScrollEnd', {
    nativeEvent: { contentOffset: { x: 0, y: 640 } }
  });
  expect(useReportsViewState.getState().scrollOffset).toBe(640);
  first.unmount();

  const returned = renderWithProviders(<ReportsScreen />);
  await returned.findByText('Explain this report');
  expect(returned.UNSAFE_getByType(ScrollView).props.contentOffset).toEqual({
    x: 0,
    y: 640
  });
});
