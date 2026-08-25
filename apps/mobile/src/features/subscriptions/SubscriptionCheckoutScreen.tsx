import React from 'react';
import { ScrollView } from 'react-native';
import { router } from 'expo-router';

import { ActionButton } from '@/design-system/components/ActionButton';
import { StateView } from '@/design-system/components/feedback/StateView';
import { GroupedList, NavigationRow } from '@/design-system/components/navigation/GroupedList';
import { ConfirmationDialog } from '@/design-system/components/overlays/ConfirmationDialog';
import type { SubscriptionOffer } from '@/domain/subscriptions';
import { formatMinorAmount } from '@/utils/format-financial-value';
import { useStartSubscriptionOperation, useSubscriptionCatalog, useSubscriptionState } from './subscription-queries';
import { StyledText } from '@/components/StyledText';
import { translateDynamic } from '@/localization/i18n';

export function SubscriptionCheckoutScreen({ offerId }: { offerId?: string }) {
  const catalog = useSubscriptionCatalog();
  const state = useSubscriptionState();
  const start = useStartSubscriptionOperation();
  const [confirmVisible, setConfirmVisible] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  if (catalog.isLoading || state.isLoading) return <StateView state="loading" title={translateDynamic('subscriptions.state.loading')} />;
  if (catalog.isError || state.isError || !catalog.data || !state.data) return <StateView state="error" title={translateDynamic('subscriptions.state.error')} />;
  const offer = (catalog.data.offers as SubscriptionOffer[]).find((item) => item.offerId === offerId);
  if (!offer || state.data.catalogVersion !== catalog.data.version) return <StyledText>subscriptions.checkout.changed</StyledText>;

  return (
    <ScrollView contentContainerStyle={{ gap: 12, padding: 16 }}>
      <StyledText variant="title">subscriptions.checkout.title</StyledText>
      <GroupedList label={translateDynamic('subscriptions.checkout.title')}>
        <NavigationRow label={translateDynamic(`subscriptions.plan.${offer.plan}`)} value={priceFor(offer)} />
        <NavigationRow label={translateDynamic('subscriptions.checkout.catalogVersion', { version: catalog.data.version })} />
      </GroupedList>
      <StyledText>subscriptions.representative.notice</StyledText>
      {failed ? <StyledText accessibilityRole="alert">subscriptions.checkout.failed</StyledText> : null}
      <ActionButton label="subscriptions.checkout.confirm" loading={start.isPending} onPress={() => setConfirmVisible(true)} />
      <ConfirmationDialog
        visible={confirmVisible}
        title="subscriptions.checkout.confirm.title"
        message="subscriptions.checkout.confirm.message"
        confirmLabel="subscriptions.checkout.confirmNow"
        onCancel={() => setConfirmVisible(false)}
        onConfirm={() => {
          if (submitted) return;
          setSubmitted(true);
          setFailed(false);
          start.mutate(
            {
              input: { kind: offer.trial.eligible ? 'start_trial' : 'change_plan', offerId: offer.offerId, catalogVersion: catalog.data.version },
              expectedVersion: state.data.version,
              operationId: `subscription-purchase-${Date.now()}`
            },
            {
              onSuccess: (result: { value: { operationId: string } }) => router.replace(`/subscriptions/manage?operationId=${result.value.operationId}`),
              onError: () => {
                setSubmitted(false);
                setFailed(true);
              }
            }
          );
        }}
      />
    </ScrollView>
  );
}

function priceFor(offer: SubscriptionOffer) {
  const formattedAmount = formatMinorAmount(
    offer.priceMinor,
    offer.currency,
    'en'
  );
  return translateDynamic('subscriptions.price', {
    amount: formattedAmount.slice(0, -`\u00a0${offer.currency}`.length),
    currency: offer.currency,
    period: translateDynamic(`subscriptions.period.${offer.billingPeriod}`)
  });
}
