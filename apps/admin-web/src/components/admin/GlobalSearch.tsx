"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useDeferredValue, useState } from "react";
import type { AdminRole } from "@/core/permissions/permissions";
import { useLocale, useT } from "@/core/localization/provider";
import { useGlobalSearch } from "@/features/foundation/hooks";

const groupLabels = {
  ar: {
    navigation: "التنقل",
    user: "المستخدمون",
    subscription: "الاشتراكات",
    payment_event: "أحداث الدفع",
    import: "الاستيراد",
    support_ticket: "تذاكر الدعم",
    audit_event: "أحداث التدقيق",
    job: "المهام",
    parser_rule: "قواعد التحليل",
    bank: "البنوك",
    admin_user: "مسؤولو النظام",
  },
  en: {
    navigation: "Navigation",
    user: "Users",
    subscription: "Subscriptions",
    payment_event: "Payment Events",
    import: "Imports",
    support_ticket: "Support Tickets",
    audit_event: "Audit Events",
    job: "Jobs",
    parser_rule: "Parser Rules",
    bank: "Banks",
    admin_user: "Admin Users",
  },
} as const;

export function GlobalSearch({ role }: { role: AdminRole }) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim());
  const search = useGlobalSearch(role, { query: deferredQuery, page: 1, pageSize: 25 }, deferredQuery.length >= 2);
  const groups = Object.entries(
    Object.groupBy(search.data?.items ?? [], (item) => item.entityType),
  );
  const { locale } = useLocale();
  const t = useT();

  return (
    <div className="global-search-wrap">
      <label className="global-search">
        <Search size={18} />
        <span className="sr-only">{t("common.search")}</span>
        <input
          aria-label={t("common.search")}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("search.placeholder")}
          value={query}
        />
        <kbd>Ctrl K</kbd>
      </label>
      {deferredQuery.length >= 2 && (
        <div className="search-results" role="status" aria-live="polite">
          {search.isPending && <span>{t("common.searchPending")}</span>}
          {search.isError && <span>{t("common.searchError")}</span>}
          {search.isSuccess && groups.length === 0 && <span>{t("common.noResults")}</span>}
          {groups.map(([group, items]) => items && (
            <section key={group}>
              <strong>{groupLabels[locale][group as keyof (typeof groupLabels)[typeof locale]] ?? group}</strong>
              {items.map((item) => (
                <Link href={item.route} key={item.id}>
                  <span>{item.primaryLabel}</span>
                  {item.secondaryLabel && <small>{item.secondaryLabel}</small>}
                </Link>
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
