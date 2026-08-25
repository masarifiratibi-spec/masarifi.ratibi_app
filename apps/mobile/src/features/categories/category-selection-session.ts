import { router } from 'expo-router';

export interface CategorySelectionOptions {
  selectedId?: string;
  excludedIds?: readonly string[];
  allowClear?: boolean;
  onSelect: (categoryId: string | null) => void;
}

export interface CategorySelectionSession extends CategorySelectionOptions {
  excludedIds: readonly string[];
}

const sessions = new Map<string, CategorySelectionSession>();
let nextRequestId = 0;

export function openCategorySelection(options: CategorySelectionOptions) {
  const requestId = `category-${++nextRequestId}`;
  sessions.set(requestId, {
    ...options,
    excludedIds: [...(options.excludedIds ?? [])]
  });
  router.push({ pathname: '/category-picker', params: { requestId } });
  return requestId;
}

export function getCategorySelectionSession(requestId: string) {
  return sessions.get(requestId);
}

export function completeCategorySelection(
  requestId: string,
  categoryId: string | null
) {
  const session = sessions.get(requestId);
  if (!session) return false;
  sessions.delete(requestId);
  session.onSelect(categoryId);
  return true;
}

export function cancelCategorySelection(requestId: string) {
  return sessions.delete(requestId);
}
