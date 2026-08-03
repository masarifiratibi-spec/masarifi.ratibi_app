"use client";

interface SafeTextProps {
  text: string;
  direction?: "rtl" | "ltr";
  maxLength?: number;
  loading?: boolean;
  emptyMessage?: string;
  unavailableMessage?: string;
  reducedMotion?: boolean;
  className?: string;
}

function classNames(...names: Array<string | false | undefined>): string {
  return names.filter(Boolean).join(" ");
}

export function SafeText({
  text,
  direction = "rtl",
  maxLength,
  loading = false,
  emptyMessage,
  unavailableMessage,
  reducedMotion = false,
  className,
}: SafeTextProps) {
  if (loading) {
    return <p aria-live="polite" className={classNames("safe-text loading", className)}>جار التحميل...</p>;
  }

  if (!text && unavailableMessage) {
    return <p aria-live="polite" className={classNames("safe-text unavailable", className)}>{unavailableMessage}</p>;
  }

  if (!text && emptyMessage) {
    return <p aria-live="polite" className={classNames("safe-text empty", className)}>{emptyMessage}</p>;
  }

  if (!text) {
    return null;
  }

  const clippedText = maxLength && [...text].length > maxLength
    ? `${[...text].slice(0, maxLength).join("")}...`
    : text;

  return (
    <p className={classNames("safe-text", className)} dir={direction} style={reducedMotion ? { transition: "none" } : undefined}>
      {clippedText}
    </p>
  );
}
