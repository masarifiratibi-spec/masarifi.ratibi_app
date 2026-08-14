import React from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';

import { ActionButton } from '@/design-system/components/ActionButton';
import type { SubscriptionOffer, SubscriptionOperation } from '@/domain/subscriptions';
import { useCompleteSubscriptionOperation, useExpireSubscriptionPeriod, useStartSubscriptionOperation, useSubscriptionCatalog, useSubscriptionOperation, useSubscriptionState } from './subscription-queries';
import { StyledText } from '@/components/StyledText';
import { translateDynamic } from '@/localization/i18n';

export function SubscriptionManageScreen({ operationId }: { operationId?: string }) {
  const state = useSubscriptionState();
  const catalog = useSubscriptionCatalog();
  const operation = useSubscriptionOperation(operationId);
  const start = useStartSubscriptionOperation();
  const complete = useCompleteSubscriptionOperation();
  const expire = useExpireSubscriptionPeriod();
  const [activeOperation, setActiveOperation] = React.useState<SubscriptionOperation | null>(null);

  if (state.isLoading || catalog.isLoading) return <StyledText>subscriptions.state.loading</StyledText>;
  if (state.isError || catalog.isError || !state.data || !catalog.data) return <StyledText>subscriptions.state.error</StyledText>;

  const offers = catalog.data.offers as SubscriptionOffer[];
  const currentOffer = offers.find((offer) => offer.offerId === state.data.offerId) ?? offers[0];
  const changeOffer = offers.find((offer) => offer.offerId !== state.data.offerId && offer.plan !== 'free');
  const visibleOperation = activeOperation ?? operation.data;
  const busy = start.isPending || complete.isPending || expire.isPending || visibleOperation?.status === 'pending';

  return (
    <ScrollView contentContainerStyle={{ gap: 12, padding: 16 }}>
      <StyledText variant="title">{translateDynamic('subscriptions.manage.current', { plan: state.data.plan })}</StyledText>
      <StyledText>{`subscriptions.manage.status.${state.data.status}`}</StyledText>
      {state.data.renewsAt ? <StyledText>{translateDynamic('subscriptions.manage.renewsAt', { date: new Date(state.data.renewsAt).toISOString().slice(0, 10) })}</StyledText> : null}
      <StyledText>{state.data.paidContentAccess === 'read_only' ? 'subscriptions.access.readOnly' : 'subscriptions.access.editable'}</StyledText>
      <StyledText>subscriptions.representative.notice</StyledText>
      {visibleOperation ? (
        <View>
          <StyledText>{`subscriptions.operation.${visibleOperation.status}`}</StyledText>
          {visibleOperation.status === 'review' || visibleOperation.status === 'pending' ? (
            <ActionButton label="subscriptions.operation.continue" loading={complete.isPending} disabled={busy && !complete.isPending} onPress={() => complete.mutate({ operationId: visibleOperation.operationId, outcome: 'success' }, { onSuccess: (result: { value: SubscriptionOperation }) => setActiveOperation(result.value) })} />
          ) : null}
        </View>
      ) : null}
      <ActionButton label="subscriptions.manage.restore" loading={start.isPending} disabled={busy} onPress={() => start.mutate({ input: { kind: 'restore', offerId: currentOffer.offerId, catalogVersion: currentOffer.catalogVersion }, expectedVersion: state.data.version, operationId: `subscription-restore-${Date.now()}` }, { onSuccess: (result: { value: SubscriptionOperation }) => setActiveOperation(result.value) })} />
      <ActionButton label="subscriptions.manage.cancelAtPeriodEnd" loading={start.isPending} disabled={busy} onPress={() => start.mutate({ input: { kind: 'cancel', offerId: currentOffer.offerId, catalogVersion: currentOffer.catalogVersion }, expectedVersion: state.data.version, operationId: `subscription-cancel-${Date.now()}` }, { onSuccess: (result: { value: SubscriptionOperation }) => setActiveOperation(result.value) })} />
      <ActionButton label="subscriptions.manage.renew" loading={start.isPending} disabled={busy} onPress={() => start.mutate({ input: { kind: 'renew_mock', offerId: currentOffer.offerId, catalogVersion: currentOffer.catalogVersion }, expectedVersion: state.data.version, operationId: `subscription-renew_mock-${Date.now()}` }, { onSuccess: (result: { value: SubscriptionOperation }) => setActiveOperation(result.value) })} />
      <ActionButton label="subscriptions.manage.expire" loading={expire.isPending} disabled={busy} onPress={() => expire.mutate({ operationId: `subscription-expire-${Date.now()}` })} />
      {changeOffer ? <ActionButton label={translateDynamic('subscriptions.manage.change', { plan: changeOffer.plan })} onPress={() => router.push(`/subscriptions/checkout?offerId=${changeOffer.offerId}`)} /> : null}
    </ScrollView>
  );
}
