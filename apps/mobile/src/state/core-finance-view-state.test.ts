import { useCoreFinanceViewState } from './core-finance-view-state';

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
