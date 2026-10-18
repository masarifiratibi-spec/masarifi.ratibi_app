import React from 'react';
import { FinancialRefreshStatus } from '@/features/core-finance/FinancialRefreshStatus';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { StyledText } from '@/components/StyledText';
import { SurfaceCard } from '@/design-system/components/SurfaceCard';
import { layoutDirectionStyle } from '@/design-system/direction';
import { DesignIcon, type DesignIconName } from '@/design-system/icons';
import { colorTokens, radius, spacing } from '@/design-system/tokens';
import { localDateInTimeZone } from '@/domain/financial-period';
import type {
  Obligation,
  ObligationLifecycle,
  ObligationPayment,
  ObligationScheduleItem
} from '@/domain/financial-planning';
import {
  PlanningScreen,
  PlanningState
} from '@/features/financial-planning/PlanningScaffold';
import {
  currentLocale,
  translate,
  translateDynamic,
  type MessageKey
} from '@/localization/i18n';
import { financialPlanningService } from '@/services/financial-planning-service';
import { useSensitiveVisibility } from '@/state/SensitiveVisibilityProvider';
import { usePreferenceStore } from '@/state/preferences';
import { useTheme } from '@/state/theme-context';
import { formatDate, formatMinorAmount } from '@/utils/format-financial-value';
import { useObligationDetail, usePlanningMutation } from './obligation-queries';

export function ObligationDetailScreen({
  obligationId = ''
}: {
  obligationId?: string;
}) {
  const query = useObligationDetail(obligationId);
  const direction = usePreferenceStore((state) => state.direction);
  const timeZone = usePreferenceStore((state) => state.timeZone);
  const hideBalances = usePreferenceStore((state) => state.hideBalances);
  const { revealed } = useSensitiveVisibility();
  const theme = useTheme();
  const hidden = hideBalances && !revealed;
  const rtl = direction === 'rtl';
  const item = query.data?.obligation;
  const [moreOpen, setMoreOpen] = React.useState(false);
  const lifecycle = usePlanningMutation((status: ObligationLifecycle) =>
    financialPlanningService.setObligationStatus(
      obligationId,
      query.data!.obligation.version,
      status,
      `obligation-status:${obligationId}:${status}:${Date.now()}`
    )
  );
  const reverse = usePlanningMutation((paymentId: string) =>
    financialPlanningService.reverseObligationPayment(
      paymentId,
      `obligation-payment-undo:${paymentId}:${Date.now()}`
    )
  );
  const money = (minor: number | null) =>
    minor === null
      ? translate('reports.state.unavailable')
      : hidden
        ? translate('planning.state.hidden')
        : formatMinorAmount(
            minor,
            item?.currencyCode ?? 'SAR',
            currentLocale()
          );
  const paid = query.data?.status.paidMinor ?? null;
  const remaining =
    query.data?.status.remainingMinor.status === 'available'
      ? query.data.status.remainingMinor.value
      : null;
  const total = item?.contractedTotalMinor ?? null;
  const progress =
    paid === null || !total
      ? 0
      : Math.max(0, Math.min(100, Math.round((paid / total) * 100)));
  const schedule = displaySchedule(
    query.data?.schedule ?? [],
    query.data?.payments ?? [],
    localDateInTimeZone(Date.now(), timeZone)
  ).sort(
    (a, b) => a.dueDate.localeCompare(b.dueDate) || a.sequence - b.sequence
  );
  return (
    <PlanningScreen
      titleKey="planning.obligations.detail"
      hideHeader
      backgroundColor={theme.colors.surfaces.page}
    >
      <FinancialRefreshStatus query={{ ...query, isFetching: query.isFetching || query.isRefetching }} />
      {!obligationId ? (
        <PlanningState state="empty" />
      ) : query.isLoading ? (
        <PlanningState state="loading" />
      ) : query.isError || !item ? (
        <PlanningState state="error" onRetry={() => void query.refetch()} />
      ) : (
        <>
          <View
            testID="obligation-detail-hero"
            style={[
              styles.hero,
              {
                backgroundColor:
                  theme.mode === 'dark'
                    ? colorTokens.obligationDetail.heroDark
                    : colorTokens.obligationDetail.hero
              }
            ]}
          >
            <View style={styles.navigation}>
              <IconButton
                icon="back"
                label={translate('common.back')}
                onPress={() => router.back()}
                direction={direction}
              />
              <StyledText
                style={[
                  styles.navigationTitle,
                  { color: colorTokens.surface.white }
                ]}
              >
                {translate('planning.obligations.detail')}
              </StyledText>
              <IconButton
                icon="more"
                label={translate('planning.obligation.moreActions')}
                onPress={() => setMoreOpen(!moreOpen)}
                expanded={moreOpen}
              />
            </View>
            <View style={styles.titleRow}>
              <View
                style={[
                  styles.itemIcon,
                  { backgroundColor: theme.colors.horizon.glow }
                ]}
              >
                <DesignIcon
                  name={item.type === 'car_installment' ? 'car' : 'wallet'}
                  decorative
                  color={colorTokens.surface.white}
                />
              </View>
              <View
                testID="obligation-detail-title-copy"
                style={[
                  styles.titleCopy,
                  { alignItems: rtl ? 'flex-end' : 'flex-start' }
                ]}
              >
                <StyledText
                  testID="obligation-detail-title"
                  variant="title"
                  style={[
                    styles.title,
                    {
                      color: colorTokens.surface.white,
                      textAlign: rtl ? 'right' : 'left'
                    }
                  ]}
                >
                  {item.title}
                </StyledText>
                <StyledText
                  style={{
                    color: colorTokens.surface.white,
                    textAlign: rtl ? 'right' : 'left'
                  }}
                >
                  {translate(
                    item.direction === 'payable'
                      ? 'planning.obligation.iOwe'
                      : 'planning.obligation.owedToMe'
                  )}{' '}
                  · {paymentScheduleLabel(item)}
                </StyledText>
              </View>
            </View>
            <View
              accessible
              accessibilityLabel={`${translate('planning.field.remaining')}, ${money(remaining)}, ${translate('planning.obligation.total')}, ${`\u2066${money(total)}\u2069`}, ${translate('planning.field.paid')}, ${money(paid)}`}
              style={styles.amountBlock}
            >
              <StyledText
                style={[styles.heroLabel, { color: colorTokens.surface.white }]}
              >
                {translate('planning.field.remaining')}
              </StyledText>
              <StyledText
                variant="amount"
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.5}
                style={[styles.remaining, { color: colorTokens.surface.white }]}
              >
                {money(remaining)}
              </StyledText>
              <View style={styles.progressCopy}>
                <StyledText
                  style={[
                    styles.heroSmall,
                    { color: colorTokens.surface.white }
                  ]}
                >
                  {translateDynamic('planning.obligation.detail.paid', {
                    amount: `\u2066${money(paid)}\u2069`
                  })}
                </StyledText>
                <StyledText
                  style={[
                    styles.heroSmall,
                    { color: colorTokens.surface.white }
                  ]}
                >
                  {hidden ? translate('planning.state.hidden') : `${progress}%`}
                </StyledText>
              </View>
              <View
                style={[
                  styles.track,
                  { backgroundColor: theme.colors.horizon.glow }
                ]}
              >
                <View
                  testID="obligation-detail-progress-fill"
                  style={[
                    styles.fill,
                    {
                      backgroundColor: colorTokens.surface.white,
                      width: `${hidden ? 0 : progress}%`
                    },
                    rtl ? { right: 0 } : { left: 0 }
                  ]}
                />
              </View>
              <View
                style={[
                  styles.totals,
                  { borderTopColor: theme.colors.horizon.glow }
                ]}
              >
                <StyledText
                  style={[
                    styles.heroSmall,
                    { color: colorTokens.surface.white }
                  ]}
                >
                  {translate('planning.obligation.total')}{' '}
                  {`\u2066${money(total)}\u2069`}
                </StyledText>
                {item.installmentCount &&
                item.installmentAmountMinor !== null ? (
                  <StyledText
                    style={[
                      styles.heroSmall,
                      { color: colorTokens.surface.white }
                    ]}
                  >
                    {translateDynamic('planning.obligation.detail.plan', {
                      count: item.installmentCount,
                      amount: `\u2066${money(item.installmentAmountMinor)}\u2069`
                    })}
                  </StyledText>
                ) : null}
              </View>
            </View>
          </View>
          {moreOpen ? (
            <SurfaceCard style={styles.actionPanel}>
              {item.status === 'active' ? (
                <QuietButton
                  label={translate('planning.obligation.pause')}
                  loading={lifecycle.isPending}
                  onPress={() => lifecycle.mutate('paused')}
                />
              ) : null}
              {item.status === 'paused' ? (
                <QuietButton
                  label={translate('planning.obligation.resume')}
                  loading={lifecycle.isPending}
                  onPress={() => lifecycle.mutate('active')}
                />
              ) : null}
              {!['completed', 'closed', 'archived'].includes(item.status) ? (
                <QuietButton
                  label={translate('planning.obligation.complete')}
                  loading={lifecycle.isPending}
                  onPress={() => lifecycle.mutate('completed')}
                />
              ) : null}
            </SurfaceCard>
          ) : null}
          {lifecycle.isError || reverse.isError ? (
            <StyledText
              accessibilityRole="alert"
              style={{ color: theme.colors.status.danger }}
            >
              {translate('planning.state.error')}
            </StyledText>
          ) : null}
          {query.scheduleLoading ? <PlanningState state="loading" /> : query.scheduleError ? (
            <PlanningState state="error" onRetry={() => void query.refetch()} />
          ) : <ScheduleCard
            schedule={schedule}
            money={money}
            rtl={rtl}
            item={item}
            onRetry={() => void query.refetch()}
            retrying={query.isFetching}
          />}
          <View>
            <Disclosure
              label={translate('planning.obligation.detail.details')}
              icon="folder"
            >
              <DetailLine
                label={translate('planning.obligation.provider')}
                value={item.provider ?? translate('reports.state.unavailable')}
                testID="obligation-detail-provider"
              />
              <DetailLine
                label={translate('planning.obligation.firstDueDate')}
                value={
                  item.startDate
                    ? formatLocalDate(item.startDate)
                    : translate('reports.state.unavailable')
                }
              />
              {item.endDate ? (
                <DetailLine
                  label={translate('planning.obligation.finalDate')}
                  value={formatLocalDate(item.endDate)}
                />
              ) : null}
              <DetailLine
                label={translate('planning.obligation.count')}
                value={
                  item.installmentCount === null
                    ? translate('reports.state.unavailable')
                    : String(item.installmentCount)
                }
              />
            </Disclosure>
            <Disclosure
              label={translate('planning.obligation.paymentHistory')}
              icon="transactions"
            >
              <View
                testID="obligation-detail-payment-history"
                style={styles.history}
              >
                {query.historyLoading ? <PlanningState state="loading" /> : query.data?.paymentHistoryState === 'unavailable' ? (
                  <View>
                    <StyledText
                      style={{ color: theme.colors.content.secondary }}
                    >
                      {translate('reports.state.unavailable')}
                    </StyledText>
                    <QuietButton
                      label={translate('planning.action.retry')}
                      loading={query.isRefetching}
                      onPress={() => {
                        void query.refetch();
                      }}
                    />
                  </View>
                ) : !query.data?.payments.length ? (
                  <StyledText style={{ color: theme.colors.content.secondary }}>
                    {translate('planning.obligation.noPayments')}
                  </StyledText>
                ) : (
                  query.data.payments.map((payment) => (
                    <View key={payment.id} style={styles.historyRow}>
                      <View style={styles.historyCopy}>
                        <StyledText>
                          {translate(
                            `planning.obligation.paymentCase.${payment.case}` as MessageKey
                          )}
                        </StyledText>
                        <StyledText variant="caption">
                          {formatLocalDate(payment.paidDate)}
                        </StyledText>
                        {payment.status !== 'posted' ? (
                          <StyledText variant="caption">
                            {translate(
                              `planning.obligation.paymentStatus.${payment.status}` as MessageKey
                            )}
                          </StyledText>
                        ) : null}
                      </View>
                      <View>
                        <StyledText>{money(payment.amountMinor)}</StyledText>
                        {payment.status === 'posted' ? (
                          <QuietButton
                            label={translate('planning.action.undo')}
                            loading={reverse.isPending}
                            onPress={() => reverse.mutate(payment.id)}
                          />
                        ) : null}
                      </View>
                    </View>
                  ))
                )}
              </View>
            </Disclosure>
          </View>
          <View style={styles.footer}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={translate(
                'planning.obligation.recordPayment'
              )}
              onPress={() =>
                router.push(`/obligations/${obligationId}/payment`)
              }
              style={[
                styles.primaryPayment,
                {
                  backgroundColor:
                    theme.mode === 'dark'
                      ? colorTokens.obligationDetail.heroDark
                      : colorTokens.obligationDetail.hero
                }
              ]}
            >
              <DesignIcon
                name="add"
                decorative
                color={colorTokens.surface.white}
                size="sm"
              />
              <StyledText
                variant="subtitle"
                style={{ color: colorTokens.surface.white }}
              >
                {translate('planning.obligation.recordPayment')}
              </StyledText>
            </Pressable>
            <QuietButton
              icon="edit"
              label={translate('planning.action.edit')}
              onPress={() => router.push(`/obligations/${obligationId}/edit`)}
            />
          </View>
        </>
      )}
    </PlanningScreen>
  );
}

function IconButton({
  icon,
  label,
  onPress,
  expanded,
  direction
}: {
  icon: DesignIconName;
  label: string;
  onPress: () => void;
  expanded?: boolean;
  direction?: 'rtl' | 'ltr';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={expanded === undefined ? undefined : { expanded }}
      onPress={onPress}
      style={styles.iconButton}
    >
      <DesignIcon
        name={icon}
        decorative
        direction={direction}
        color={colorTokens.surface.white}
      />
    </Pressable>
  );
}

function Disclosure({
  label,
  icon,
  children
}: {
  label: string;
  icon: DesignIconName;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const theme = useTheme();
  return (
    <View
      style={{
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.borders.subtle
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={styles.disclosureButton}
      >
        <DesignIcon
          name={icon}
          decorative
          color={theme.colors.content.secondary}
          size="sm"
        />
        <StyledText style={styles.disclosureTitle}>{label}</StyledText>
        <View style={open ? { transform: [{ rotate: '180deg' }] } : undefined}>
          <DesignIcon
            name="chevronDown"
            decorative
            color={theme.colors.content.secondary}
            size="sm"
          />
        </View>
      </Pressable>
      {open ? <View style={styles.disclosureContent}>{children}</View> : null}
    </View>
  );
}

function DetailLine({
  label,
  value,
  testID
}: {
  label: string;
  value: string;
  testID?: string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.detailLine}>
      <StyledText
        variant="caption"
        style={{ color: theme.colors.content.secondary }}
      >
        {label}
      </StyledText>
      <StyledText testID={testID} style={styles.detailValue}>
        {value}
      </StyledText>
    </View>
  );
}

function ScheduleCard({
  schedule,
  money,
  rtl,
  item,
  onRetry,
  retrying
}: {
  schedule: ObligationScheduleItem[];
  money: (minor: number | null) => string;
  rtl: boolean;
  item: Obligation;
  onRetry: () => void;
  retrying: boolean;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const visible = expanded ? schedule : schedule.slice(0, 4);
  const theme = useTheme();
  return (
    <View style={styles.scheduleSection}>
      <View style={styles.sectionHeader}>
        <StyledText variant="subtitle">
          {translate('planning.obligation.installmentSchedule')}
        </StyledText>
        {!expanded && schedule.length > 4 ? (
          <QuietButton
            label={translate('planning.obligation.showAll')}
            onPress={() => setExpanded(true)}
          />
        ) : null}
      </View>
      <SurfaceCard style={styles.scheduleCard}>
        {!schedule.length ? (
          <View style={styles.pending}>
            <DesignIcon
              name="calendar"
              decorative
              color={theme.colors.primary}
            />
            <StyledText variant="subtitle">
              {translate(
                item.scheduleKind === 'irregular'
                  ? 'planning.obligation.detail.irregular'
                  : 'planning.obligation.detail.schedulePending'
              )}
            </StyledText>
            {item.scheduleKind !== 'irregular' ? (
              <QuietButton
                label={translate('planning.action.retry')}
                loading={retrying}
                onPress={onRetry}
              />
            ) : null}
          </View>
        ) : (
          visible.map((entry, index) => {
            const status = scheduleStatusVisual(entry.status, theme.colors);
            return (
              <View
                key={entry.id}
                accessible
                accessibilityLabel={`${translateDynamic('planning.obligation.installmentNumber', { count: entry.sequence })}, ${formatLocalDate(entry.dueDate)}, ${money(entry.scheduledMinor)}, ${translate(`planning.obligation.scheduleStatus.${entry.status}` as MessageKey)}`}
                testID={`obligation-detail-schedule-row-${entry.sequence}`}
                style={[
                  styles.scheduleRow,
                  {
                    borderTopWidth: index ? 1 : 0,
                    borderTopColor: theme.colors.borders.subtle
                  }
                ]}
              >
                <DesignIcon
                  name="calendar"
                  decorative
                  color={theme.colors.primary}
                  size="sm"
                />
                <View
                  style={[
                    styles.scheduleCopy,
                    { alignItems: rtl ? 'flex-end' : 'flex-start' }
                  ]}
                >
                  <StyledText style={{ textAlign: rtl ? 'right' : 'left' }}>
                    {translateDynamic('planning.obligation.installmentNumber', {
                      count: entry.sequence
                    })}
                  </StyledText>
                  <StyledText
                    variant="caption"
                    style={{ color: theme.colors.content.secondary }}
                  >
                    {formatLocalDate(entry.dueDate)}
                  </StyledText>
                </View>
                <View
                  style={[
                    styles.scheduleValue,
                    { alignItems: rtl ? 'flex-start' : 'flex-end' }
                  ]}
                >
                  <StyledText
                    variant="subtitle"
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                    numberOfLines={1}
                  >
                    {money(entry.scheduledMinor)}
                  </StyledText>
                  <View
                    style={[
                      styles.statusChip,
                      { backgroundColor: status.background }
                    ]}
                  >
                    <StyledText
                      variant="caption"
                      style={{ color: status.foreground }}
                    >
                      {translate(
                        `planning.obligation.scheduleStatus.${entry.status}` as MessageKey
                      )}
                    </StyledText>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </SurfaceCard>
    </View>
  );
}

function QuietButton({
  label,
  onPress,
  loading,
  icon
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  icon?: DesignIconName;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: loading }}
      disabled={loading}
      onPress={onPress}
      style={[styles.quietButton, loading && { opacity: 0.6 }]}
    >
      {icon ? (
        <DesignIcon
          name={icon}
          decorative
          color={theme.colors.primary}
          size="sm"
        />
      ) : null}
      <StyledText style={{ color: theme.colors.primary }}>{label}</StyledText>
    </Pressable>
  );
}
function paymentScheduleLabel(item: Obligation) {
  if (item.scheduleKind === 'irregular')
    return translate('planning.obligation.form.kind.irregular');
  if (item.scheduleKind === 'fixed_term' && item.installmentCount === 1)
    return translate('planning.obligation.form.kind.once');
  const period = translate(
    `planning.obligation.form.frequency.${item.frequency ?? 'monthly'}` as MessageKey
  );
  return item.scheduleKind === 'fixed_term'
    ? translateDynamic('planning.obligation.detail.installments', { period })
    : `${translate('planning.obligation.form.kind.recurring')} · ${period}`;
}

function formatLocalDate(value: string) {
  return formatDate(Date.parse(`${value}T00:00:00Z`), currentLocale());
}
function displaySchedule(
  schedule: readonly ObligationScheduleItem[],
  payments: readonly ObligationPayment[],
  today: string
): ObligationScheduleItem[] {
  const paidByScheduleId = new Map<string, number>();
  for (const payment of payments) {
    if (payment.status !== 'posted') continue;
    for (const allocation of payment.allocations)
      paidByScheduleId.set(
        allocation.scheduleItemId,
        (paidByScheduleId.get(allocation.scheduleItemId) ?? 0) +
          allocation.amountMinor
      );
  }
  return schedule.map((entry) => {
    if (
      entry.status === 'paid' ||
      entry.status === 'cancelled' ||
      (entry.status === 'partial' && !paidByScheduleId.has(entry.id))
    )
      return entry;
    const paid = paidByScheduleId.get(entry.id) ?? 0;
    const status =
      paid >= entry.scheduledMinor
        ? 'paid'
        : paid > 0
          ? 'partial'
          : entry.dueDate < today
            ? 'overdue'
            : 'upcoming';
    return { ...entry, status };
  });
}
function scheduleStatusVisual(
  status: ObligationScheduleItem['status'],
  colors: ReturnType<typeof useTheme>['colors']
) {
  return status === 'overdue'
    ? colors.iconBadges.danger
    : status === 'partial'
      ? colors.iconBadges.warning
      : status === 'cancelled'
        ? colors.iconBadges.neutral
        : colors.iconBadges.primary;
}

const styles = StyleSheet.create({
  hero: {
    marginHorizontal: -spacing.lg,
    marginTop: -spacing.lg,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.lg
  },
  navigation: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  navigationTitle: { flex: 1, fontSize: 14 },
  iconButton: {
    width: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center'
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  itemIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14
  },
  titleCopy: {
    ...layoutDirectionStyle('ltr'),
    flex: 1,
    minWidth: 0,
    gap: spacing.xs
  },
  title: { width: '100%', fontSize: 26, lineHeight: 36 },
  amountBlock: { gap: spacing.sm },
  heroLabel: { fontSize: 14 },
  remaining: { fontSize: 42, lineHeight: 58, width: '100%', textAlign: 'auto' },
  progressCopy: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.md
  },
  heroSmall: { fontSize: 12, lineHeight: 20, flexShrink: 1 },
  track: { height: 6, borderRadius: radius.pill, overflow: 'hidden' },
  fill: {
    position: 'absolute',
    top: 0,
    height: '100%',
    borderRadius: radius.pill
  },
  totals: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingTop: spacing.md,
    marginTop: spacing.sm,
    borderTopWidth: 1
  },
  actionPanel: { padding: spacing.md, gap: spacing.xs },
  scheduleSection: { gap: spacing.sm, marginTop: spacing.sm },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm
  },
  scheduleCard: {
    borderWidth: 0,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: 0,
    gap: 0
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg
  },
  scheduleCopy: {
    ...layoutDirectionStyle('ltr'),
    flex: 1,
    minWidth: 0,
    gap: spacing.xs
  },
  scheduleValue: {
    ...layoutDirectionStyle('ltr'),
    flexShrink: 1,
    maxWidth: '48%',
    gap: spacing.xs
  },
  statusChip: {
    borderRadius: 5,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2
  },
  pending: {
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.lg
  },
  disclosureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 62
  },
  disclosureTitle: { flex: 1 },
  disclosureContent: { gap: spacing.md, paddingBottom: spacing.lg },
  detailLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  detailValue: { flexShrink: 1 },
  history: { gap: spacing.md },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  historyCopy: { flex: 1, minWidth: 0 },
  footer: { gap: spacing.xs, marginTop: spacing.sm },
  primaryPayment: {
    minHeight: 52,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: 13
  },
  quietButton: {
    minHeight: 48,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm
  }
});
