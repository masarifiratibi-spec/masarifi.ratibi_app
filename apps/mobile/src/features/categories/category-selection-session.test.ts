import { router } from 'expo-router';

import {
  cancelCategorySelection,
  completeCategorySelection,
  getCategorySelectionSession,
  openCategorySelection
} from './category-selection-session';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

beforeEach(() => jest.clearAllMocks());

it('opens the canonical route and completes a request once', () => {
  const onSelect = jest.fn();
  const requestId = openCategorySelection({
    excludedIds: ['transfers'],
    selectedId: 'food',
    onSelect
  });

  expect(router.push).toHaveBeenCalledWith({
    pathname: '/category-picker',
    params: { requestId }
  });
  expect(getCategorySelectionSession(requestId)).toMatchObject({
    excludedIds: ['transfers'],
    selectedId: 'food'
  });
  expect(completeCategorySelection(requestId, 'shopping')).toBe(true);
  expect(completeCategorySelection(requestId, 'health')).toBe(false);
  expect(onSelect).toHaveBeenCalledTimes(1);
  expect(onSelect).toHaveBeenCalledWith('shopping');
});

it('cancels without changing the origin', () => {
  const onSelect = jest.fn();
  const requestId = openCategorySelection({ onSelect });

  expect(cancelCategorySelection(requestId)).toBe(true);
  expect(cancelCategorySelection(requestId)).toBe(false);
  expect(completeCategorySelection(requestId, 'food')).toBe(false);
  expect(onSelect).not.toHaveBeenCalled();
});

it('supports an explicit no-category result for parent selection', () => {
  const onSelect = jest.fn();
  const requestId = openCategorySelection({ allowClear: true, onSelect });

  expect(completeCategorySelection(requestId, null)).toBe(true);
  expect(onSelect).toHaveBeenCalledWith(null);
});
