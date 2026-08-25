import React from 'react';
import { ScrollView } from 'react-native';
import { router } from 'expo-router';

import { ActionButton } from '@/design-system/components/ActionButton';
import { SurfaceCard } from '@/design-system/components/SurfaceCard';
import { StateView } from '@/design-system/components/feedback/StateView';
import { GroupedList, NavigationRow } from '@/design-system/components/navigation/GroupedList';
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

  if (state.isLoading || catalog.isLoading) return <StateView state="loading" title={translateDynamic('subscriptions.state.loading')} />;
  if (state.isError || catalog.isError || !state.data || !catalog.data) return <StateView state="error" title={translateDynamic('subscriptions.state.error')} />;

  const offers = catalog.data.offers as SubscriptionOffer[];
  const currentOffer = offers.find((offer) => offer.offerId === state.data.offerId) ?? offers[0];
  const changeOffer = offers.find((offer) => offer.offerId !== state.data.offerId && offer.plan !== 'free');
  const visibleOperation = activeOperation ?? operation.data;
  const busy = start.isPending || complete.isPending || expire.isPending || visibleOperation?.status === 'pending';

  return (
    <ScrollView contentContainerStyle={{ gap: 12, padding: 16 }}>
      <StyledText variant="title">subscriptions.manage.title</StyledText>
      <GroupedList label={translateDynamic('subscriptions.manage.title')}>
        <NavigationRow label={translateDynamic('subscriptions.manage.current', { plan: state.data.plan })} />
        <NavigationRow label={translateDynamic(`subscriptions.manage.status.${state.data.status}`)} />
        {state.data.renewsAt ? <NavigationRow label={translateDynamic('subscriptions.manage.renewsAt', { date: new Date(state.data.renewsAt).toISOString().slice(0, 10) })} /> : null}
        <NavigationRow label={translateDynamic(state.data.paidContentAccess === 'read_only' ? 'subscriptions.access.readOnly' : 'subscriptions.access.editable')} />
      </GroupedList>
      <StyledText>subscriptions.representative.notice</StyledText>
      {visibleOperation ? (
        <SurfaceCard>
          <StyledText>{`subscriptions.operation.${visibleOperation.status}`}</StyledText>
          {visibleOperation.status === 'review' || visibleOperation.status === 'pending' ? (
            <ActionButton label="subscriptions.operation.continue" loading={complete.isPending} disabled={busy && !complete.isPending} onPress={() => complete.mutate({ operationId: visibleOperation.operationId, outcome: 'success' }, { onSuccess: (result: { value: SubscriptionOperation }) => setActiveOperation(result.value) })} />
          ) : null}
        </SurfaceCard>
      ) : null}
      <ActionButton label="subscriptions.manage.restore" loading={start.isPending} disabled={busy} onPress={() => start.mutate({ input: { kind: 'restore', offerId: currentOffer.offerId, catalogVersion: currentOffer.catalogVersion }, expectedVersion: state.data.version, operationId: `subscription-restore-${Date.now()}` }, { onSuccess: (result: { value: SubscriptionOperation }) => setActiveOperation(result.value) })} />
      <ActionButton label="subscriptions.manage.cancelAtPeriodEnd" loading={start.isPending} disabled={busy} onPress={() => start.mutate({ input: { kind: 'cancel', offerId: currentOffer.offerId, catalogVersion: currentOffer.catalogVersion }, expectedVersion: state.data.version, operationId: `subscription-cancel-${Date.now()}` }, { onSuccess: (result: { value: SubscriptionOperation }) => setActiveOperation(result.value) })} />
      <ActionButton label="subscriptions.manage.renew" loading={start.isPending} disabled={busy} onPress={() => start.mutate({ input: { kind: 'renew_mock', offerId: currentOffer.offerId, catalogVersion: currentOffer.catalogVersion }, expectedVersion: state.data.version, operationId: `subscription-renew_mock-${Date.now()}` }, { onSuccess: (result: { value: SubscriptionOperation }) => setActiveOperation(result.value) })} />
      <ActionButton label="subscriptions.manage.expire" loading={expire.isPending} disabled={busy} onPress={() => expire.mutate({ operationId: `subscription-expire-${Date.now()}` })} />
      {changeOffer ? <ActionButton label={translateDynamic('subscriptions.manage.change', { plan: changeOffer.plan })} onPress={() => router.push(`/subscriptions/checkout?offerId=${changeOffer.offerId}`)} /> : null}
    </ScrollView>
  );
}
