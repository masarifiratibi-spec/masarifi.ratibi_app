import React, { useEffect, useRef, useState } from 'react';
import { Modal, TextInput, View } from 'react-native';
import { getClerkInstance } from '@clerk/expo';
import { ActionButton } from '@/design-system/components/ActionButton';
import { StyledText } from '@/components/StyledText';
import { translate } from '@/localization/i18n';
import { useTheme } from '@/state/theme-context';
import { configureRecentAuthHandler } from '@/services/live/http-client';

type Session = NonNullable<ReturnType<typeof getClerkInstance>['session']>;
type Strategy = 'email_code' | 'phone_code' | 'password' | 'passkey';
interface Verification {
  session: Session;
  ownerId: string;
  strategy?: Strategy;
  allowRecentSignIn: boolean;
  promise: Promise<string | null>;
  resolve: (token: string | null) => void;
}

function recentlySignedIn(session: Session) {
  const age = Date.now() - (session.createdAt?.getTime() ?? 0);
  const minutes = session.factorVerificationAge?.[0];
  return (
    age >= 0 &&
    age < 600_000 &&
    minutes !== undefined &&
    minutes >= 0 &&
    minutes < 10
  );
}

export function RecentAuthDialog({
  enabled,
  sessionId
}: {
  enabled: boolean;
  sessionId: string | null | undefined;
}) {
  const theme = useTheme();
  const current = useRef<Verification | null>(null);
  const [visible, setVisible] = useState(false);
  const [strategy, setStrategy] = useState<Strategy>();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [unsupported, setUnsupported] = useState(false);

  const valid = (flight: Verification) =>
    current.current === flight &&
    getClerkInstance().session?.id === flight.session.id &&
    getClerkInstance().user?.id === flight.ownerId;
  const finish = (token: string | null) => {
    const flight = current.current;
    current.current = null;
    flight?.resolve(token);
    setVisible(false);
    setInput('');
    setBusy(false);
  };
  const prepare = async (flight: Verification) => {
    setBusy(true);
    setFailed(false);
    setUnsupported(false);
    try {
      const verification = await flight.session.startVerification({
        level: 'first_factor'
      });
      if (!valid(flight)) return;
      if (verification.status === 'complete') {
        const token = await flight.session.getToken({ skipCache: true });
        if (valid(flight)) finish(token);
        return;
      }
      const factor = verification.supportedFirstFactors?.find((item) =>
        ['email_code', 'phone_code', 'password', 'passkey'].includes(
          item.strategy
        )
      );
      if (!factor) {
        setUnsupported(true);
        return;
      }
      if (factor.strategy === 'email_code')
        await flight.session.prepareFirstFactorVerification({
          strategy: 'email_code',
          emailAddressId: factor.emailAddressId
        });
      else if (factor.strategy === 'phone_code')
        await flight.session.prepareFirstFactorVerification({
          strategy: 'phone_code',
          phoneNumberId: factor.phoneNumberId
        });
      if (!valid(flight)) return;
      flight.strategy = factor.strategy as Strategy;
      setStrategy(flight.strategy);
    } catch {
      if (valid(flight)) setFailed(true);
    } finally {
      if (valid(flight)) setBusy(false);
    }
  };

  useEffect(() => {
    if (!enabled || !sessionId) return;
    configureRecentAuthHandler(async (options) => {
      if (current.current) return current.current.promise;
      const clerk = getClerkInstance();
      if (!clerk.session || !clerk.user || clerk.session.id !== sessionId)
        return null;
      let resolve!: Verification['resolve'];
      const promise = new Promise<string | null>((done) => {
        resolve = done;
      });
      const flight: Verification = {
        session: clerk.session,
        ownerId: clerk.user.id,
        allowRecentSignIn: options?.allowRecentSignIn === true,
        promise,
        resolve
      };
      current.current = flight;
      setInput('');
      setStrategy(undefined);
      setVisible(true);
      void prepare(flight);
      return promise;
    });
    return () => {
      configureRecentAuthHandler();
      current.current?.resolve(null);
      current.current = null;
      setVisible(false);
      setInput('');
    };
    // Clerk resources are mutable; session identity owns the pending verification.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, sessionId]);

  const verify = async () => {
    const flight = current.current;
    if (
      !flight?.strategy ||
      busy ||
      (flight.strategy !== 'passkey' && !input) ||
      !valid(flight)
    )
      return;
    setBusy(true);
    setFailed(false);
    try {
      const verification =
        flight.strategy === 'passkey'
          ? await flight.session.verifyWithPasskey()
          : await flight.session.attemptFirstFactorVerification(
              flight.strategy === 'password'
                ? { strategy: 'password', password: input }
                : { strategy: flight.strategy, code: input.trim() }
            );
      if (!valid(flight)) return;
      if (verification.status !== 'complete')
        throw new Error('verification incomplete');
      const token = await flight.session.getToken({ skipCache: true });
      if (valid(flight)) finish(token);
    } catch {
      if (valid(flight)) setFailed(true);
    } finally {
      if (valid(flight)) setBusy(false);
    }
  };

  const acceptRecentSignIn = async () => {
    const flight = current.current;
    if (
      !flight?.allowRecentSignIn ||
      !valid(flight) ||
      !recentlySignedIn(flight.session)
    )
      return;
    setBusy(true);
    try {
      const token = await flight.session.getToken({ skipCache: true });
      if (valid(flight)) finish(token);
    } catch {
      if (valid(flight)) setFailed(true);
    } finally {
      if (valid(flight)) setBusy(false);
    }
  };
  const canUseFreshSignIn =
    (unsupported || (failed && !strategy)) &&
    current.current?.allowRecentSignIn &&
    recentlySignedIn(current.current.session);

  return (
    <Modal visible={visible} transparent onRequestClose={() => finish(null)}>
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          padding: 24,
          backgroundColor: 'rgba(0,0,0,0.5)'
        }}
      >
        <View
          style={{
            padding: 24,
            gap: 16,
            borderRadius: 16,
            backgroundColor: theme.colors.surface
          }}
        >
          <StyledText variant="title">
            {translate('recentAuth.title')}
          </StyledText>
          {strategy ? (
            <StyledText accessible={strategy === 'passkey'}>
              {translate(
                strategy === 'password'
                  ? 'recentAuth.password'
                  : strategy === 'passkey'
                    ? 'recentAuth.passkey'
                    : 'recentAuth.code'
              )}
            </StyledText>
          ) : null}
          {strategy && strategy !== 'passkey' ? (
            <TextInput
              testID="recent-auth-input"
              accessibilityLabel={translate(
                strategy === 'password'
                  ? 'recentAuth.password'
                  : 'recentAuth.code'
              )}
              value={input}
              onChangeText={setInput}
              secureTextEntry={strategy === 'password'}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType={strategy === 'password' ? 'default' : 'number-pad'}
              editable={!busy}
              style={{
                color: theme.colors.content.primary,
                borderWidth: 1,
                borderColor: theme.colors.border,
                borderRadius: 8,
                padding: 12
              }}
            />
          ) : null}
          {unsupported && !canUseFreshSignIn ? (
            <StyledText accessibilityRole="alert">
              {translate('recentAuth.unsupported')}
            </StyledText>
          ) : null}
          {canUseFreshSignIn ? (
            <ActionButton
              label="recentAuth.useSignIn"
              loading={busy}
              onPress={() => void acceptRecentSignIn()}
            />
          ) : null}
          {failed &&
          !strategy &&
          current.current?.allowRecentSignIn &&
          !canUseFreshSignIn ? (
            <StyledText>{translate('recentAuth.signInAgain')}</StyledText>
          ) : null}
          {failed ? (
            <StyledText accessibilityRole="alert">
              {translate('recentAuth.failed')}
            </StyledText>
          ) : null}
          {strategy ? (
            <ActionButton
              testID="recent-auth-confirm"
              label={translate('recentAuth.confirm')}
              loading={busy}
              disabled={strategy !== 'passkey' && !input}
              onPress={() => void verify()}
            />
          ) : !unsupported ? (
            <ActionButton
              label={translate('recentAuth.retry')}
              loading={busy}
              onPress={() => {
                if (current.current) void prepare(current.current);
              }}
            />
          ) : null}
          <ActionButton
            testID="recent-auth-cancel"
            variant="secondary"
            label={translate('recentAuth.cancel')}
            onPress={() => finish(null)}
          />
        </View>
      </View>
    </Modal>
  );
}
