import type { Locale } from "@/core/localization/direction";
import { getEnvironmentLabel } from "@/core/localization/display-labels";
import { t } from "@/core/localization/messages";
import type { DeploymentEnvironment } from "@/core/config/deployment-environment";

export function EnvironmentIndicator({
  environment,
  locale,
}: {
  environment: DeploymentEnvironment;
  locale: Locale;
}) {
  const label = getEnvironmentLabel(locale, environment);
  return (
    <span className={`environment environment-${environment}`} data-environment={environment} aria-label={t(locale, "environment.aria", { label })}>
      <span aria-hidden="true" /> {t(locale, "environment.text", { label })}
    </span>
  );
}
