import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Rect,
  Stop
} from 'react-native-svg';
import { router } from 'expo-router';
import { StyledText } from '@/components/StyledText';
import { DesignIcon, type DesignIconName } from '@/design-system/icons';
import { colorTokens, minTouchTarget, spacing } from '@/design-system/tokens';
import { currentLocale, translate } from '@/localization/i18n';
import { usePreferenceStore } from '@/state/preferences';
import { useTheme } from '@/state/theme-context';

export function SavingsHeader({
  title,
  label,
  amount,
  description,
  action,
  children
}: {
  title: string;
  label?: string;
  amount?: string;
  description?: string;
  action?: { icon: DesignIconName; label: string; onPress: () => void };
  children?: React.ReactNode;
}) {
  const theme = useTheme();
  const direction = usePreferenceStore((s) => s.direction);
  return (
    <View
      style={[
        styles.header,
        { direction, backgroundColor: theme.colors.horizon.referenceEnd }
      ]}
    >
      <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
        <Svg pointerEvents="none" width="100%" height="100%">
          <Defs>
            <LinearGradient id="savingsHeader" x1="0" x2="1" y1="0" y2="1">
              <Stop
                offset="0"
                stopColor={theme.colors.horizon.referenceStart}
              />
              <Stop offset="1" stopColor={theme.colors.horizon.referenceEnd} />
            </LinearGradient>
          </Defs>
          <Rect fill="url(#savingsHeader)" width="100%" height="100%" />
          <Circle cx="5%" cy="-12%" r="150" fill={theme.colors.horizon.glow} />
          <Circle cx="21%" cy="90%" r="82" fill={colorTokens.effects.glass} />
        </Svg>
      </View>
      <View style={styles.headerTop}>
        <SavingsIconButton
          icon="back"
          label={translate('common.back')}
          onPress={() => router.back()}
          inverse
        />
        <StyledText variant="headline" style={styles.headerTitle}>
          {title}
        </StyledText>
        {action ? (
          <SavingsIconButton {...action} inverse />
        ) : (
          <View style={styles.iconButton} />
        )}
      </View>
      {description ? (
        <StyledText variant="subtitle" style={styles.headerCopy}>
          {description}
        </StyledText>
      ) : null}
      {label ? (
        <StyledText style={styles.headerCopy}>{label}</StyledText>
      ) : null}
      {amount !== undefined ? (
        <StyledText variant="amount" style={styles.heroAmount}>
          {amount}
        </StyledText>
      ) : null}
      {children}
    </View>
  );
}

export function SavingsIconButton({
  icon,
  label,
  onPress,
  inverse = false
}: {
  icon: DesignIconName;
  label: string;
  onPress: () => void;
  inverse?: boolean;
}) {
  const theme = useTheme();
  const direction = usePreferenceStore((s) => s.direction);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.65 }]}
    >
      <DesignIcon
        name={icon}
        direction={direction}
        decorative
        color={
          inverse ? colorTokens.surface.white : theme.colors.content.primary
        }
      />
    </Pressable>
  );
}

export function SavingsProgressBar({
  percentage,
  hidden,
  inverse = false
}: {
  percentage: number | null;
  hidden: boolean;
  inverse?: boolean;
}) {
  const theme = useTheme();
  const direction = usePreferenceStore((s) => s.direction);
  if (hidden || percentage === null || !Number.isFinite(percentage))
    return null;
  const bounded = Math.max(0, Math.min(100, percentage));
  return (
    <View style={styles.progressRow}>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={translate('planning.savings.savedSoFar')}
        accessibilityValue={{ min: 0, max: 100, now: bounded }}
        style={[
          styles.track,
          {
            backgroundColor: inverse
              ? colorTokens.effects.glassStrong
              : theme.colors.surfaces.brandSubtle
          }
        ]}
      >
        <View
          style={[
            styles.fill,
            {
              width: `${bounded}%`,
              backgroundColor: inverse
                ? colorTokens.surface.white
                : theme.colors.primary
            },
            direction === 'rtl' ? { right: 0 } : { left: 0 }
          ]}
        />
      </View>
      <StyledText
        variant="caption"
        style={[
          { writingDirection: 'ltr' },
          inverse ? { color: colorTokens.surface.white } : undefined
        ]}
      >
        {percentage.toLocaleString(
          currentLocale() === 'ar' ? 'ar-u-nu-latn' : 'en',
          {
            maximumFractionDigits: 1
          }
        )}
        %
      </StyledText>
    </View>
  );
}

export function SavingsInfo() {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.info,
        { backgroundColor: theme.colors.surfaces.brandSubtle }
      ]}
    >
      <DesignIcon name="info" decorative color={theme.colors.content.primary} />
      <StyledText variant="caption" style={styles.infoCopy}>
        {translate('planning.savings.trackingOnly')}
      </StyledText>
    </View>
  );
}

export function SavingsSegments<T extends string>({
  value,
  options,
  onChange,
  disabled = false
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.segments,
        { backgroundColor: theme.colors.surfaces.brandSubtle }
      ]}
    >
      {options.map((option) => (
        <Pressable
          key={option.value}
          accessibilityRole="button"
          accessibilityLabel={option.label}
          accessibilityState={{ selected: option.value === value, disabled }}
          disabled={disabled}
          onPress={() => onChange(option.value)}
          style={[
            styles.segment,
            option.value === value && {
              backgroundColor: theme.colors.surfaces.card
            }
          ]}
        >
          <StyledText variant="subtitle" style={styles.segmentText}>
            {option.label}
          </StyledText>
        </Pressable>
      ))}
    </View>
  );
}

export function savingsDate(value: string) {
  return new Intl.DateTimeFormat(
    currentLocale() === 'ar' ? 'ar-u-nu-latn' : 'en',
    {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC'
    }
  ).format(new Date(`${value}T12:00:00Z`));
}

export const savingsStyles = StyleSheet.create({
  card: { borderRadius: 22, gap: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  grow: { flex: 1, flexShrink: 1 },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.sm,
    minHeight: minTouchTarget
  },
  money: {
    writingDirection: 'ltr',
    fontVariant: ['tabular-nums'],
    flexShrink: 1
  },
  footer: { gap: spacing.sm, paddingTop: spacing.sm },
  button: {
    borderRadius: 20,
    minHeight: 56,
    backgroundColor: colorTokens.obligationDetail.hero,
    borderColor: colorTokens.obligationDetail.hero
  },
  optional: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: minTouchTarget,
    gap: spacing.sm
  },
  separator: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm
  }
});

const styles = StyleSheet.create({
  header: {
    marginHorizontal: -spacing.lg,
    marginTop: -spacing.lg,
    padding: spacing.lg,
    paddingTop: spacing.md,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    overflow: 'hidden',
    gap: spacing.sm
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: colorTokens.surface.white
  },
  headerCopy: { color: colorTokens.surface.white, textAlign: 'auto' },
  heroAmount: {
    color: colorTokens.surface.white,
    fontSize: 36,
    lineHeight: 48,
    writingDirection: 'ltr',
    flexShrink: 1
  },
  iconButton: {
    minHeight: minTouchTarget,
    minWidth: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24
  },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  track: { flex: 1, height: 9, borderRadius: 8, overflow: 'hidden' },
  fill: { position: 'absolute', height: '100%', borderRadius: 8 },
  info: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: 18,
    gap: spacing.sm
  },
  infoCopy: { flex: 1 },
  segments: { flexDirection: 'row', padding: 5, borderRadius: 24, gap: 4 },
  segment: {
    minHeight: minTouchTarget,
    flex: 1,
    padding: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20
  },
  segmentText: { textAlign: 'center' }
});
