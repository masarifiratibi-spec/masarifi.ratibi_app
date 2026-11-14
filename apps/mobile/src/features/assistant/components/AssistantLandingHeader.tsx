import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View
} from 'react-native';
import { ActionButton } from '@/design-system/components/ActionButton';
import { AppSheet } from '@/design-system/components/overlays/AppSheet';
import { DesignIcon } from '@/design-system/icons';
import { StyledText } from '@/components/StyledText';
import { translate } from '@/localization/i18n';
import { hasReadableSnapshot } from '@/services/read-snapshot';
import { usePreferenceStore } from '@/state/preferences';
import { useTheme } from '@/state/theme-context';
import { useAssistantConversations } from '../assistant-queries';

export function AssistantLandingHeader({
  onBack,
  onSelectConversation
}: {
  onBack: () => void;
  onSelectConversation: (id: string) => void;
}) {
  const { colors } = useTheme();
  const direction = usePreferenceStore((state) => state.direction);
  const [historyOpen, setHistoryOpen] = React.useState(false);
  return (
    <>
      <View
        style={[
          styles.header,
          { flexDirection: direction === 'rtl' ? 'row-reverse' : 'row' }
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={translate('appShell.navigation.back')}
          onPress={onBack}
          style={styles.iconButton}
        >
          <DesignIcon
            name="back"
            direction={direction}
            decorative
            color={colors.content.link}
          />
        </Pressable>
        <StyledText
          variant="title"
          style={[styles.title, { color: colors.content.link }]}
        >
          {translate('assistant.hero.title')}
        </StyledText>
        <Pressable
          testID="assistant-open-history"
          accessibilityRole="button"
          accessibilityLabel={translate('assistant.history.title')}
          onPress={() => setHistoryOpen(true)}
          style={styles.iconButton}
        >
          <DesignIcon name="history" decorative color={colors.content.link} />
        </Pressable>
      </View>
      {historyOpen ? (
        <AssistantHistory
          onDismiss={() => setHistoryOpen(false)}
          onSelect={(id) => {
            setHistoryOpen(false);
            onSelectConversation(id);
          }}
        />
      ) : null}
    </>
  );
}

function AssistantHistory({
  onDismiss,
  onSelect
}: {
  onDismiss: () => void;
  onSelect: (id: string) => void;
}) {
  const history = useAssistantConversations();
  const { colors } = useTheme();
  const direction = usePreferenceStore((state) => state.direction);
  const items = hasReadableSnapshot(history)
    ? (history.data?.pages.flatMap((page) => page.items) ?? [])
    : [];
  const conversations = [
    ...new Map(items.map((item) => [item.id, item])).values()
  ];
  return (
    <AppSheet
      title={translate('assistant.history.title')}
      visible
      onDismiss={onDismiss}
    >
      <ScrollView
        contentContainerStyle={styles.history}
        style={styles.historyScroll}
      >
        {history.isPending ? (
          <ActivityIndicator
            accessibilityLabel={translate('appShell.state.loading')}
            color={colors.content.link}
          />
        ) : null}
        {history.isError ? (
          <View style={styles.history}>
            <StyledText accessibilityRole="alert">
              assistant.state.error
            </StyledText>
            <ActionButton
              label="coreFinance.action.retry"
              variant="secondary"
              onPress={() => void history.refetch()}
            />
          </View>
        ) : null}
        {!history.isPending && !history.isError && !conversations.length ? (
          <StyledText>assistant.history.empty</StyledText>
        ) : null}
        {conversations.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={item.title}
            onPress={() => onSelect(item.id)}
            style={({ pressed }) => [
              styles.historyRow,
              {
                borderBottomColor: colors.borders.subtle,
                backgroundColor: pressed
                  ? colors.surfaces.brandSubtle
                  : 'transparent',
                flexDirection: direction === 'rtl' ? 'row-reverse' : 'row'
              }
            ]}
          >
            <StyledText
              style={[
                styles.historyTitle,
                { textAlign: direction === 'rtl' ? 'right' : 'left' }
              ]}
            >
              {item.title}
            </StyledText>
            <DesignIcon
              name="chevronEnd"
              direction={direction}
              decorative
              color={colors.content.secondary}
              size="sm"
            />
          </Pressable>
        ))}
        {history.hasNextPage ? (
          <ActionButton
            label="assistant.history.more"
            variant="quiet"
            loading={history.isFetchingNextPage}
            onPress={() => void history.fetchNextPage()}
          />
        ) : null}
      </ScrollView>
    </AppSheet>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    direction: 'ltr',
    minHeight: 60,
    paddingHorizontal: 12
  },
  title: { flex: 1, fontSize: 20, lineHeight: 30, textAlign: 'center' },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 48
  },
  historyScroll: { maxHeight: 460 },
  history: { gap: 12, paddingVertical: 12 },
  historyRow: {
    alignItems: 'center',
    direction: 'ltr',
    gap: 12,
    minHeight: 56,
    paddingVertical: 12,
    borderBottomWidth: 1
  },
  historyTitle: { flex: 1 }
});
