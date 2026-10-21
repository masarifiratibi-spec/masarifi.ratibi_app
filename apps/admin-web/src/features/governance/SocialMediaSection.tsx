"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAdminIdentity } from "@/app/providers";
import {
  AccessDeniedState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "@/components/admin/ui";
import { apiActorCacheKey } from "@/core/api/client";
import { useLocale } from "@/core/localization/provider";
import { useAdminSession } from "@/features/foundation/hooks";
import {
  socialMediaLinksSchema,
  socialMediaRepository,
  type SocialMediaSetting,
} from "./social-media";

const messages = {
  ar: {
    title: "السوشيال ميديا",
    description:
      "تظهر الحسابات ذات الروابط المحفوظة أسفل إعدادات التطبيق. اترك الرابط فارغًا لإخفاء الأيقونة.",
    save: "حفظ الروابط",
    reason: "سبب التغيير",
    saved: "تم حفظ الروابط.",
    invalid:
      "أدخل رابط حساب HTTPS للمنصة المحددة، وسبب تغيير من ١٠ أحرف على الأقل.",
    conflict:
      "تم تغيير الروابط من جلسة أخرى. حدّث الصفحة وراجع القيم قبل الحفظ.",
    error: "تعذر الحفظ. حاول مرة أخرى.",
    auth: "سجّل الدخول من جديد لإكمال الحفظ.",
    refresh: "تحديث",
  },
  en: {
    title: "Social media",
    description:
      "Accounts with saved links appear below the app settings. Leave a link empty to hide its icon.",
    save: "Save links",
    reason: "Change reason",
    saved: "Links saved.",
    invalid:
      "Enter an HTTPS profile link for the selected platform and a change reason of at least 10 characters.",
    conflict:
      "Another session changed these links. Refresh and review the current values before saving.",
    error: "Could not save. Try again.",
    auth: "Sign in again to save these changes.",
    refresh: "Refresh",
  },
};
const platforms = [
  ["instagram", "Instagram", "https://www.instagram.com/username/"],
  ["tiktok", "TikTok", "https://www.tiktok.com/@username"],
  ["snapchat", "Snapchat", "https://www.snapchat.com/add/username"],
] as const;

function SocialMediaEditor({
  setting,
  canSave,
  onSaved,
}: {
  setting: SocialMediaSetting;
  canSave: boolean;
  onSaved: () => Promise<unknown>;
}) {
  const { locale } = useLocale();
  const c = messages[locale];
  const [values, setValues] = useState(setting.value);
  const [reason, setReason] = useState("");
  const [invalid, setInvalid] = useState(false);
  const mutation = useMutation({
    mutationFn: () =>
      socialMediaRepository.save(values, setting.version, reason.trim()),
    onSuccess: onSaved,
  });
  const status =
    mutation.error && "status" in mutation.error
      ? Number(mutation.error.status)
      : 0;
  const disabled =
    !canSave || mutation.isPending || mutation.isSuccess || status === 409;
  return (
    <form
      className="table-card settings-editor-card"
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = socialMediaLinksSchema.safeParse(values);
        if (!parsed.success || reason.trim().length < 10) {
          setInvalid(true);
          return;
        }
        setInvalid(false);
        mutation.mutate();
      }}
    >
      <fieldset
        className="settings-editor-section"
        disabled={disabled}
        style={{ border: 0 }}
      >
        <div className="settings-field-grid">
          {platforms.map(([key, label, placeholder]) => (
            <label key={key}>
              {label}
              <input
                className="input ltr"
                type="url"
                dir="ltr"
                maxLength={500}
                aria-label={label}
                placeholder={placeholder}
                value={values[key]}
                onChange={(event) => {
                  setValues({ ...values, [key]: event.target.value });
                  mutation.reset();
                }}
              />
            </label>
          ))}
        </div>
        <label>
          {c.reason}
          <textarea
            className="input"
            maxLength={500}
            aria-label={c.reason}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
      </fieldset>
      <div className="settings-action-footer">
        <div>
          {invalid && <p role="alert">{c.invalid}</p>}
          {mutation.isError && (
            <p role="alert">
              {status === 409 ? c.conflict : status === 401 ? c.auth : c.error}
            </p>
          )}
        </div>
        <button className="button primary" type="submit" disabled={disabled}>
          {c.save}
        </button>
      </div>
    </form>
  );
}

export function SocialMediaSection() {
  const { locale } = useLocale();
  const c = messages[locale];
  const [saved, setSaved] = useState(false);
  const identity = useAdminIdentity();
  const session = useAdminSession(identity.actorId);
  const permissions = session.data?.effectivePermissionKeys ?? [];
  const canRead =
    identity.loaded && permissions.includes("operations.settings.read");
  const client = useQueryClient();
  const queryKey = ["social-media", apiActorCacheKey(), identity.actorId];
  const query = useQuery({
    queryKey,
    enabled: canRead,
    queryFn: ({ signal }) => socialMediaRepository.read(signal),
    retry: false,
    refetchOnWindowFocus: false,
  });
  if (!identity.loaded || session.isPending) return <LoadingState />;
  if (!canRead)
    return <AccessDeniedState permission="operations.settings.read" />;
  return (
    <section className="admin-page">
      <PageHeader
        title={c.title}
        description={c.description}
        actions={
          <button
            type="button"
            className="button secondary"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            {c.refresh}
          </button>
        }
      />
      {query.isPending && <LoadingState />}
      {query.isError && <ErrorState />}
      {saved && <p role="status">{c.saved}</p>}
      {query.data && (
        <SocialMediaEditor
          key={`${identity.actorId}:${query.data.version}`}
          setting={query.data}
          canSave={permissions.includes("operations.settings.manage")}
          onSaved={async () => {
            setSaved(true);
            await client.invalidateQueries({ queryKey });
          }}
        />
      )}
    </section>
  );
}
