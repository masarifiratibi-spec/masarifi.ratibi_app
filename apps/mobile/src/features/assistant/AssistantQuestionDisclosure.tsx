import React from 'react';
import { Platform, View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { useAppShellStore } from '@/state/app-shell';
import { ActionButton } from '@/design-system/components/ActionButton';
import { StyledText } from '@/components/StyledText';
import { translate } from '@/localization/i18n';
import { AssistantConsentCard } from './components/AssistantConsentCard';
import {
  useAssistantConsent,
  useSetAssistantConsent
} from './assistant-queries';

const QuestionAdmission = React.createContext<(() => boolean) | null>(null);

export function useQuestionAdmission() {
  return React.useContext(QuestionAdmission) ?? (() => Platform.OS !== 'ios');
}

export function AssistantQuestionDisclosure({
  children
}: React.PropsWithChildren) {
  const parent = React.useContext(QuestionAdmission);
  const owner = useAppShellStore((state) => state.session?.userId);
  if (Platform.OS !== 'ios' || parent) return <>{children}</>;
  return (
    <OwnerDisclosure key={owner ?? 'signed-out'} owner={owner}>
      {children}
    </OwnerDisclosure>
  );
}

function OwnerDisclosure({
  owner,
  children
}: React.PropsWithChildren<{ owner?: string | null }>) {
  const consent = useAssistantConsent();
  const change = useSetAssistantConsent();
  const [show, setShow] = React.useState(false);
  const [locallyWithdrawn, setLocallyWithdrawn] = React.useState(false);
  const enabled = consent.data?.status === 'enabled' && !locallyWithdrawn;
  const admit = () => {
    if (enabled && !consent.isError && !change.isPending) return true;
    setShow(true);
    void consent.refetch?.();
    return false;
  };
  const update = (enabled: boolean) => {
    if (
      !consent.data ||
      !owner ||
      owner !== useAppShellStore.getState().session?.userId
    )
      return;
    if (!enabled) setLocallyWithdrawn(true);
    change.mutate(
      {
        enabled,
        ownerId: owner,
        expectedVersion: consent.data.version,
        operationId: randomUUID()
      },
      {
        onSuccess: () => {
          setLocallyWithdrawn(!enabled);
          setShow(false);
        },
        onError: () => {
          setShow(true);
          void consent.refetch();
        }
      }
    );
  };
  return (
    <QuestionAdmission.Provider value={admit}>
      {show ? (
        <View>
          <AssistantConsentCard
            consent={enabled ? consent.data : undefined}
            onEnableConsent={() => update(true)}
            onDisableConsent={() => update(false)}
            onDecline={() => setShow(false)}
            loading={!consent.data || consent.isError || change.isPending}
          />
          {change.isError || consent.isError ? (
            <StyledText accessibilityRole="alert">
              {translate('assistant.state.error')}
            </StyledText>
          ) : null}
          {consent.isError ? (
            <ActionButton
              label="designSystem.action.retry"
              onPress={() => void consent.refetch()}
            />
          ) : null}
        </View>
      ) : enabled ? (
        <ActionButton
          label="assistant.consent.withdraw"
          variant="quiet"
          onPress={() => update(false)}
        />
      ) : null}
      {children}
    </QuestionAdmission.Provider>
  );
}
