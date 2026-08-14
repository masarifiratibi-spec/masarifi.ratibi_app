import React from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';

import { ActionButton } from '@/design-system/components/ActionButton';
import type { SubscriptionOffer } from '@/domain/subscriptions';
import { useStartSubscriptionOperation, useSubscriptionCatalog, useSubscriptionState } from './subscription-queries';
import { StyledText } from '@/components/StyledText';
import { translateDynamic } from '@/localization/i18n';

export function SubscriptionScreen() {
  const catalog = useSubscriptionCatalog();
  const state = useSubscriptionState();
  const start = useStartSubscriptionOperation();

  if (catalog.isLoading || state.isLoading) return <StyledText>subscriptions.state.loading</StyledText>;
  if (catalog.isError || state.isError || !catalog.data || !state.data) return <StyledText>subscriptions.state.error</StyledText>;

  const offers = catalog.data.offers as SubscriptionOffer[];
  const restoreOffer = offers.find((offer) => offer.plan !== 'free') ?? offers[0];

  return (
    <ScrollView contentContainerStyle={{ gap: 12, padding: 16 }}>
      <StyledText variant="title">{translateDynamic('subscriptions.current', { plan: planLabel(state.data.plan) })}</StyledText>
      {state.data.status === 'expired' ? <StyledText>subscriptions.state.expired</StyledText> : null}
      {state.data.paidContentAccess === 'read_only' ? <StyledText>subscriptions.access.readOnly</StyledText> : null}
      {state.data.status === 'expired' ? <StyledText>subscriptions.limit.reached</StyledText> : null}
      {offers.map((offer) => (
        <View key={offer.offerId}>
          <StyledText variant="subtitle">{planLabel(offer.plan)}</StyledText>
          <StyledText>{priceFor(offer)}</StyledText>
          {offer.features.map((feature) => <StyledText key={feature}>{feature.startsWith('subscriptions.') ? feature : `subscriptions.feature.${feature}`}</StyledText>)}
          {Object.entries(offer.limits).map(([key, value]) => <StyledText key={key}>{translateDynamic(`subscriptions.limit.${key}`, { count: value })}</StyledText>)}
          {offer.trial.eligible ? <StyledText>{translateDynamic('subscriptions.trial.eligible', { days: offer.trial.durationDays })}</StyledText> : null}
          <StyledText>{offer.renewalTermsKey}</StyledText>
          <StyledText>{offer.cancellationTermsKey}</StyledText>
          {offer.plan !== 'free' ? <ActionButton label={translateDynamic('subscriptions.action.choose', { plan: planLabel(offer.plan) })} onPress={() => router.push(`/subscriptions/checkout?offerId=${offer.offerId}`)} /> : null}
        </View>
      ))}
      <StyledText>subscriptions.representative.notice</StyledText>
      <ActionButton
        label="subscriptions.action.restore"
        onPress={() => start.mutate({
          input: { kind: 'restore', offerId: restoreOffer.offerId, catalogVersion: catalog.data.version },
          expectedVersion: state.data.version,
          operationId: `subscription-restore-${Date.now()}`
        })}
      />
      <ActionButton label="subscriptions.action.manage" variant="secondary" onPress={() => router.push('/subscriptions/manage')} />
    </ScrollView>
  );
}

function planLabel(plan: SubscriptionOffer['plan']) {
  return translateDynamic(`subscriptions.plan.${plan}`);
}

function priceFor(offer: SubscriptionOffer) {
  return translateDynamic('subscriptions.price', {
    amount: (offer.priceMinor / 100).toFixed(2),
    currency: offer.currency,
    period: translateDynamic(`subscriptions.period.${offer.billingPeriod}`)
  });
}
