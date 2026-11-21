import React from 'react';
import { useTheme } from '@/state/theme-context';
import {
  ScrollView,
  View,
  StyleSheet,
  Keyboard,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { AssistantLandingHeader } from './components/AssistantLandingHeader';
import { AssistantHero } from './components/AssistantHero';
import { AssistantAskCard } from './components/AssistantAskCard';
import { AssistantSuggestedQuestions } from './components/AssistantSuggestedQuestions';
import { StyledText } from '@/components/StyledText';
import { currentLocale, translate } from '@/localization/i18n';
import { type ThemeColors, radius, spacing } from '@/design-system/tokens';
import type { AssistantQuestionIntent } from '@/services/contracts/assistant-notifications-service';
import type { AssistantFinancialInsight } from '@/services/contracts/assistant-notifications-service';
import { SurfaceCard } from '@/design-system/components/SurfaceCard';
import { formatMinorAmount } from '@/utils/format-financial-value';
import { ActionButton } from '@/design-system/components/ActionButton';
import { useDraftNavigationGuard } from '@/features/shell/useDraftNavigationGuard';
import { useAssistantFinancialVisibility } from './useAssistantFinancialVisibility';
import { useAssistantDraft } from './useAssistantDraft';
import { AssistantDraftStatus } from './AssistantDraftStatus';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';

export interface AssistantLandingProps {
  initialQuestion?: string;
  onAskQuestion: (
    question: string,
    intent?: AssistantQuestionIntent
  ) => void | Promise<boolean>;
  insight?: AssistantFinancialInsight;
  conversations?: readonly { id: string; title: string }[];
  onSelectConversation?: (id: string) => void;
  loading?: boolean;
  error?: string | null;
  onBack?: () => void;
}

export function AssistantLanding({
  initialQuestion,
  onAskQuestion,
  insight,
  loading = false,
  error = null,
  onBack,
  onSelectConversation
}: AssistantLandingProps) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const insets = React.useContext(SafeAreaInsetsContext);
  const [keyboardVisible, setKeyboardVisible] = React.useState(
    () => Keyboard.isVisible?.() ?? false
  );
  React.useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false)
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const scope = initialQuestion
    ? `report:${bytesToHex(sha256(utf8ToBytes(initialQuestion)))}`
    : 'landing';
  const draft = useAssistantDraft(scope, initialQuestion);
  const hasUnsentQuestion = Boolean(draft.text.trim());
  const { hidden, reveal } = useAssistantFinancialVisibility(
    insight?.id ?? 'no-insight'
  );

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/home');
    }
  };

  const { requestClose } = useDraftNavigationGuard({
    dirty: hasUnsentQuestion,
    discard: () => draft.discard(),
    close: handleBack,
    copy: {
      title: translate('assistant.unsent.title'),
      message: translate('assistant.unsent.message'),
      keep: translate('assistant.unsent.keep'),
      discard: translate('assistant.unsent.discard')
    }
  });

  const handleAskQuestion = async (
    question: string,
    intent?: AssistantQuestionIntent
  ) => {
    const revision = question === draft.text.trim() ? draft.revision : null;
    const accepted =
      intent === undefined
        ? await onAskQuestion(question)
        : await onAskQuestion(question, intent);
    if (accepted === true && revision) await draft.discard(revision);
  };

  return (
    <KeyboardAvoidingView
      testID="assistant-landing"
      style={styles.root}
      behavior="padding"
      enabled={keyboardVisible}
      keyboardVerticalOffset={insets?.top ?? 0}
    >
      <AssistantLandingHeader
        onBack={requestClose}
        onSelectConversation={(id) =>
          onSelectConversation
            ? onSelectConversation(id)
            : router.push(`/assistant/${id}`)
        }
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          keyboardVisible && styles.typingContent
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {!keyboardVisible ? (
          <View style={styles.heroZone}>
            <AssistantHero />
            {insight ? (
              <SurfaceCard
                testID="assistant-proactive-insight"
                style={styles.insightCard}
              >
                <StyledText variant="title">
                  {hidden ? '••••' : insight.budgetName}
                </StyledText>
                <StyledText>
                  {hidden
                    ? `•••• ${insight.currency}`
                    : formatMinorAmount(
                        insight.spentMinor,
                        insight.currency,
                        currentLocale()
                      ).replace('\u00a0', ' ')}
                </StyledText>
                {hidden ? (
                  <ActionButton
                    label="assistant.action.revealFinancial"
                    variant="secondary"
                    onPress={reveal}
                  />
                ) : null}
              </SurfaceCard>
            ) : null}
          </View>
        ) : null}

        <View style={styles.bottomZone}>
          {error ? (
            <View style={styles.errorContainer}>
              <StyledText accessibilityRole="alert" style={styles.errorText}>
                {error}
              </StyledText>
            </View>
          ) : null}
          {!keyboardVisible ? (
            <AssistantSuggestedQuestions
              onSelectQuestion={(question, intent) => {
                void handleAskQuestion(question, intent).catch(() => undefined);
              }}
              disabled={loading || draft.loading}
            />
          ) : null}
          <AssistantDraftStatus draft={draft} />
          <AssistantAskCard
            text={draft.text}
            onChangeText={draft.change}
            onAskQuestion={(question) => {
              void handleAskQuestion(question).catch(() => undefined);
            }}
            loading={loading || draft.loading}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: {
      backgroundColor: colors.surfaces.page,
      flex: 1
    },
    scrollContent: {
      flexGrow: 1,
      gap: spacing.lg,
      paddingHorizontal: 20,
      paddingBottom: 48,
      paddingTop: spacing.sm
    },
    typingContent: { justifyContent: 'flex-end', paddingBottom: spacing.sm },
    heroZone: {
      flex: 1,
      minHeight: 240,
      justifyContent: 'center',
      gap: spacing.lg,
      width: '100%'
    },
    bottomZone: {
      gap: 20,
      width: '100%'
    },
    errorContainer: {
      backgroundColor: colors.iconBadges.danger.background,
      borderColor: colors.iconBadges.danger.border,
      borderRadius: radius.control,
      borderWidth: 1,
      padding: spacing.md
    },
    errorText: {
      color: colors.iconBadges.danger.foreground,
      fontSize: 13,
      textAlign: 'center'
    },
    insightCard: {
      gap: spacing.xs,
      padding: spacing.md
    }
  });
