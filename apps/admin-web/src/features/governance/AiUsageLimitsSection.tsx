"use client";

import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, CheckCircle2, ChevronDown, CirclePause, Mic, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/admin/ui";
import { useAdminIdentity } from "@/app/providers";
import { apiActorCacheKey } from "@/core/api/client";
import { ApiError } from "@/core/api/errors";
import { useLocale } from "@/core/localization/provider";
import { useAdminSession } from "@/features/foundation/hooks";
import { aiUsageRepository, quotaValue, type AiUsage, type AiUsageKey } from "./ai-usage";
import styles from "./AiUsageLimitsSection.module.css";

const messages = {
  ar: { title: "حدود استخدام الذكاء الاصطناعي", direct: "القراءات المالية المباشرة لا تستهلك حصة مزود الذكاء الاصطناعي.",
    user: "معرّف المستخدم", load: "تحميل", daily: "طلبات لكل مستخدم / ٢٤ ساعة", monthly: "حد شهري لكل مستخدم (فارغ = بلا حد)",
    enabled: "السماح بطلبات الميزة", effective: "الحد الفعلي", used: "المستهلك", remaining: "المتبقي", reset: "بداية استعادة الحصة",
    month: "الشهر التقويمي UTC", cost: "التكلفة المقدّرة/المحجوزة USD", cap: "سقف تكلفة المشروع الشهري USD", legacy: "الحد الافتراضي للميزات الأخرى",
    override: "تخصيص المستخدم (فارغ = وراثة الافتراضي)", reason: "سبب التغيير", save: "حفظ", saved: "تم حفظ الإعداد وتسجيل التغيير.",
    invalid: "تحقق من القيمة وسبب التغيير (١٠ أحرف على الأقل).", conflict: "تغيرت النسخة. تم تحديث القيم؛ راجعها قبل إعادة المحاولة.",
    auth: "يلزم تسجيل دخول حديث لإكمال التغيير.", error: "تعذر إكمال الطلب. أعد المحاولة.", history: "سجل تغييرات الحدود", refresh: "تحديث",
    loading: "جارٍ تحميل الحدود…", route: "مسار المزود متاح", on: "نعم", off: "لا", global: "القيم الافتراضية العامة", noCap: "بلا حد", version: "النسخة", change: "القيمة السابقة ← الجديدة",
    description: "إدارة حصص المساعد والصوت بشكل مستقل، ومتابعة الاستخدام والتكلفة.", chat: "Assistant Chat AI", voice: "Voice AI",
    enabledState: "مفعّل", disabledState: "معطّل", available: "متاح", unavailable: "غير متاح", dailyWindow: "آخر ٢٤ ساعة",
    policy: "السياسة الفعلية للمستخدم", userHelp: "اترك الحقل فارغًا لعرض حسابك، أو أدخل معرّف المستخدم المطلوب.",
    overrides: "تخصيص المستخدم", overrideHelp: "اترك كل حقل فارغًا لوراثة القيمة الافتراضية لذلك الحد. تخصيص المساعد والصوت مستقلان.",
    overrideMonthly: "تخصيص شهري (فارغ = وراثة الافتراضي)", inherited: "يرث الافتراضي", custom: "حد مخصص",
    defaults: "تعديل الإعدادات الافتراضية", budget: "التكلفة والميزانية", projectCost: "تكلفة المشروع المقدّرة والمحجوزة",
    budgetHelp: "القيم بالدولار الأمريكي. التكلفة المقدّرة والمحجوزة معروضة معًا.", resets: "تجدد الحصة", monthlyReset: "تجدد الشهر",
    reasonHelp: "١٠ أحرف على الأقل؛ يُحفظ السبب في سجل التدقيق.", saving: "جارٍ الحفظ…", auditDetails: "عرض تفاصيل التغيير",
    actor: "بواسطة", time: "الوقت (UTC)", setting: "الإعداد والسبب", noHistory: "لا توجد تغييرات مسجلة للحدود.",
    readOnly: "صلاحياتك تتيح العرض فقط؛ تعديل الحدود غير متاح.", other: "الميزات الأخرى" },
  en: { title: "AI Usage Limits", direct: "Direct deterministic financial reads do not consume AI-provider quota.",
    user: "User ID", load: "Load", daily: "Requests per user / 24 hours", monthly: "Monthly per-user limit (blank = no cap)",
    enabled: "Allow feature requests", effective: "Effective limit", used: "Used", remaining: "Remaining", reset: "First quota reset",
    month: "UTC calendar month", cost: "Estimated/reserved cost USD", cap: "Monthly project cost cap USD", legacy: "Other AI workloads default",
    override: "User override (blank = inherit default)", reason: "Change reason", save: "Save", saved: "Setting saved and change audited.",
    invalid: "Check the value and enter a reason of at least 10 characters.", conflict: "Version changed. Values refreshed; review them before retrying.",
    auth: "A recent sign-in is required to make this change.", error: "Request failed. Please retry.", history: "Quota change history", refresh: "Refresh",
    loading: "Loading limits…", route: "Provider route available", on: "Yes", off: "No", global: "Global defaults", noCap: "No cap", version: "Version", change: "Before → after",
    description: "Manage independent Chat and Voice quotas, and track usage and cost.", chat: "Assistant Chat AI", voice: "Voice AI",
    enabledState: "Enabled", disabledState: "Disabled", available: "Available", unavailable: "Unavailable", dailyWindow: "Rolling 24 hours",
    policy: "Effective user policy", userHelp: "Leave blank for your account, or enter the user ID to inspect.",
    overrides: "Per-user overrides", overrideHelp: "Leave each field blank to inherit its global limit. Chat and Voice overrides are independent.",
    overrideMonthly: "Monthly override (blank = inherit)", inherited: "Inherits default", custom: "Custom limit",
    defaults: "Edit global defaults", budget: "Cost & Budget", projectCost: "Project estimated/reserved cost",
    budgetHelp: "All costs are in USD. Estimated and reserved costs are shown together.", resets: "Quota resets", monthlyReset: "Month resets",
    reasonHelp: "At least 10 characters; the reason is recorded in the audit log.", saving: "Saving…", auditDetails: "Show change details",
    actor: "Changed by", time: "Time (UTC)", setting: "Setting & reason", noHistory: "No quota changes recorded.",
    readOnly: "You have read-only access; quota editing is unavailable.", other: "Other workloads" },
};
type Copy = typeof messages.en;

function SettingEditor({ settingKey, initial, version, label, type = "daily", canSave, userId, copy, onSaved, onNotice } : {
  settingKey: AiUsageKey; initial: unknown; version: number; label: string; type?: "daily" | "monthly" | "enabled" | "cost" | "override";
  canSave: boolean; userId: string; copy: Copy; onSaved: () => Promise<unknown>; onNotice: (message: string) => void;
}) {
  const override = initial as { rollingLimit?: number | null; monthlyLimit?: number | null };
  const [value, setValue] = useState(type === "override" ? String(override?.rollingLimit ?? "") : String(initial ?? ""));
  const [monthly, setMonthly] = useState(String(override?.monthlyLimit ?? ""));
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  const parse = () => {
    if (type === "enabled") return value === "true";
    if (type === "override") return { userId, rollingLimit: value === "" ? null : quotaValue(value, false), monthlyLimit: quotaValue(monthly, true) };
    if (type === "cost") {
      if (!/^[0-9]+(?:\.[0-9]{1,6})?$/.test(value) || Number(value) < 0.01 || Number(value) > 1_000_000) throw new Error("INVALID_COST");
      return Number(value);
    }
    return quotaValue(value, type === "monthly");
  };
  let changed = false;
  try { changed = JSON.stringify(parse()) !== JSON.stringify(type === "override" ? { userId, rollingLimit: override?.rollingLimit ?? null, monthlyLimit: override?.monthlyLimit ?? null } : initial); } catch { /* Invalid values cannot be submitted. */ }
  return <form data-setting={settingKey} className={styles.editor} onSubmit={async event => {
    event.preventDefault();
    if (!canSave || submitting.current || !changed) return;
    let next: unknown;
    try { next = parse(); if (reason.trim().length < 10 || reason.trim().length > 500) throw new Error("INVALID_REASON"); }
    catch { onNotice(copy.invalid); return; }
    submitting.current = true; setPending(true); onNotice("");
    try {
      await aiUsageRepository.update(settingKey, next, version, reason.trim());
      onNotice(`${label}: ${copy.saved}`); await onSaved();
    } catch (error) {
      onNotice(error instanceof ApiError && error.code === "recent_auth_required" ? copy.auth : error instanceof ApiError && error.status === 409 ? copy.conflict : copy.error);
      if (error instanceof ApiError && error.status === 409) await onSaved();
    } finally { submitting.current = false; setPending(false); }
  }}>
    <div className={styles.fields}>
      <label>{label}{type === "enabled" ? <select className="select" aria-label={label} value={value} disabled={!canSave || pending} onChange={event => setValue(event.target.value)}><option value="true">{copy.on}</option><option value="false">{copy.off}</option></select> :
        <input className="input numbers ltr" type="number" step={type === "cost" ? "0.01" : "1"} min={type === "cost" ? "0.01" : "1"} max={type === "daily" || type === "override" ? 1000 : 1_000_000} aria-label={label} value={value} disabled={!canSave || pending} onChange={event => setValue(event.target.value)} />}</label>
      {type === "override" && <label>{copy.overrideMonthly}<input className="input numbers ltr" type="number" min="1" max="1000000" step="1" value={monthly} disabled={!canSave || pending} onChange={event => setMonthly(event.target.value)} /></label>}
      <label className={styles.reason}>{copy.reason}<textarea className="input" aria-label={copy.reason} placeholder={copy.reasonHelp} rows={2} value={reason} maxLength={500} disabled={!canSave || pending} onChange={event => setReason(event.target.value)} /></label>
    </div>
    <div className={styles.editorFooter}><span>{copy.version}: <bdi>{version}</bdi></span><button className="button primary" type="submit" disabled={!canSave || pending || !changed || reason.trim().length < 10}>{pending ? copy.saving : copy.save}</button></div>
  </form>;
}

function QuotaTime({ at, locale }: { at: string; locale: "ar" | "en" }) {
  const formatted = new Intl.DateTimeFormat(locale === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", {
    dateStyle: "medium", timeStyle: "short", timeZone: "UTC",
  }).format(new Date(at));
  return <time dateTime={at} title={at} className={styles.time}>{formatted} UTC</time>;
}

function UsageValues({ feature, copy, locale }: { feature: AiUsage["features"][number]; copy: Copy; locale: "ar" | "en" }) {
  return <>
    <dl className={styles.quotaNumbers}>
      <div><dt>{copy.effective} / 24h</dt><dd className="numbers" data-quota="limit">{feature.limit}</dd></div>
      <div><dt>{copy.used}</dt><dd className="numbers" data-quota="used">{feature.used}</dd></div>
      <div><dt>{copy.remaining}</dt><dd className="numbers" data-quota="remaining">{feature.remaining}</dd></div>
    </dl>
    <dl className={styles.usageDetails}>
      <div><dt>{copy.reset}</dt><dd><QuotaTime at={feature.resetsAt} locale={locale} /></dd></div>
      <div><dt>{copy.month}</dt><dd><bdi>{feature.monthlyUsed}</bdi> / <bdi>{feature.monthlyLimit ?? copy.noCap}</bdi></dd><dd className={styles.meta}>{copy.remaining}: <bdi>{feature.monthlyRemaining ?? copy.noCap}</bdi></dd></div>
      <div><dt>{copy.monthlyReset}</dt><dd><QuotaTime at={feature.monthlyResetsAt} locale={locale} /></dd></div>
      <div><dt>{copy.route}</dt><dd>{feature.routeEnabled ? copy.available : copy.unavailable}</dd></div>
    </dl>
  </>;
}

export function AiUsageLimitsSection() {
  const { locale } = useLocale(); const copy = messages[locale];
  const identity = useAdminIdentity(); const session = useAdminSession(identity.actorId);
  const permissions = session.data?.effectivePermissionKeys ?? [];
  const canRead = identity.loaded && permissions.includes("operations.settings.read");
  const canSave = canRead && permissions.includes("operations.settings.manage") && permissions.includes("ai.routes.manage");
  const [inputUser, setInputUser] = useState(""); const [selectedUser, setSelectedUser] = useState(""); const [lookupError, setLookupError] = useState(false);
  const [notice, setNotice] = useState("");
  const client = useQueryClient(); const actor = apiActorCacheKey();
  const query = useQuery({ queryKey: ["ai-usage", actor, identity.actorId, selectedUser], enabled: canRead,
    queryFn: ({ signal }) => aiUsageRepository.read(selectedUser, signal), retry: false });
  const data = query.data;
  const refresh = () => client.invalidateQueries({ queryKey: ["ai-usage", actor, identity.actorId] });
  const editor = (key: AiUsageKey, label: string, type?: "daily" | "monthly" | "enabled" | "cost" | "override", initial?: unknown) => {
    const setting = data?.settings.find(item => item.key === key); if (!setting || !data) return null;
    return <SettingEditor key={`${actor}:${data.userId}:${key}:${setting.version}`} settingKey={key} initial={initial ?? setting.value} version={setting.version} label={label} type={type} canSave={canSave} userId={data.userId} copy={copy} onSaved={refresh} onNotice={setNotice} />;
  };
  if (!identity.loaded || session.isPending) return null;
  if (!canRead) return null;
  return <section className={styles.page} aria-label={copy.title}>
    <PageHeader title={copy.title} description={copy.description} actions={<button className="button secondary" type="button" disabled={query.isFetching} onClick={() => void query.refetch()}><RefreshCw size={16} aria-hidden="true" />{copy.refresh}</button>} />
    <p className={styles.direct}>{copy.direct}</p>
    {notice && <p className={styles.notice} role="status">{notice}</p>}
    <div className={`card ${styles.selector}`}>
    <form className={styles.userForm} onSubmit={event => { event.preventDefault(); if (inputUser && !/^[A-Za-z0-9_-]{1,128}$/.test(inputUser)) { setLookupError(true); return; } setLookupError(false); setSelectedUser(inputUser); }}>
      <label>{copy.user}<input className="input ltr" value={inputUser} maxLength={128} onChange={event => setInputUser(event.target.value)} /></label>
      <button className="button secondary" type="submit" disabled={query.isFetching}>{copy.load}</button>
    </form>
    <div className={styles.selectedUser}><p>{copy.userHelp}</p>{data && <p><strong>{copy.policy}</strong><bdi title={data.userId}>{data.userId}</bdi></p>}</div>
    </div>
    {lookupError && <p role="alert">{copy.invalid}</p>}
    {query.isPending && <p>{copy.loading}</p>}
    {query.isError && <p role="alert">{copy.error}</p>}
    {data && <>
      {!canSave && <p className={styles.notice}>{copy.readOnly}</p>}
      <div className={styles.featureGrid}>
      {data.features.map(feature => <section className={`card ${styles.feature}`} key={feature.feature} aria-label={feature.feature === "chat" ? copy.chat : copy.voice}>
        <div className={styles.featureHeading}><div>{feature.feature === "chat" ? <Bot size={20} aria-hidden="true" /> : <Mic size={20} aria-hidden="true" />}<h2 dir="ltr">{feature.feature === "chat" ? copy.chat : copy.voice}</h2></div><span className={`badge ${feature.enabled ? "badge-success" : "badge-neutral"}`}>{feature.enabled ? <CheckCircle2 size={14} aria-hidden="true" /> : <CirclePause size={14} aria-hidden="true" />}{feature.enabled ? copy.enabledState : copy.disabledState}</span></div>
        <p className={styles.meta}>{copy.dailyWindow}</p>
        <UsageValues feature={feature} copy={copy} locale={locale} />
        <details className={styles.editDetails}><summary>{copy.defaults}<ChevronDown size={16} aria-hidden="true" /></summary><div>
        {editor(`ai.${feature.feature}.rolling_limit`, copy.daily)}
        {editor(`ai.${feature.feature}.monthly_limit`, copy.monthly, "monthly")}
        {editor(`ai.${feature.feature}.enabled`, copy.enabled, "enabled")}
        </div></details>
      </section>)}
      </div>
      <section className={`card ${styles.budget}`} aria-label={copy.budget}>
        <div className="card-heading"><div><h2>{copy.budget}</h2><p>{copy.budgetHelp}</p></div></div>
        <div className={styles.budgetGrid}>
          <div><dl className={styles.projectCost}><dt>{copy.projectCost}</dt><dd className="numbers">{data.projectEstimatedCostUsd.toFixed(6)} <small>USD</small></dd></dl>
            <dl className={styles.costBreakdown}>{data.features.map(feature => <div key={feature.feature}><dt>{feature.feature === "chat" ? copy.chat : copy.voice}</dt><dd className="numbers">{feature.estimatedCostUsd.toFixed(6)} USD</dd></div>)}</dl>
            <p className={styles.meta}>{copy.monthlyReset}: <QuotaTime at={data.monthlyProjectResetsAt} locale={locale} /></p>
          </div>
          <div>
        {editor("ai.global.monthly_budget", copy.cap, "cost")}
          </div>
        </div>
        <details className={styles.editDetails}><summary>{copy.other}<ChevronDown size={16} aria-hidden="true" /></summary>{editor("ai.user.rolling_limit", copy.legacy)}</details>
      </section>
      <section className={`card ${styles.overrides}`} aria-label={copy.overrides}>
        <div className="card-heading"><div><h2>{copy.overrides}</h2><p>{copy.overrideHelp}</p></div></div>
        <div className={styles.overrideGrid}>{data.features.map(feature => <div key={feature.feature}><h3 dir="ltr">{feature.feature === "chat" ? copy.chat : copy.voice}</h3>
          <p className={styles.meta}>{copy.daily}: {feature.override.rollingLimit === null ? copy.inherited : copy.custom} · {copy.month}: {feature.override.monthlyLimit === null ? copy.inherited : copy.custom}</p>
          {editor(`ai.${feature.feature}.user_override`, copy.override, "override", feature.override)}
        </div>)}</div>
      </section>
      <section className={styles.history} aria-label={copy.history}><div className="card-heading"><h2>{copy.history}</h2><span className={styles.meta}><bdi>{data.history.length}</bdi></span></div>
        {data.history.length === 0 ? <p className={styles.meta}>{copy.noHistory}</p> : <div className={`table-card ${styles.auditTable}`}><table className="data-table"><thead><tr><th>{copy.time}</th><th>{copy.setting}</th><th>{copy.change}</th></tr></thead><tbody>{data.history.map(event => <tr key={event.id}>
          <td><QuotaTime at={event.at} locale={locale} /></td><td><bdi className={styles.settingKey}>{event.key}</bdi><p>{event.reason}</p></td>
          <td><details><summary>{copy.auditDetails}</summary><p>{copy.actor}: <bdi>{event.actorId}</bdi></p><div className={styles.auditValues}><pre dir="ltr">{event.before ?? "—"}</pre><span aria-hidden="true">→</span><pre dir="ltr">{event.after ?? "—"}</pre></div></details></td>
        </tr>)}</tbody></table></div>}
      </section>
    </>}
  </section>;
}
