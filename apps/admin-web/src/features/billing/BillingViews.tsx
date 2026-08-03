"use client";

import Link from "next/link";
import { Crown, Gift, Star } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { PermissionBoundary } from "@/components/admin/PermissionBoundary";
import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  RegionState,
  WarningState,
  type RegionStateLike,
} from "@/components/admin/ui";
import { ApiError } from "@/core/api/errors";
import { useSimulatedRole } from "@/core/auth/use-simulated-role";
import {
  getActionLabel,
  getPlanLabel,
  getPlatformLabel,
  getSeverityLabel,
  getStatusLabel,
} from "@/core/localization/display-labels";
import { useLocale } from "@/core/localization/provider";
import { hasPermission } from "@/core/permissions/role-map";
import {
  useCreatePromotionalCode,
  useFailedPaymentAction,
  useFailedPayments,
  usePaymentEvent,
  usePaymentEvents,
  usePaymentsOverview,
  usePlans,
  usePromotionalCodes,
  useReconciliationAction,
  useReconciliationIssues,
  useSubscription,
  useSubscriptionAction,
  useSubscriptions,
  useUpdatePlan,
  useUpdatePromotionalCode,
} from "@/features/billing/hooks";
import {
  billingActionResultSchema,
  failedPaymentActionSchema,
  planMutationRequestSchema,
  promotionalCodeMutationRequestSchema,
  reconciliationActionRequestSchema,
  subscriptionActionRequestSchema,
  type BillingActionResult,
  type Currency,
  type FailedPaymentAction,
  type FailedPaymentItem,
  type PaymentEventListItem,
  type PlanDetail,
  type PromotionalCodeDetail,
  type ReconciliationDecision,
  type ReconciliationItem,
  type SanitizedPaymentPayloadPreview,
  type SubscriptionAction,
  type SubscriptionDetail,
  type SubscriptionListItem,
} from "@/features/billing/contracts";
import { formatAdminNumber, formatDate } from "@/lib/admin-utils";

const TOKEN = "TOKEN-MOCK-20260728";
const PLAN_IDS = ["PLAN-Free", "PLAN-Basic", "PLAN-Premium"] as const;

const billingViewsCopy = {
  ar: {
    subscriptionsTitle: "قائمة الاشتراكات المقنعة",
    searchSubscriptions: "بحث الاشتراكات",
    searchSubscriptionsPlaceholder: "بحث بالاسم أو البريد المقنع",
    platform: "المنصة",
    clearFilters: "مسح التصفية",
    subscription: "الاشتراك",
    customer: "العميل",
    maskedEmail: "البريد المقنع",
    plan: "الخطة",
    status: "الحالة",
    amount: "المبلغ",
    renewal: "التجديد",
    payment: "الدفع",
    totalResults: "إجمالي النتائج",
    customerSubscriptions: "اشتراكات العملاء",
    paymentEventsTitle: "أحداث الدفع",
    event: "الحدث",
    type: "النوع",
    attempts: "المحاولات",
    paymentMetrics: "مؤشرات المدفوعات",
    failed: "فاشلة",
    pending: "معلقة",
    reconciliation: "مطابقة",
    reconciliationNote: "مشكلات تحتاج مراجعة",
    paymentsPageTitle: "المدفوعات والأحداث",
    paymentsPageDesc: "عرض أحداث دفع مقنعة وسماح تفصيلي محدود دون بطاقات أو رموز أو تفاصيل مزود خام.",
  },
  en: {
    subscriptionsTitle: "Masked subscription list",
    searchSubscriptions: "Search subscriptions",
    searchSubscriptionsPlaceholder: "Search by name or masked email",
    platform: "Platform",
    clearFilters: "Clear filters",
    subscription: "Subscription",
    customer: "Customer",
    maskedEmail: "Masked email",
    plan: "Plan",
    status: "Status",
    amount: "Amount",
    renewal: "Renewal",
    payment: "Payment",
    totalResults: "Total results",
    customerSubscriptions: "Customer subscriptions",
    paymentEventsTitle: "Payment events",
    event: "Event",
    type: "Type",
    attempts: "Attempts",
    paymentMetrics: "Payment metrics",
    failed: "Failed",
    pending: "Pending",
    reconciliation: "Reconciliation",
    reconciliationNote: "Issues need review",
    paymentsPageTitle: "Payments and Events",
    paymentsPageDesc: "View masked payment events and limited detailed authorization without cards, tokens, or raw provider details.",
  },
} as const;

function money(amount: number, currency: Currency): string {
  return `${formatAdminNumber(amount)} ${currency}`;
}

function dateText(value: string | null): string {
  return value ? formatDate(value, true) : "—";
}

function regionError(error: unknown): { code?: string } | undefined {
  return error instanceof ApiError ? { code: error.code } : undefined;
}

function regionOf(data: { region?: RegionStateLike } | undefined): RegionStateLike | undefined {
  return data?.region;
}

function ResultNotice({ result }: { result: BillingActionResult | null }) {
  if (!result) return null;
  return <p className="toast toast-success" role="status">{result.message} <bdi className="ltr">{result.plannedAuditReference}</bdi></p>;
}

function PlainBadge({ children }: { children: React.ReactNode }) {
  return <span className="badge severity-info">{children}</span>;
}

function PlanBadge({ plan }: { plan: SubscriptionListItem["plan"] }) {
  const { locale } = useLocale();
  const Icon = plan === "Premium" ? Crown : plan === "Basic" ? Star : Gift;
  return (
    <span className={`badge plan-badge plan-${plan.toLowerCase()}`}>
      <Icon size={13} strokeWidth={2.4} aria-hidden="true" />
      <span>{getPlanLabel(locale, plan)}</span>
    </span>
  );
}

function SubscriptionStatusBadge({ status }: { status: SubscriptionListItem["status"] }) {
  const { locale } = useLocale();
  return (
    <span className={`badge subscription-status subscription-status-${status.replaceAll("_", "-")}`}>
      {getStatusLabel(locale, status)}
    </span>
  );
}

function PlatformChips({ platform }: { platform: SubscriptionListItem["customer"]["platform"] }) {
  const { locale } = useLocale();
  if (platform === "multi_platform") {
    return (
      <span className="subscription-platform-cell">
        <span className="platform-chip platform-chip-ios">{getPlatformLabel(locale, "ios")}</span>
        <span className="platform-chip platform-chip-android">{getPlatformLabel(locale, "android")}</span>
      </span>
    );
  }

  const label = getPlatformLabel(locale, platform);
  const chipClass = platform === "ios" || platform === "android" ? `platform-chip-${platform}` : "platform-chip-unattributed";
  return <span className="subscription-platform-cell"><span className={`platform-chip ${chipClass}`}>{label}</span></span>;
}

function AmountValue({ amount, currency }: { amount: number; currency: Currency }) {
  return (
    <span className="subscription-amount ltr">
      <span>{currency}</span>
      <strong>{formatAdminNumber(amount)}</strong>
    </span>
  );
}

function PaymentBadge({ status }: { status: SubscriptionListItem["paymentStatus"] }) {
  const { locale } = useLocale();
  const key = status.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  return <span className={`badge subscription-payment subscription-payment-${key}`}>{getStatusLabel(locale, status)}</span>;
}

function PaymentStatusBadge({ status }: { status: string }) {
  const { locale } = useLocale();
  return <span className={`badge payment-event-status payment-event-status-${status}`}>{getStatusLabel(locale, status)}</span>;
}

function PaymentAmount({ amount, currency }: { amount: number; currency: Currency }) {
  return <span className="payment-amount ltr">{money(amount, currency)}</span>;
}

export function SubscriptionRows({ subscriptions }: { subscriptions: SubscriptionListItem[] }) {
  return subscriptions.map((subscription) => (
    <tr key={subscription.id}>
      <td className="ltr subscription-id-cell"><Link href={`/admin/subscriptions/${subscription.id}`}>{subscription.id}</Link></td>
      <td className="subscription-customer-cell"><strong>{subscription.customer.displayName}</strong><small className="ltr">{subscription.customer.maskedEmail}</small></td>
      <td><PlanBadge plan={subscription.plan} /></td>
      <td><SubscriptionStatusBadge status={subscription.status} /></td>
      <td><PlatformChips platform={subscription.customer.platform} /></td>
      <td><AmountValue amount={subscription.amount.amount} currency={subscription.amount.currency} /></td>
      <td className="subscription-renewal-cell"><time dateTime={subscription.renewalDate ?? undefined}>{dateText(subscription.renewalDate)}</time></td>
      <td><PaymentBadge status={subscription.paymentStatus} /></td>
    </tr>
  ));
}

export function SubscriptionCards({ subscriptions }: { subscriptions: SubscriptionListItem[] }) {
  const { locale } = useLocale();
  const copy = billingViewsCopy[locale];
  return (
    <div className="mobile-cards" aria-label={copy.customerSubscriptions}>
      {subscriptions.map((subscription) => (
        <article className="mobile-data-card" key={subscription.id}>
          <div className="mobile-data-head">
            <Link className="ltr" href={`/admin/subscriptions/${subscription.id}`}>{subscription.id}</Link>
            <PlainBadge>{getStatusLabel(locale, subscription.status)}</PlainBadge>
          </div>
          <div className="mobile-data-meta">
            <span><small>{copy.customer}</small>{subscription.customer.displayName}</span>
            <span><small>{copy.maskedEmail}</small>{subscription.customer.maskedEmail}</span>
            <span><small>{copy.plan}</small>{getPlanLabel(locale, subscription.plan)}</span>
            <span><small>{copy.amount}</small>{money(subscription.amount.amount, subscription.amount.currency)}</span>
          </div>
        </article>
      ))}
    </div>
  );
}

export function SubscriptionsList() {
  const role = useSimulatedRole();
  const { locale } = useLocale();
  const copy = billingViewsCopy[locale];
  const allowed = hasPermission(role, "subscriptions.read");
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState<"all" | "ios" | "android" | "multi_platform">("all");
  const query = useSubscriptions({
    search: search || undefined,
    platform,
    sort: "renewalDate",
    order: "asc",
    page: 1,
    pageSize: 25,
  });
  return (
    <div className="page subscriptions-list-page">
      <PermissionBoundary allowed={allowed} permission="subscriptions.read">
        <section className="table-card subscriptions-list-card" aria-labelledby="subscriptions-list-title">
          <h2 id="subscriptions-list-title">{copy.subscriptionsTitle}</h2>
          <div className="toolbar">
            <div className="toolbar-filters">
              <input className="input" aria-label={copy.searchSubscriptions} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={copy.searchSubscriptionsPlaceholder} />
              <select className="select" aria-label={copy.platform} value={platform} onChange={(event) => setPlatform(event.target.value as typeof platform)}>
                <option value="all">{getPlatformLabel(locale, "all")}</option>
                <option value="ios">{getPlatformLabel(locale, "ios")}</option>
                <option value="android">{getPlatformLabel(locale, "android")}</option>
                <option value="multi_platform">{getPlatformLabel(locale, "multi_platform")}</option>
              </select>
            </div>
            <button className="button" type="button" onClick={() => { setSearch(""); setPlatform("all"); }}>{copy.clearFilters}</button>
          </div>
          <RegionState isPending={query.isPending} isError={query.isError} region={regionOf(query.data)} error={regionError(query.error)} onRetry={() => query.refetch()} permission="subscriptions.read">
            {!query.data?.items.length ? <EmptyState /> : (
              <>
                <div className="desktop-table">
                  <table className="data-table subscriptions-table">
                    <thead><tr><th>{copy.subscription}</th><th>{copy.customer}</th><th>{copy.plan}</th><th>{copy.status}</th><th>{copy.platform}</th><th>{copy.amount}</th><th>{copy.renewal}</th><th>{copy.payment}</th></tr></thead>
                    <tbody><SubscriptionRows subscriptions={query.data.items} /></tbody>
                  </table>
                </div>
                <SubscriptionCards subscriptions={query.data.items} />
                <p className="pagination">{copy.totalResults}: {formatAdminNumber(query.data.meta.total)}</p>
              </>
            )}
          </RegionState>
        </section>
      </PermissionBoundary>
    </div>
  );
}

function SubscriptionActionControls({ subscription }: { subscription: SubscriptionDetail }) {
  const canManage = hasPermission(useSimulatedRole(), "subscriptions.manage");
  const { locale } = useLocale();
  const mutation = useSubscriptionAction(subscription.id);
  const [action, setAction] = useState<SubscriptionAction | null>(null);
  const [reason, setReason] = useState("");
  const [targetPlanId, setTargetPlanId] = useState<(typeof PLAN_IDS)[number]>("PLAN-Basic");
  const [result, setResult] = useState<BillingActionResult | null>(null);
  if (!canManage) return <WarningState message="هذه الواجهة تقرأ التفاصيل فقط للدور الحالي." />;
  const submit = () => {
    if (!action) return;
    const parsed = subscriptionActionRequestSchema.safeParse({
      action,
      reason,
      expectedCurrentState: subscription.expectedState,
      confirmationToken: TOKEN,
      ...(action === "change_plan" ? { targetPlanId, effectiveTiming: "immediate" } : {}),
      ...(action === "record_internal_note" ? { note: reason } : {}),
    });
    if (!parsed.success) return;
    mutation.mutate(parsed.data, { onSuccess: (data) => { setResult(billingActionResultSchema.parse(data)); setAction(null); setReason(""); } });
  };
  return (
    <section className="card subscription-actions-card" aria-labelledby="subscription-actions-title">
      <div className="card-heading"><div><h2 id="subscription-actions-title">إجراءات الاشتراك المحاكاة</h2><p>لا توجد رسوم أو رسائل أو اتصال مزود دفع حقيقي.</p></div></div>
      <ResultNotice result={result} />
      <div className="toolbar-actions">
        {subscription.permittedActions.map((item) => (
          <button className="button" disabled={mutation.isPending} key={item} type="button" onClick={() => setAction(item)}>{getActionLabel(locale, item)}</button>
        ))}
      </div>
      {action && (
        <ConfirmDialog
          open
          onClose={() => setAction(null)}
          onConfirm={submit}
          title={getActionLabel(locale, action)}
          scope={subscription.id}
          consequence="تسجيل تغيير mock في ذاكرة المتصفح فقط دون عملية مالية."
          permission="subscriptions.manage"
          auditEvent="billing.subscription.action.planned"
          pending={mutation.isPending}
          outcomes={{ success: "تم تسجيل العملية", failure: "تعذر التسجيل", conflict: "الحالة تغيرت" }}
        >
          <label>سبب الإجراء<input className="input" value={reason} onChange={(event) => setReason(event.target.value)} /></label>
          {action === "change_plan" && (
            <label>الخطة الجديدة
              <select className="select" value={targetPlanId} onChange={(event) => setTargetPlanId(event.target.value as typeof targetPlanId)}>
                {PLAN_IDS.map((id) => <option key={id} value={id}>{id}</option>)}
              </select>
            </label>
          )}
        </ConfirmDialog>
      )}
    </section>
  );
}

export function SubscriptionDetailView({ subscriptionId }: { subscriptionId: string }) {
  const role = useSimulatedRole();
  const { locale } = useLocale();
  const allowed = hasPermission(role, "subscriptions.detail.read");
  const query = useSubscription({ subscriptionId });
  return (
    <PermissionBoundary allowed={allowed} permission="subscriptions.detail.read">
      <div className="page">
        <PageHeader title="تفاصيل الاشتراك" description="بيانات اشتراك مقنعة ومراجع مزود آمنة فقط." />
        <RegionState isPending={query.isPending} isError={query.isError || !query.data} region={undefined} error={regionError(query.error)} onRetry={() => query.refetch()} permission="subscriptions.detail.read">
          {query.data && (
            <>
              <section className="table-card subscription-detail-card" aria-labelledby="subscription-detail-title">
                <h2 id="subscription-detail-title">{query.data.customer.displayName}</h2>
                <div className="detail-grid subscription-detail-grid">
                  <Detail label="معرف الاشتراك" value={query.data.id} ltr />
                  <Detail label="البريد المقنع" value={query.data.customer.maskedEmail} />
                  <Detail label="الخطة" value={getPlanLabel(locale, query.data.plan)} />
                  <Detail label="الحالة" value={getStatusLabel(locale, query.data.status)} />
                  <Detail label="المبلغ" value={money(query.data.amount.amount, query.data.amount.currency)} />
                  <Detail label="التجديد" value={dateText(query.data.renewalDate)} />
                  <Detail label="مراجع المزود الآمنة" value={query.data.safeProviderReferences.join("، ")} ltr />
                </div>
              </section>
              <SubscriptionActionControls subscription={query.data} />
            </>
          )}
        </RegionState>
      </div>
    </PermissionBoundary>
  );
}

function Detail({ label, value, ltr = false }: { label: string; value: React.ReactNode; ltr?: boolean }) {
  return <div className="detail-item"><small>{label}</small><strong className={ltr ? "ltr" : undefined}>{value}</strong></div>;
}

const planFormSchema = planMutationRequestSchema.extend({ reason: z.string().min(3) });

function PlanEditor({ plan }: { plan: PlanDetail }) {
  const form = useForm<z.input<typeof planFormSchema>>({ defaultValues: { ...plan, reason: "", confirmationToken: TOKEN } });
  const mutation = useUpdatePlan(plan.id);
  const [confirm, setConfirm] = useState<z.infer<typeof planFormSchema> | null>(null);
  const [result, setResult] = useState("");
  return (
    <article className="mobile-data-card">
      <h3>{plan.name}</h3>
      <p>{money(plan.price.amount, plan.price.currency)} · {plan.interval}</p>
      <form onSubmit={form.handleSubmit((values) => {
        const parsed = planFormSchema.safeParse(values);
        if (parsed.success) setConfirm(parsed.data);
        else form.setError("root", { message: "تحقق من حدود الخطة والسبب." });
      })}>
        <label>السعر<input className="input" type="number" step="0.01" {...form.register("price.amount", { valueAsNumber: true })} /></label>
        <label>السبب<input className="input" {...form.register("reason")} /></label>
        {form.formState.errors.root && <p className="field-error" role="alert">{form.formState.errors.root.message}</p>}
        <button className="button" disabled={mutation.isPending} type="submit">مراجعة التعديل</button>
      </form>
      {result && <p className="toast toast-success" role="status">{result}</p>}
      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (!confirm) return;
          mutation.mutate(confirm, { onSuccess: () => { setResult("تم حفظ تعديل mock للخطة."); setConfirm(null); } });
        }}
        title="تأكيد تعديل الخطة"
        scope={plan.id}
        consequence="تحديث mock فقط مع عرض قبل/بعد، دون مزود دفع."
        permission="plans.manage"
        auditEvent="billing.plan.update.planned"
        pending={mutation.isPending}
        outcomes={{ success: "تم الحفظ", failure: "تعذر الحفظ", conflict: "الحالة تغيرت" }}
      />
    </article>
  );
}

export function PlanManagementView() {
  const role = useSimulatedRole();
  const allowed = hasPermission(role, "plans.read");
  const query = usePlans();
  return (
    <PermissionBoundary allowed={allowed} permission="plans.read">
      <div className="page">
        <PageHeader title="الخطط والأسعار" description="Free و Basic و Premium كبيانات mock آمنة، مع عملات صريحة ودون مزود دفع." />
        {query.isPending ? <LoadingState /> : query.isError ? <ErrorState /> : (
          <section className="section-grid equal" aria-label="الخطط">
            {query.data?.map((plan) => <PlanEditor key={plan.id} plan={plan} />)}
          </section>
        )}
      </div>
    </PermissionBoundary>
  );
}

type PromoForm = z.input<typeof promotionalCodeMutationRequestSchema>;

function promoDefaults(): PromoForm {
  return {
    id: "PROMO-NEWMOCK",
    code: "NEWMOCK",
    discountKind: "percentage",
    discountValue: 10,
    duration: "once",
    redemptionCount: 0,
    redemptionLimit: 100,
    expiresAt: "2026-12-31T23:59:59+03:00",
    status: "draft",
    eligiblePlanIds: ["PLAN-Basic"],
    reason: "",
    confirmationToken: TOKEN,
  };
}

export function PromotionalCodesView() {
  const role = useSimulatedRole();
  const { locale } = useLocale();
  const allowed = hasPermission(role, "promotions.read");
  const query = usePromotionalCodes({ page: 1, pageSize: 25 });
  const createMutation = useCreatePromotionalCode();
  const [editTarget, setEditTarget] = useState<PromotionalCodeDetail | null>(null);
  const updateMutation = useUpdatePromotionalCode(editTarget?.id ?? "PROMO-WELCOME10");
  const form = useForm<PromoForm>({ defaultValues: promoDefaults() });
  const [result, setResult] = useState("");
  const submit = (values: PromoForm) => {
    const parsed = promotionalCodeMutationRequestSchema.safeParse(values);
    if (!parsed.success) {
      form.setError("root", { message: "تحقق من رمز العرض والخصم والسبب." });
      return;
    }
    const mutation = editTarget ? updateMutation : createMutation;
    mutation.mutate(parsed.data, { onSuccess: () => { setResult("تم تسجيل تغيير ترويجي mock."); setEditTarget(null); form.reset(promoDefaults()); } });
  };
  return (
    <PermissionBoundary allowed={allowed} permission="promotions.read">
      <div className="page">
        <PageHeader title="الأكواد الترويجية" description="إنشاء وتعديل وتعطيل mock فقط داخل واجهة الفوترة." />
        <section className="table-card" aria-labelledby="promos-title">
          <h2 id="promos-title">الأكواد الحالية</h2>
          {query.isPending ? <LoadingState /> : query.isError ? <ErrorState /> : !query.data?.items.length ? <EmptyState /> : (
            <div className="desktop-table">
              <table className="data-table">
                <thead><tr><th>الكود</th><th>الخصم</th><th>المدة</th><th>الاستخدام</th><th>الحالة</th><th>إجراء</th></tr></thead>
                <tbody>{query.data.items.map((promo) => (
                  <tr key={promo.id}>
                    <td className="ltr">{promo.code}</td>
                    <td>{promo.discountKind === "percentage" ? `${promo.discountValue}%` : money(promo.discountValue, "AED")}</td>
                    <td>{promo.duration}</td>
                    <td>{formatAdminNumber(promo.redemptionCount)}</td>
                    <td><PlainBadge>{getStatusLabel(locale, promo.status)}</PlainBadge></td>
                    <td><button className="button" type="button" onClick={() => { setEditTarget(promo); form.reset({ ...promo, reason: "", confirmationToken: TOKEN }); }}>تعديل</button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>
        <section className="card" aria-labelledby="promo-form-title">
          <div className="card-heading"><div><h2 id="promo-form-title">{editTarget ? "تعديل كود" : "إنشاء كود"}</h2><p>تحقق Zod قبل تسجيل أي تغيير mock.</p></div></div>
          <form onSubmit={form.handleSubmit(submit)}>
            <label>الكود<input className="input ltr" {...form.register("code")} /></label>
            <label>قيمة الخصم<input className="input" type="number" {...form.register("discountValue", { valueAsNumber: true })} /></label>
            <label>السبب<input className="input" {...form.register("reason")} /></label>
            {form.formState.errors.root && <p className="field-error" role="alert">{form.formState.errors.root.message}</p>}
            {result && <p className="toast toast-success" role="status">{result}</p>}
            <button className="button primary" type="submit">حفظ mock</button>
          </form>
        </section>
      </div>
    </PermissionBoundary>
  );
}

export function PaymentEventRows({ events }: { events: PaymentEventListItem[] }) {
  return events.map((event) => (
    <tr key={event.id}>
      <td className="ltr payment-event-id"><Link href={`/admin/payments/events/${event.id}`}>{event.id}</Link></td>
      <td className="payment-customer-cell">{event.customer.displayName}<small className="ltr">{event.customer.maskedEmail}</small></td>
      <td><span className="payment-event-type ltr">{event.eventType}</span></td>
      <td><PaymentStatusBadge status={event.status} /></td>
      <td><PaymentAmount amount={event.amount.amount} currency={event.amount.currency} /></td>
      <td className="numbers">{event.retryCount}</td>
    </tr>
  ));
}

export function PaymentsOverviewView() {
  const role = useSimulatedRole();
  const { locale } = useLocale();
  const copy = billingViewsCopy[locale];
  const allowed = hasPermission(role, "payments.read");
  const overview = usePaymentsOverview({ period: "30d", platform: "all" });
  const events = usePaymentEvents({ platform: "all", sort: "date", order: "desc", page: 1, pageSize: 25 });
  return (
    <PermissionBoundary allowed={allowed} permission="payments.read">
      <div className="page">
        <PageHeader title={copy.paymentsPageTitle} description={copy.paymentsPageDesc} />
        <RegionState isPending={overview.isPending} isError={overview.isError} region={regionOf(overview.data)} error={regionError(overview.error)} onRetry={() => overview.refetch()} permission="payments.read">
          <section className="metrics-grid payment-metrics-grid" aria-label={copy.paymentMetrics}>
            {overview.data?.currencyGroups.map((group) => (
              <article className="metric-card" key={group.currency}>
                <span>{group.currency}</span>
                <strong className="metric-value payment-metric-value ltr">{money(group.successful, group.currency)}</strong>
                <small>{copy.failed} {money(group.failed, group.currency)} · {copy.pending} {money(group.pending, group.currency)}</small>
              </article>
            ))}
            <article className="metric-card"><span>{copy.reconciliation}</span><strong className="metric-value">{overview.data?.reconciliationCount ?? 0}</strong><small>{copy.reconciliationNote}</small></article>
          </section>
        </RegionState>
        <section className="table-card payment-events-card" aria-labelledby="payment-events-title">
          <h2 id="payment-events-title">{copy.paymentEventsTitle}</h2>
          <RegionState isPending={events.isPending} isError={events.isError} region={regionOf(events.data)} error={regionError(events.error)} onRetry={() => events.refetch()} permission="payments.read">
            {!events.data?.items.length ? <EmptyState /> : (
              <div className="desktop-table">
                <table className="data-table payment-events-table">
                  <thead><tr><th>{copy.event}</th><th>{copy.customer}</th><th>{copy.type}</th><th>{copy.status}</th><th>{copy.amount}</th><th>{copy.attempts}</th></tr></thead>
                  <tbody><PaymentEventRows events={events.data.items} /></tbody>
                </table>
              </div>
            )}
          </RegionState>
        </section>
      </div>
    </PermissionBoundary>
  );
}

export function PaymentEventPayloadPreview({ preview }: { preview: SanitizedPaymentPayloadPreview }) {
  return (
    <section className="card payment-payload-card" aria-labelledby="payload-preview-title">
      <div className="card-heading">
        <div>
          <h2 id="payload-preview-title">معاينة الحقول المسموحة</h2>
          <p>نص عادي فقط، بدون raw JSON أو HTML أو روابط مزود أو بيانات بطاقة.</p>
        </div>
      </div>
      <div className="detail-grid payment-payload-grid">
        <Detail label="معرف الحدث" value={preview.eventId} ltr />
        <Detail label="النوع" value={preview.eventType} ltr />
        <Detail label="الحالة" value={<PaymentStatusBadge status={preview.status} />} />
        <Detail label="الاستلام" value={dateText(preview.receivedAt)} ltr />
        <Detail label="المعالجة" value={dateText(preview.processedAt)} ltr />
        <Detail label="المبلغ" value={<PaymentAmount amount={preview.amount.amount} currency={preview.amount.currency} />} />
        <Detail label="مرجع الاشتراك" value={preview.subscriptionReference} ltr />
        <Detail label="عدد المحاولات" value={formatAdminNumber(preview.retryCount)} />
        {preview.providerErrorCode && <Detail label="رمز خطأ المزود" value={preview.providerErrorCode} ltr />}
        {preview.providerErrorMessage && <Detail label="رسالة خطأ المزود" value={preview.providerErrorMessage} />}
      </div>
    </section>
  );
}

export function PaymentEventDetailView({ eventId }: { eventId: string }) {
  const role = useSimulatedRole();
  const allowed = hasPermission(role, "payments.detail.read");
  const query = usePaymentEvent({ eventId });
  return (
    <PermissionBoundary allowed={allowed} permission="payments.detail.read">
      <div className="page">
        <PageHeader title="تفاصيل حدث الدفع" description="معاينة allowlist كنص عادي فقط؛ لا raw JSON ولا HTML ولا روابط مزود." />
        {query.isPending ? <LoadingState /> : query.isError || !query.data ? <ErrorState /> : (
          <section className="table-card payment-event-detail-card">
            <h2 className="ltr">{query.data.id}</h2>
            <div className="detail-grid payment-event-summary-grid">
              <Detail label="العميل" value={`${query.data.customer.displayName} · ${query.data.customer.maskedEmail}`} />
              <Detail label="الاشتراك" value={query.data.subscriptionId} ltr />
              <Detail label="المبلغ" value={<PaymentAmount amount={query.data.amount.amount} currency={query.data.amount.currency} />} />
              <Detail label="الحالة" value={<PaymentStatusBadge status={query.data.status} />} />
            </div>
            <div className="privacy-notice">المعاينة تعرض الحقول المسموحة فقط: eventId، النوع، الحالة، الوقت، المبلغ، مرجع الاشتراك، وعدد المحاولات.</div>
            <PaymentEventPayloadPreview preview={query.data.payloadPreview} />
            <div className="timeline payment-event-timeline">
              {query.data.timeline.map((item) => <div className="timeline-item payment-event-timeline-item" key={`${item.timestamp}-${item.event}`}><strong>{item.event}</strong><p>{item.message}</p><time dateTime={item.timestamp}>{dateText(item.timestamp)}</time></div>)}
            </div>
          </section>
        )}
      </div>
    </PermissionBoundary>
  );
}

function FailedPaymentActionButton({ failure, action }: { failure: FailedPaymentItem; action: FailedPaymentAction }) {
  const { locale } = useLocale();
  const mutation = useFailedPaymentAction(failure.id);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="button" disabled={mutation.isPending} type="button" onClick={() => setOpen(true)}>{getActionLabel(locale, action)}</button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={() => mutation.mutate({ action, reason: "mock operator review", scope: failure.id, expectedCurrentState: failure.expectedState, confirmationToken: TOKEN }, { onSuccess: () => setOpen(false) })}
        title={getActionLabel(locale, action)}
        scope={failure.id}
        consequence="تسجيل نتيجة mock فقط؛ لا retry أو charge أو refund أو إشعار."
        permission="payment_failures.manage"
        auditEvent="billing.failed-payment.action.planned"
        pending={mutation.isPending}
        outcomes={{ success: "تم التسجيل", failure: "تعذر التسجيل", conflict: "الحالة تغيرت" }}
      />
    </>
  );
}

export function FailedPaymentsView() {
  const role = useSimulatedRole();
  const { locale } = useLocale();
  const allowed = hasPermission(role, "payment_failures.manage");
  const query = useFailedPayments({ platform: "all", sort: "date", order: "desc", page: 1, pageSize: 25 });
  const actions = failedPaymentActionSchema.options;
  return (
    <PermissionBoundary allowed={allowed} permission="payment_failures.manage">
      <div className="page">
        <PageHeader title="المدفوعات الفاشلة" description="تسجيل نتائج تشغيلية محاكاة فقط دون تنفيذ أي عملية مالية." />
        <RegionState isPending={query.isPending} isError={query.isError} region={regionOf(query.data)} error={regionError(query.error)} onRetry={() => query.refetch()} permission="payment_failures.manage">
          {!query.data?.items.length ? <EmptyState /> : (
            <section className="table-card">
              <div className="desktop-table">
                <table className="data-table">
                  <thead><tr><th>الفشل</th><th>العميل</th><th>الخطة</th><th>المبلغ</th><th>السبب</th><th>الحالة</th><th>إجراءات</th></tr></thead>
                  <tbody>{query.data.items.map((failure) => (
                    <tr key={failure.id}>
                      <td className="ltr">{failure.id}</td>
                      <td>{failure.customer.displayName}<small>{failure.customer.maskedEmail}</small></td>
                      <td>{getPlanLabel(locale, failure.plan)}</td>
                      <td>{money(failure.failedAmount.amount, failure.failedAmount.currency)}</td>
                      <td>{failure.reason}</td>
                      <td><PlainBadge>{getStatusLabel(locale, failure.status)}</PlainBadge></td>
                      <td className="toolbar-actions">{actions.map((action) => <FailedPaymentActionButton action={action} failure={failure} key={action} />)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </section>
          )}
        </RegionState>
      </div>
    </PermissionBoundary>
  );
}

function ReconciliationActionButton({ issue, decision }: { issue: ReconciliationItem; decision: ReconciliationDecision }) {
  const mutation = useReconciliationAction(issue.id);
  const { locale } = useLocale();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="button" disabled={mutation.isPending || issue.providerFreshness !== "fresh"} type="button" onClick={() => setOpen(true)}>{getActionLabel(locale, decision)}</button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={() => {
          const request = reconciliationActionRequestSchema.parse({ decision, reason: "mock reconciliation review", expectedIssueState: issue.expectedState, providerFreshness: issue.providerFreshness, confirmationToken: TOKEN });
          mutation.mutate(request, { onSuccess: () => setOpen(false) });
        }}
        title="تأكيد قرار المطابقة"
        scope={issue.id}
        consequence="تسجيل قرار mock فقط دون تعديل مزود أو قاعدة بيانات."
        permission="billing_reconciliation.manage"
        auditEvent="billing.reconciliation.decision.planned"
        pending={mutation.isPending}
        outcomes={{ success: "تم التسجيل", failure: "تعذر التسجيل", conflict: "مزود غير حديث أو حالة تغيرت" }}
      />
    </>
  );
}

export function ReconciliationView() {
  const role = useSimulatedRole();
  const { locale } = useLocale();
  const allowed = hasPermission(role, "billing_reconciliation.read");
  const query = useReconciliationIssues({ platform: "all", sort: "age", order: "desc", page: 1, pageSize: 25 });
  return (
    <PermissionBoundary allowed={allowed} permission="billing_reconciliation.read">
      <div className="page">
        <PageHeader title="مطابقة الفوترة" description="مقارنة آمنة بين الحالة الداخلية وحالة المزود، وقرارات محاكاة فقط." />
        <RegionState isPending={query.isPending} isError={query.isError} region={regionOf(query.data)} error={regionError(query.error)} onRetry={() => query.refetch()} permission="billing_reconciliation.read">
          {!query.data?.items.length ? <EmptyState /> : (
            <section className="table-card">
              <div className="desktop-table">
                <table className="data-table">
                  <thead><tr><th>المشكلة</th><th>الشدة</th><th>الحالة الداخلية</th><th>حالة المزود</th><th>الأثر</th><th>الحداثة</th><th>قرار</th></tr></thead>
                  <tbody>{query.data.items.map((issue) => (
                    <tr key={issue.id}>
                      <td><bdi className="ltr">{issue.id}</bdi><small>{issue.difference}</small></td>
                      <td><PlainBadge>{getSeverityLabel(locale, issue.severity)}</PlainBadge></td>
                      <td>{getStatusLabel(locale, issue.internalStatus)}</td>
                      <td>{getStatusLabel(locale, issue.providerStatus)}</td>
                      <td>{issue.currencyImpact ? money(issue.currencyImpact.amount, issue.currencyImpact.currency) : "—"}</td>
                      <td>{getStatusLabel(locale, issue.providerFreshness)}</td>
                      <td><ReconciliationActionButton decision="mark_reviewing" issue={issue} /></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </section>
          )}
        </RegionState>
      </div>
    </PermissionBoundary>
  );
}
