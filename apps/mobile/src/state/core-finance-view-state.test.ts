import {
  applyAccountScope,
  useCoreFinanceViewState
} from './core-finance-view-state';

beforeEach(() => {
  useCoreFinanceViewState.setState({
    selectedAccountId: null
  });
});

it('edits, applies, removes, and clears filters', () => {
  const store = useCoreFinanceViewState.getState();
  store.editFilters({ search: 'coffee' });
  useCoreFinanceViewState.getState().applyFilters();
  expect(useCoreFinanceViewState.getState().filters.search).toBe('coffee');
  useCoreFinanceViewState.getState().removeFilter('search');
  expect(useCoreFinanceViewState.getState().filters.search).toBe('');
  useCoreFinanceViewState.getState().clearFilters();
  expect(useCoreFinanceViewState.getState().filters.types).toEqual([]);
});

it('keeps draft filter sessions separate from applied filters', () => {
  useCoreFinanceViewState.setState({
    filters: emptyFilters(),
    draftFilters: emptyFilters()
  });
  useCoreFinanceViewState.getState().editFilters({ search: 'salary' });
  useCoreFinanceViewState.getState().applyFilters();
  useCoreFinanceViewState.getState().beginFilterSession();
  useCoreFinanceViewState.getState().editFilters({ search: 'coffee' });

  expect(useCoreFinanceViewState.getState().filters.search).toBe('salary');
  useCoreFinanceViewState.getState().cancelFilterSession();
  expect(useCoreFinanceViewState.getState().draftFilters.search).toBe('salary');
  useCoreFinanceViewState.getState().resetDraftFilters();
  expect(useCoreFinanceViewState.getState().draftFilters.search).toBe('');
});

function emptyFilters() {
  return {
    search: '',
    periodStart: null,
    periodEnd: null,
    accountIds: [],
    categoryIds: [],
    types: [],
    sources: [],
    statuses: [],
    syncStatuses: [],
    reviewRequired: null,
    minMinor: null,
    maxMinor: null,
    amountCurrencyCode: null,
    sort: 'newest' as const
  };
}

it('selects and clears the selected account scope', () => {
  useCoreFinanceViewState.getState().selectAccount('account-wallet');
  expect(useCoreFinanceViewState.getState().selectedAccountId).toBe(
    'account-wallet'
  );
  useCoreFinanceViewState.getState().selectAccount(null);
  expect(useCoreFinanceViewState.getState().selectedAccountId).toBe(null);
});

it('applyAccountScope returns filters untouched for All Accounts', () => {
  const filters = emptyFilters();
  expect(applyAccountScope(filters, null)).toBe(filters);
});

it('applyAccountScope scopes unfiltered filters to the selected account', () => {
  const scoped = applyAccountScope(
    { ...emptyFilters(), search: 'coffee' },
    'account-wallet'
  );
  expect(scoped.accountIds).toEqual(['account-wallet']);
  expect(scoped.search).toBe('coffee');
});

it('applyAccountScope intersects with the accountIds filter', () => {
  const scoped = applyAccountScope(
    { ...emptyFilters(), accountIds: ['account-bank', 'account-wallet'] },
    'account-wallet'
  );
  expect(scoped.accountIds).toEqual(['account-wallet']);
});

it('applyAccountScope yields a no-match scope for disjoint account filters', () => {
  const scoped = applyAccountScope(
    { ...emptyFilters(), accountIds: ['account-bank'] },
    'account-wallet'
  );
  expect(scoped.accountIds).toEqual(['account-scope-no-match']);
});

it('reconcileSelectedAccount clears stale selections and keeps valid ones', () => {
  useCoreFinanceViewState.setState({ selectedAccountId: 'account-wallet' });
  useCoreFinanceViewState
    .getState()
    .reconcileSelectedAccount(['account-bank']);
  expect(useCoreFinanceViewState.getState().selectedAccountId).toBe(null);

  useCoreFinanceViewState.getState().selectAccount('account-bank');
  useCoreFinanceViewState
    .getState()
    .reconcileSelectedAccount(['account-bank', 'account-wallet']);
  expect(useCoreFinanceViewState.getState().selectedAccountId).toBe(
    'account-bank'
  );
});
