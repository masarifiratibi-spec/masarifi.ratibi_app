import React, { useState } from 'react';
import { router } from 'expo-router';
import { emptyTransactionFilters } from '@/domain/core-finance';
import type { LocalDate } from '@/domain/financial-planning';

import { StyledText } from '@/components/StyledText';
import { ActionButton } from '@/design-system/components/ActionButton';
import { FinancialPulse } from '@/design-system/components/financial/FinancialPulse';
import {
  GroupedList,
  NavigationRow
} from '@/design-system/components/navigation/GroupedList';
import { localDateInTimeZone } from '@/domain/financial-period';
import { localDateFromTimestamp } from '@/domain/financial-planning';
import {
  useTransaction,
  useInfiniteTransactions
} from '@/features/core-finance/core-finance-queries';
import {
  PlanningScreen,
  PlanningState
} from '@/features/financial-planning/PlanningScaffold';
import { TransactionDateField } from '@/features/transactions/TransactionDateField';
import { currentLocale, translate, type MessageKey } from '@/localization/i18n';
import { financialPlanningService } from '@/services/financial-planning-service';
import { useSensitiveVisibility } from '@/state/SensitiveVisibilityProvider';
import { usePreferenceStore } from '@/state/preferences';
import { formatDate, formatMinorAmount } from '@/utils/format-financial-value';
import {
  usePlanningMutation,
  useSalaryOverview,
  useSalaryProfile,
  useSalaryExpectedDates,
  useSalaryReceiptReview
} from './salary-queries';

export function SalaryReceiptReview({
  receiptId = ''
}: {
  receiptId?: string;
}) {
  return receiptId === 'select' ? (
    <SalaryIncomePicker />
  ) : (
    <SalaryReceiptDetails receiptId={receiptId} />
  );
}

function SalaryIncomePicker() {
  const profile = useSalaryProfile();
  const income = useInfiniteTransactions({
    ...emptyTransactionFilters,
    types: ['income'],
    statuses: ['posted']
  });
  const candidates =
    income.data?.pages
      .flatMap((page) => page.items)
      .filter(
        (item) =>
          item.type === 'income' &&
          item.status === 'posted' &&
          item.currencyCode === profile.data?.currencyCode &&
          (!profile.data.receivingAccountId ||
            item.accountId === profile.data.receivingAccountId)
      ) ?? [];
  return (
    <PlanningScreen titleKey="planning.salary.confirmReceipt">
      <StyledText>
        {translate('planning.salary.selectRecordedIncome')}
      </StyledText>
      {income.isLoading || profile.isLoading ? (
        <PlanningState state="loading" />
      ) : income.isError || profile.isError ? (
        <PlanningState
          state="error"
          onRetry={() => {
            void income.refetch();
            void profile.refetch();
          }}
        />
      ) : (
        <>
          {!candidates.length ? (
            <PlanningState state="empty" />
          ) : (
            <GroupedList label={translate('planning.salary.detectedIncome')}>
              {candidates.map((item) => (
                <NavigationRow
                  key={item.id}
                  label={item.title}
                  value={formatMinorAmount(
                    item.amountMinor,
                    item.currencyCode,
                    currentLocale()
                  )}
                  onPress={() => router.replace(`/salary/receipt/${item.id}`)}
                />
              ))}
            </GroupedList>
          )}
          {income.hasNextPage ? (
            <ActionButton
              label={translate('planning.salary.loadMoreIncome')}
              loading={income.isFetchingNextPage}
              onPress={() => {
                void income.fetchNextPage();
              }}
              variant="secondary"
            />
          ) : null}
        </>
      )}
    </PlanningScreen>
  );
}

function SalaryReceiptDetails({ receiptId }: { receiptId: string }) {
  const timeZone = usePreferenceStore((state) => state.timeZone);
  const today = localDateInTimeZone(Date.now(), timeZone);
  const receipt = useSalaryReceiptReview(receiptId);
  const salary = useSalaryOverview(today, timeZone);
  const transaction = useTransaction(
    receipt.data?.transactionId ?? (receipt.isLoading ? '' : receiptId)
  );
  const profile = useSalaryProfile();
  const dates = useSalaryExpectedDates();
  const hideBalances = usePreferenceStore((state) => state.hideBalances);
  const { revealed } = useSensitiveVisibility();
  const [expectedDate, setExpectedDate] = useState<LocalDate>();
  const receivedDate = transaction.data
    ? localDateInTimeZone(transaction.data.occurredAt, timeZone)
    : today;
  const suggestedDate = dates.data
    ?.slice()
    .sort(
      (a, b) =>
        Math.abs(Date.parse(a) - Date.parse(receivedDate)) -
        Math.abs(Date.parse(b) - Date.parse(receivedDate))
    )[0];
  const selectedDate = expectedDate ?? suggestedDate;
  const eligible =
    transaction.data?.type === 'income' &&
    transaction.data.status === 'posted' &&
    transaction.data.currencyCode === profile.data?.currencyCode &&
    (!profile.data.receivingAccountId ||
      transaction.data.accountId === profile.data.receivingAccountId);
  const [error, setError] = useState<string>();
  const confirm = usePlanningMutation(
    (
      input: Parameters<typeof financialPlanningService.confirmSalaryReceipt>[0]
    ) =>
      financialPlanningService.confirmSalaryReceipt(
        input,
        `salary-receipt:${receiptId}:${Date.now()}`
      )
  );
  const undo = usePlanningMutation((id: string) =>
    financialPlanningService.undoSalaryReceipt(
      id,
      `salary-receipt-undo:${id}:${Date.now()}`,
      timeZone
    )
  );

  const confirmReceipt = () => {
    if (
      !salary.data?.profileId ||
      !receiptId ||
      !eligible ||
      !selectedDate ||
      !dates.data?.includes(selectedDate)
    ) {
      setError(translate('planning.state.error'));
      return;
    }
    confirm.mutate(
      {
        salaryProfileId: salary.data.profileId,
        transactionId: receiptId,
        expectedOccurrenceDate: selectedDate,
        receivedDate,
        timeZone
      },
      { onError: () => setError(translate('planning.state.error')) }
    );
  };

  const receiptAmount = transaction.data
    ? hideBalances && !revealed
      ? translate('planning.state.hidden')
      : formatMinorAmount(
          transaction.data.amountMinor,
          transaction.data.currencyCode,
          currentLocale()
        )
    : receipt.data
      ? translate(
          `planning.receipt.status.${receipt.data.status}` as MessageKey
        )
      : translate('reports.state.unavailable');
  const receiptSource =
    transaction.data?.merchant ??
    transaction.data?.title ??
    receipt.data?.transactionId ??
    translate('reports.state.unavailable');

  return (
    <PlanningScreen titleKey="planning.salary.review">
      {!receiptId ? (
        <PlanningState state="empty" />
      ) : receipt.isLoading || salary.isLoading ? (
        <PlanningState state="loading" />
      ) : receipt.isError || salary.isError ? (
        <PlanningState
          state="error"
          onRetry={() => {
            void receipt.refetch();
            void salary.refetch();
          }}
        />
      ) : receipt.data ? (
        <>
          <FinancialPulse
            accessibilityLabel={`${receiptAmount}, ${receiptSource}`}
            scope={translate('planning.salary.detectedIncome')}
            statement={receiptAmount}
            supportingValue={receiptSource}
          />
          <GroupedList label={translate('planning.salary.details')}>
            <NavigationRow
              label={translate('planning.salary.transaction')}
              value={receiptSource}
            />
            <NavigationRow
              label={translate('planning.salary.expectedDate')}
              value={formatDate(
                Date.parse(`${receipt.data.expectedOccurrenceDate}T00:00:00Z`),
                currentLocale(),
                'UTC'
              )}
            />
            <NavigationRow
              label={translate('planning.salary.receivedDate')}
              value={
                receipt.data.receivedDate
                  ? formatDate(
                      Date.parse(`${receipt.data.receivedDate}T00:00:00Z`),
                      currentLocale(),
                      'UTC'
                    )
                  : '—'
              }
            />
            <NavigationRow
              label={translate('planning.field.status')}
              value={translate(
                `planning.receipt.status.${receipt.data.status}` as MessageKey
              )}
            />
          </GroupedList>
          {receipt.data.status !== 'undone' ? (
            <ActionButton
              label={translate('planning.salary.undoReceipt')}
              loading={undo.isPending}
              onPress={() =>
                undo.mutate(receipt.data!.id, {
                  onError: () => setError(translate('planning.state.error'))
                })
              }
              variant="secondary"
            />
          ) : null}
        </>
      ) : (
        <>
          <FinancialPulse
            accessibilityLabel={`${receiptAmount}, ${receiptSource}`}
            scope={translate('planning.salary.detectedIncome')}
            statement={receiptAmount}
            supportingValue={receiptSource}
          />
          <StyledText>{translate('planning.salary.confirmReceipt')}</StyledText>
          {!dates.isLoading && !dates.isError && !dates.data?.length ? (
            <StyledText>
              {translate('planning.salary.noExpectedReceipt')}
            </StyledText>
          ) : null}
          <TransactionDateField
            label={translate('planning.salary.expectedDate')}
            value={Date.parse(`${selectedDate ?? today}T12:00:00`)}
            onChange={(timestamp) =>
              setExpectedDate(localDateFromTimestamp(timestamp))
            }
          />
          <NavigationRow
            label={translate('planning.salary.receivedDate')}
            value={formatDate(
              Date.parse(`${receivedDate}T12:00:00`),
              currentLocale()
            )}
          />
          <ActionButton
            label={translate('planning.salary.confirmReceipt')}
            disabled={
              !eligible ||
              !selectedDate ||
              dates.isLoading ||
              dates.isError ||
              !dates.data?.includes(selectedDate)
            }
            loading={confirm.isPending}
            onPress={confirmReceipt}
          />
        </>
      )}
      {dates.isError && !receipt.data ? (
        <PlanningState
          state="error"
          onRetry={() => {
            void dates.refetch();
          }}
        />
      ) : null}
      {error ? (
        <StyledText accessibilityRole="alert">{error}</StyledText>
      ) : null}
    </PlanningScreen>
  );
}
