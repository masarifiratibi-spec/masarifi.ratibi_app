import React from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryObserver } from '@tanstack/react-query';

import { FoundationProviders } from '@/state/FoundationProviders';
import { changeLocale, translate } from '@/localization/i18n';
import { coreFinanceKeys } from '@/features/core-finance/core-finance-queries';
import { coreFinanceService } from '@/services/mocks/core-finance-service';
import { renderWithProviders, renderWithQueryData } from '@/test-utils/render';
import { CategoryForm } from './CategoryForm';
import { GroupFormModal } from './GroupFormModal';
import { CategoryListScreen } from './CategoryListScreen';
import type { Category } from '@/domain/core-finance';
import { render } from '@testing-library/react-native';
import { usePreferenceStore } from '@/state/preferences';
import { useAppShellStore } from '@/state/app-shell';
import { authenticatedSession } from '@/test-utils/app-shell-fixtures';
import {
  categoryMutationOwner,
  publishCategoryMutation
} from './publish-category-mutation';

beforeEach(() => {
  changeLocale('en');
  usePreferenceStore.setState({
    locale: 'en',
    direction: 'ltr',
    hydrated: true
  });
});

it('does not publish a late category save into another account cache', async () => {
  const previous = useAppShellStore.getState().session;
  const client = new QueryClient();
  try {
    useAppShellStore.setState({
      session: { ...authenticatedSession, userId: 'owner-a' }
    });
    const ownerId = categoryMutationOwner();
    const { value: category } = await coreFinanceService.createCategory({
      labelAr: 'قديم',
      labelEn: 'Old owner save',
      financialType: 'expense'
    });
    useAppShellStore.setState({
      session: { ...authenticatedSession, userId: 'owner-b' }
    });
    client.setQueryData(coreFinanceKeys.categories(true), []);
    await expect(
      publishCategoryMutation(
        client,
        { value: category, affectedScopes: ['categories.list'] },
        ownerId
      )
    ).rejects.toMatchObject({ code: 'session_expired' });
    expect(client.getQueryData(coreFinanceKeys.categories(true))).toEqual([]);
  } finally {
    client.clear();
    useAppShellStore.setState({ session: previous });
  }
});

afterEach(() => changeLocale('ar'));

it.each(['category', 'group'] as const)(
  'shows the saved %s and closes without waiting for a slow background refresh',
  async (kind) => {
    changeLocale('en');
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: Infinity, gcTime: Infinity }
      }
    });
    const initial = await coreFinanceService.listCategories(true);
    client.setQueryData(coreFinanceKeys.categories(true), initial);
    client.setQueryData(
      coreFinanceKeys.categories(false),
      initial.filter((category) => category.status === 'active')
    );
    let completeRefresh!: (categories: Category[]) => void;
    const response = new Promise<Category[]>((resolve) => {
      completeRefresh = resolve;
    });
    const observer = new QueryObserver(client, {
      queryKey: coreFinanceKeys.categories(true),
      queryFn: () => response
    });
    const unsubscribe = observer.subscribe(() => undefined);
    const saved = jest.fn();
    const close = jest.fn();
    const name = `Slow refresh ${kind}`;
    const view = render(
      <FoundationProviders client={client}>
        {kind === 'category' ? (
          <CategoryForm onSuccess={saved} />
        ) : (
          <GroupFormModal visible onClose={close} onCreated={saved} />
        )}
      </FoundationProviders>
    );
    fireEvent.changeText(
      screen.getByPlaceholderText(
        translate(
          kind === 'category'
            ? 'coreFinance.categories.categoryNamePlaceholder'
            : 'coreFinance.categories.groupNamePlaceholder'
        )
      ),
      name
    );
    fireEvent.press(
      screen.getByLabelText(translate('coreFinance.categories.save'))
    );
    try {
      await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
      for (const includeArchived of [false, true])
        expect(
          client.getQueryData<Category[]>(
            coreFinanceKeys.categories(includeArchived)
          )
        ).toEqual(
          expect.arrayContaining([expect.objectContaining({ labelEn: name })])
        );
      if (kind === 'group') expect(close).toHaveBeenCalledTimes(1);
    } finally {
      await act(async () => {
        completeRefresh(await coreFinanceService.listCategories(true));
      });
      view.unmount();
      unsubscribe();
      client.clear();
    }
  }
);

it.each(['category', 'group'] as const)(
  'saves a %s once when Save is tapped twice in the same frame',
  async (kind) => {
    changeLocale('en');
    const saved = jest.fn();
    const name = `Rapid save ${kind}`;
    renderWithProviders(
      kind === 'category' ? (
        <CategoryForm onSuccess={saved} />
      ) : (
        <GroupFormModal visible onClose={jest.fn()} onCreated={saved} />
      )
    );
    fireEvent.changeText(
      screen.getByPlaceholderText(
        translate(
          kind === 'category'
            ? 'coreFinance.categories.categoryNamePlaceholder'
            : 'coreFinance.categories.groupNamePlaceholder'
        )
      ),
      name
    );
    const save = screen.getByLabelText(
      translate('coreFinance.categories.save')
    );
    act(() => {
      fireEvent.press(save);
      fireEvent.press(save);
    });
    await waitFor(() => expect(saved).toHaveBeenCalled());
    expect(
      (await coreFinanceService.listCategories(true)).filter(
        (category) => category.labelEn === name
      )
    ).toHaveLength(1);
    expect(saved).toHaveBeenCalledTimes(1);
  }
);

it('creates a compatible group when moving an income category into a new group', async () => {
  changeLocale('en');
  const { value: income } = await coreFinanceService.createCategory({
    labelAr: 'دخل اختبار',
    labelEn: 'Income move audit',
    financialType: 'income'
  });
  renderWithQueryData(<CategoryListScreen />, [
    [
      coreFinanceKeys.categories(true),
      await coreFinanceService.listCategories(true)
    ],
    [coreFinanceKeys.transactions(), { items: [], nextCursor: null, total: 0 }]
  ]);
  fireEvent.changeText(
    screen.getByLabelText(translate('coreFinance.categories.search')),
    income.labelEn
  );
  fireEvent.press(
    screen.getByLabelText(
      `${translate('coreFinance.categories.moveToGroup')}: ${income.labelEn}`
    ),
    { stopPropagation: jest.fn() }
  );
  fireEvent.press(
    screen.getByLabelText(translate('coreFinance.categories.newGroup'))
  );
  expect(screen.getByLabelText(/Income selected/i)).toBeTruthy();
  expect(screen.queryByLabelText(/Expense available/i)).toBeNull();
  fireEvent.changeText(
    screen.getByPlaceholderText(
      translate('coreFinance.categories.groupNamePlaceholder')
    ),
    'Income audit group'
  );
  fireEvent.press(
    screen.getByLabelText(translate('coreFinance.categories.save'))
  );
  await waitFor(async () => {
    const categories = await coreFinanceService.listCategories(true);
    const group = categories.find(
      (category) => category.labelEn === 'Income audit group'
    );
    expect(group?.financialType).toBe('income');
    expect(
      categories.find((category) => category.id === income.id)?.parentId
    ).toBe(group?.id);
  });
});
