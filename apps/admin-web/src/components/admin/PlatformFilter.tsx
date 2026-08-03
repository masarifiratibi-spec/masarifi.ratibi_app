"use client";

import type { PlatformOption } from "@/features/foundation/contracts";
import { getPlatformLabel } from "@/core/localization/display-labels";
import { useLocale, useT } from "@/core/localization/provider";

export function PlatformFilter({
  options,
  value,
  onChange,
}: {
  options: PlatformOption[];
  value: PlatformOption["value"];
  onChange: (value: PlatformOption["value"]) => void;
}) {
  const { locale } = useLocale();
  const t = useT();
  return (
    <div className="segmented-control" role="group" aria-label={t("overview.platformTitle")}>
      {options.map((option) => (
        <button
          className={value === option.value ? "active" : ""}
          aria-pressed={value === option.value}
          key={option.value}
          onClick={() => onChange(option.value)}
          type="button"
        >
          {getPlatformLabel(locale, option.value)}
        </button>
      ))}
    </div>
  );
}
