"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { getPeriodLabel } from "@/core/localization/display-labels";
import { useLocale, useT } from "@/core/localization/provider";
import type { DateRangeInput } from "@/features/foundation/contracts";
import { dateRangeSchema } from "@/features/foundation/schemas";

const ALL_PRESETS = ["7d", "30d", "90d", "custom"] as const;

export function DateRangeControl({
  value,
  onChange,
  allowedPresets = ALL_PRESETS,
}: {
  value: DateRangeInput;
  onChange: (value: DateRangeInput) => void;
  allowedPresets?: readonly DateRangeInput["preset"][];
}) {
  const { locale } = useLocale();
  const t = useT();
  const [error, setError] = useState("");
  const { register, reset, getValues } = useForm<DateRangeInput>({ defaultValues: value });
  const presets = ALL_PRESETS.filter((preset) => allowedPresets.includes(preset));
  const customEnabled = presets.includes("custom");

  useEffect(() => reset(value), [reset, value]);

  const selectPreset = (preset: DateRangeInput["preset"]) => {
    const next = { ...getValues(), preset };
    if (preset !== "custom") onChange(next);
    else reset(next);
  };

  const validateCustom = () => {
    const parsed = dateRangeSchema.safeParse({ ...getValues(), preset: "custom" });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? t("dateRange.invalid"));
      return;
    }
    setError("");
    onChange(parsed.data);
  };

  return (
    <div className="date-range-control">
      <div className="date-presets" role="group" aria-label={t("dateRange.label")}>
        {presets.map((preset) => (
          <button
            aria-pressed={value.preset === preset}
            className={value.preset === preset ? "active" : ""}
            key={preset}
            onClick={() => selectPreset(preset)}
            type="button"
          >
            {preset === "custom" ? t("dateRange.custom") : getPeriodLabel(locale, preset)}
          </button>
        ))}
      </div>
      {customEnabled && value.preset === "custom" && (
        <div className="custom-dates">
          <input aria-label={t("dateRange.start")} type="date" {...register("start")} onBlur={validateCustom} />
          <input aria-label={t("dateRange.end")} type="date" {...register("end")} onBlur={validateCustom} />
        </div>
      )}
      {error && <small className="field-error" role="alert">{error}</small>}
    </div>
  );
}
