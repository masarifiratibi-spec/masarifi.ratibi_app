import type { ReactNode } from "react";

type ChartCardProps = {
  title: string;
  subtitle?: string;
  summary: string;
  children: ReactNode;
};

export function ChartCard({ title, subtitle, summary, children }: ChartCardProps) {
  return (
    <article className="chart-card">
      <div className="card-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>
      <div className="chart-wrap">{children}</div>
      <p className="sr-only">{summary}</p>
    </article>
  );
}
