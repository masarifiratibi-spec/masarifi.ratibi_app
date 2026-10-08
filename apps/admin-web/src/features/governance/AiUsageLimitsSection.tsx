"use client";

import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAdminIdentity } from "@/app/providers";
import { apiActorCacheKey } from "@/core/api/client";
import { ApiError } from "@/core/api/errors";
import { useLocale } from "@/core/localization/provider";
import { useAdminSession } from "@/features/foundation/hooks";
import { aiUsageRepository, quotaValue, type AiUsage, type AiUsageKey } from "./ai-usage";

const messages = {
  ar: { title: "حدود استخدام الذكاء الاصطناعي", direct: "القراءات المالية المباشرة لا تستهلك حصة مزود الذكاء الاصطناعي.",
    user: "معرّف المستخدم", load: "تحميل", daily: "طلبات لكل مستخدم / ٢٤ ساعة", monthly: "حد شهري لكل مستخدم (فارغ = بلا حد)",
    enabled: "السماح بطلبات الميزة", effective: "الحد الفعلي", used: "المستهلك", remaining: "المتبقي", reset: "بداية استعادة الحصة",
    month: "الشهر التقويمي UTC", cost: "التكلفة المقدّرة/المحجوزة USD", cap: "سقف تكلفة المشروع الشهري USD", legacy: "الحد الافتراضي للميزات الأخرى",
    override: "تخصيص المستخدم (فارغ = وراثة الافتراضي)", reason: "سبب التغيير", save: "حفظ", saved: "تم حفظ الإعداد وتسجيل التغيير.",
    invalid: "تحقق من القيمة وسبب التغيير (١٠ أحرف على الأقل).", conflict: "تغيرت النسخة. تم تحديث القيم؛ راجعها قبل إعادة المحاولة.",
    auth: "يلزم تسجيل دخول حديث لإكمال التغيير.", error: "تعذر إكمال الطلب. أعد المحاولة.", history: "سجل تغييرات الحدود", refresh: "تحديث",
    loading: "جارٍ تحميل الحدود…", route: "مسار المزود متاح", on: "نعم", off: "لا", global: "القيم الافتراضية العامة", noCap: "بلا حد", version: "النسخة", change: "القيمة السابقة ← الجديدة" },
  en: { title: "AI Usage Limits", direct: "Direct deterministic financial reads do not consume AI-provider quota.",
    user: "User ID", load: "Load", daily: "Requests per user / 24 hours", monthly: "Monthly per-user limit (blank = no cap)",
    enabled: "Allow feature requests", effective: "Effective limit", used: "Used", remaining: "Remaining", reset: "First quota reset",
    month: "UTC calendar month", cost: "Estimated/reserved cost USD", cap: "Monthly project cost cap USD", legacy: "Other AI workloads default",
    override: "User override (blank = inherit default)", reason: "Change reason", save: "Save", saved: "Setting saved and change audited.",
    invalid: "Check the value and enter a reason of at least 10 characters.", conflict: "Version changed. Values refreshed; review them before retrying.",
    auth: "A recent sign-in is required to make this change.", error: "Request failed. Please retry.", history: "Quota change history", refresh: "Refresh",
    loading: "Loading limits…", route: "Provider route available", on: "Yes", off: "No", global: "Global defaults", noCap: "No cap", version: "Version", change: "Before → after" },
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
  return <form data-setting={settingKey} className="settings-editor-section" onSubmit={async event => {
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
    <div className="settings-field-grid">
      <label>{label}{type === "enabled" ? <select className="select" aria-label={label} value={value} disabled={!canSave || pending} onChange={event => setValue(event.target.value)}><option value="true">{copy.on}</option><option value="false">{copy.off}</option></select> :
        <input className="input numbers ltr" type="number" step={type === "cost" ? "0.01" : "1"} min={type === "cost" ? "0.01" : "1"} max={type === "daily" || type === "override" ? 1000 : 1_000_000} aria-label={label} value={value} disabled={!canSave || pending} onChange={event => setValue(event.target.value)} />}</label>
      {type === "override" && <label>{copy.monthly}<input className="input numbers ltr" type="number" min="1" max="1000000" step="1" value={monthly} disabled={!canSave || pending} onChange={event => setMonthly(event.target.value)} /></label>}
      <label>{copy.reason}<textarea className="input" aria-label={copy.reason} value={reason} maxLength={500} disabled={!canSave || pending} onChange={event => setReason(event.target.value)} /></label>
    </div>
    <div className="settings-action-footer"><span>{copy.version}: {version}</span><button className="button primary" type="submit" disabled={!canSave || pending || !changed || reason.trim().length < 10}>{copy.save}</button></div>
  </form>;
}

function UsageValues({ feature, copy }: { feature: AiUsage["features"][number]; copy: Copy }) {
  return <dl className="settings-meta-strip">
    <div><dt>{copy.effective} / 24h</dt><dd className="numbers">{feature.limit}</dd></div>
    <div><dt>{copy.used} / {copy.remaining}</dt><dd className="numbers">{feature.used} / {feature.remaining}</dd></div>
    <div><dt>{copy.reset}</dt><dd className="numbers ltr">{feature.resetsAt}</dd></div>
    <div><dt>{copy.month}</dt><dd className="numbers">{feature.monthlyUsed} / {feature.monthlyLimit ?? copy.noCap} ({copy.remaining}: {feature.monthlyRemaining ?? copy.noCap})</dd><dd className="numbers ltr">{feature.monthlyResetsAt}</dd></div>
    <div><dt>{copy.cost}</dt><dd className="numbers">{feature.estimatedCostUsd.toFixed(6)}</dd></div>
    <div><dt>{copy.route}</dt><dd>{feature.routeEnabled ? copy.on : copy.off}</dd></div>
  </dl>;
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
  return <section className="card settings-editor-card" aria-label={copy.title}>
    <div className="card-heading"><h2>{copy.title}</h2><button className="button secondary" type="button" disabled={query.isFetching} onClick={() => void query.refetch()}>{copy.refresh}</button></div>
    <p>{copy.direct}</p>
    {notice && <p role="status">{notice}</p>}
    <form className="settings-field-grid" onSubmit={event => { event.preventDefault(); if (inputUser && !/^[A-Za-z0-9_-]{1,128}$/.test(inputUser)) { setLookupError(true); return; } setLookupError(false); setSelectedUser(inputUser); }}>
      <label>{copy.user}<input className="input ltr" value={inputUser} maxLength={128} onChange={event => setInputUser(event.target.value)} /></label>
      <button className="button secondary" type="submit" disabled={query.isFetching}>{copy.load}</button>
    </form>
    {lookupError && <p role="alert">{copy.invalid}</p>}
    {query.isPending && <p>{copy.loading}</p>}
    {query.isError && <p role="alert">{copy.error}</p>}
    {data && <>
      <p className="numbers ltr">{copy.user}: {data.userId}</p>
      {data.features.map(feature => <section className="settings-editor-section" key={feature.feature}>
        <h3>{feature.feature === "chat" ? "Assistant Chat AI" : "Voice AI"}</h3>
        <UsageValues feature={feature} copy={copy} />
        <h4>{copy.global}</h4>
        {editor(`ai.${feature.feature}.rolling_limit`, copy.daily)}
        {editor(`ai.${feature.feature}.monthly_limit`, copy.monthly, "monthly")}
        {editor(`ai.${feature.feature}.enabled`, copy.enabled, "enabled")}
        {editor(`ai.${feature.feature}.user_override`, copy.override, "override", feature.override)}
      </section>)}
      <section className="settings-editor-section"><h3>{copy.global}</h3>
        {editor("ai.user.rolling_limit", copy.legacy)}
        {editor("ai.global.monthly_budget", copy.cap, "cost")}
        <p>{copy.cost}: <span className="numbers">{data.projectEstimatedCostUsd.toFixed(6)}</span></p>
        <p className="numbers ltr">{data.monthlyProjectResetsAt}</p>
      </section>
      <section className="settings-editor-section"><h3>{copy.history}</h3><div className="table-card"><table><thead><tr><th>{copy.user}</th><th>{copy.reason}</th><th>{copy.change}</th></tr></thead><tbody>{data.history.map(event => <tr key={event.id}><td>{event.actorId}<br />{event.at}</td><td>{event.key}<br />{event.reason}</td><td><span className="numbers ltr">{event.before} → {event.after}</span></td></tr>)}</tbody></table></div></section>
    </>}
  </section>;
}
