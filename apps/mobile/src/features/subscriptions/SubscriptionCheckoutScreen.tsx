import React from 'react';
import { ScrollView } from 'react-native';
import { router } from 'expo-router';

import { ActionButton } from '@/design-system/components/ActionButton';
import { ConfirmationDialog } from '@/design-system/components/overlays/ConfirmationDialog';
import type { SubscriptionOffer } from '@/domain/subscriptions';
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

  if (catalog.isLoading || state.isLoading) return <StyledText>subscriptions.state.loading</StyledText>;
  if (catalog.isError || state.isError || !catalog.data || !state.data) return <StyledText>subscriptions.state.error</StyledText>;
  const offer = (catalog.data.offers as SubscriptionOffer[]).find((item) => item.offerId === offerId);
  if (!offer || state.data.catalogVersion !== catalog.data.version) return <StyledText>subscriptions.checkout.changed</StyledText>;

  return (
    <ScrollView contentContainerStyle={{ gap: 12, padding: 16 }}>
      <StyledText variant="title">{translateDynamic(`subscriptions.plan.${offer.plan}`)}</StyledText>
      <StyledText>{priceFor(offer)}</StyledText>
      <StyledText>{translateDynamic('subscriptions.checkout.catalogVersion', { version: catalog.data.version })}</StyledText>
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
  return translateDynamic('subscriptions.price', {
    amount: (offer.priceMinor / 100).toFixed(2),
    currency: offer.currency,
    period: translateDynamic(`subscriptions.period.${offer.billingPeriod}`)
  });
}
