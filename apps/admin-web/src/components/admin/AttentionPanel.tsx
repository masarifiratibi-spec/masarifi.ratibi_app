"use client";

import Link from "next/link";
import { Bell, X } from "lucide-react";
import { useState } from "react";
import type { AdminRole } from "@/core/permissions/permissions";
import { useAttention } from "@/features/foundation/hooks";
import { SeverityBadge } from "./ui";

export function AttentionPanel({ role, defaultOpen = false }: { role: AdminRole; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const attention = useAttention(role, { page: 1, pageSize: 10 });
  const items = attention.data?.items ?? [];
  const count = attention.data?.totalItems ?? 0;

  return (
    <div className="attention-panel-wrap">
      <button
        aria-expanded={open}
        aria-label="الإشعارات"
        className="icon-button notification"
        onClick={() => setOpen((value) => !value)}
      >
        <Bell size={19} />
        {count > 0 && <span>{count}</span>}
      </button>
      {open && (
        <aside className="attention-panel" aria-label="التنبيهات التشغيلية">
          <div className="panel-heading">
            <strong>التنبيهات التشغيلية</strong>
            <button className="icon-button" aria-label="إغلاق التنبيهات" onClick={() => setOpen(false)}><X size={18} /></button>
          </div>
          {attention.isPending && <p role="status">جاري التحميل…</p>}
          {attention.isError && <p role="alert">تعذر تحميل التنبيهات.</p>}
          {attention.isSuccess && items.length === 0 && <p>لا توجد تنبيهات.</p>}
          {items.map((item) => (
            <AttentionLink key={item.id} destination={item.destination} onClose={() => setOpen(false)}>
              <strong>{item.summary}</strong>
              <small><SeverityBadge severity={item.severity} /></small>
            </AttentionLink>
          ))}
        </aside>
      )}
    </div>
  );
}

function AttentionLink({
  destination,
  onClose,
  children,
}: {
  destination?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!destination) {
    return <div className="attention-summary">{children}</div>;
  }
  return (
    <Link href={destination} onClick={onClose}>
      {children}
    </Link>
  );
}
