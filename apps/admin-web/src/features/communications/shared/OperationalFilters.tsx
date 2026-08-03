"use client";

import { Search, X } from "lucide-react";
import { getStatusLabel } from "@/core/localization/display-labels";
import { useLocale, useT } from "@/core/localization/provider";
import type { Platform } from "../contracts";

export interface OperationalFilterState {
  search?: string;
  platform?: Platform;
  status?: string;
  priority?: string;
}

interface OperationalFiltersProps {
  filters: OperationalFilterState;
  labels: {
    search: string;
    platform: string;
    status?: string;
    priority?: string;
  };
  onChange: (filters: OperationalFilterState) => void;
  emptyMessage?: string;
  partialMessage?: string;
  unavailableMessage?: string;
  permissionDenied?: boolean;
}

const platformLabels: Record<Platform, { ar: string; en: string }> = {
  all: { ar: "الكل", en: "All" },
  ios: { ar: "iOS", en: "iOS" },
  android: { ar: "Android", en: "Android" },
  unknown: { ar: "غير معروف", en: "Unknown" },
};

const ticketStateOptions = ["", "new", "open", "awaiting_customer", "awaiting_agent", "resolved", "closed"];
const priorityOptions = ["", "low", "medium", "high", "urgent"];

export function OperationalFilters({
  filters,
  labels,
  onChange,
  emptyMessage,
  partialMessage,
  unavailableMessage,
  permissionDenied = false,
}: OperationalFiltersProps) {
  const { locale } = useLocale();
  const t = useT();
  if (permissionDenied) {
    return <p className="state-box error" role="alert">{locale === "ar" ? "غير مصرح" : t("states.accessDenied")}</p>;
  }

  return (
    <section className="toolbar" aria-label={locale === "ar" ? "مرشحات تشغيلية" : "Operational filters"} dir={locale === "ar" ? "rtl" : "ltr"}>
      <label className="field">
        <span>{labels.search}</span>
        <span className="input-with-icon">
          <Search size={16} aria-hidden="true" />
          <input
            value={filters.search ?? ""}
            onChange={(event) => onChange({ ...filters, search: event.currentTarget.value })}
            placeholder={labels.search}
            type="search"
          />
          {filters.search && (
            <button
              aria-label={locale === "ar" ? "مسح البحث" : "Clear search"}
              className="icon-button"
              onClick={() => onChange({ ...filters, search: "" })}
              type="button"
            >
              <X size={16} />
            </button>
          )}
        </span>
      </label>

      <label className="field">
        <span>{labels.platform}</span>
        <select
          value={filters.platform ?? "all"}
          onChange={(event) => onChange({ ...filters, platform: event.currentTarget.value as Platform })}
        >
          {Object.entries(platformLabels).map(([platform, label]) => (
            <option key={platform} value={platform}>{label[locale]}</option>
          ))}
        </select>
      </label>

      {labels.status && (
        <label className="field">
          <span>{labels.status}</span>
          <select value={filters.status ?? ""} onChange={(event) => onChange({ ...filters, status: event.currentTarget.value })}>
            {ticketStateOptions.map((state) => <option key={state || "all"} value={state}>{state ? getStatusLabel(locale, state) : t("common.all")}</option>)}
          </select>
        </label>
      )}

      {labels.priority && (
        <label className="field">
          <span>{labels.priority}</span>
          <select value={filters.priority ?? ""} onChange={(event) => onChange({ ...filters, priority: event.currentTarget.value })}>
            {priorityOptions.map((priority) => <option key={priority || "all"} value={priority}>{priority ? getStatusLabel(locale, priority) : t("common.all")}</option>)}
          </select>
        </label>
      )}

      {emptyMessage && <p className="state-box">{emptyMessage}</p>}
      {partialMessage && <p className="region-warning" role="status">{partialMessage}</p>}
      {unavailableMessage && <p className="state-box error" role="alert">{unavailableMessage}</p>}
    </section>
  );
}
