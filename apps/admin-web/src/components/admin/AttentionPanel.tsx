"use client";

import Link from "next/link";
import { Bell, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { AdminRole } from "@/core/permissions/permissions";
import { useAttention } from "@/features/foundation/hooks";
import { SeverityBadge } from "./ui";

export function AttentionPanel({ role, defaultOpen = false }: { role: AdminRole; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);
  const attention = useAttention(role, { page: 1, pageSize: 10 });
  const items = attention.data?.items ?? [];
  const count = attention.data?.totalItems ?? 0;
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Detect mobile breakpoint
  useEffect(() => {
    setMounted(true);
    const mq = window.matchMedia("(max-width: 599px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Lock body scroll when mobile panel is open
  useEffect(() => {
    if (!isMobile) return;
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open, isMobile]);

  const panel = (
    <aside 
      className={`attention-panel${isMobile ? " attention-panel-mobile" : ""}${isMobile && open ? " open" : ""}`} 
      aria-label="التنبيهات التشغيلية"
    >
      <div className="panel-heading">
        <strong>التنبيهات التشغيلية</strong>
        <button
          className="icon-button"
          aria-label="إغلاق التنبيهات"
          onClick={() => setOpen(false)}
        >
          <X size={18} />
        </button>
      </div>
      <div className="attention-panel-list">
        {attention.isPending && <p role="status">جاري التحميل…</p>}
        {attention.isError && <p role="alert">تعذر تحميل التنبيهات.</p>}
        {attention.isSuccess && items.length === 0 && <p>لا توجد تنبيهات.</p>}
        {items.map((item) => (
          <AttentionLink key={item.id} destination={item.destination} onClose={() => setOpen(false)}>
            <strong>{item.summary}</strong>
            <small><SeverityBadge severity={item.severity} /></small>
          </AttentionLink>
        ))}
      </div>
    </aside>
  );

  return (
    <>
      <div className="attention-panel-wrap">
        <button
          ref={buttonRef}
          aria-expanded={open}
          aria-label="الإشعارات"
          className="icon-button notification"
          onClick={() => setOpen((v) => !v)}
        >
          <Bell size={19} />
          {count > 0 && <span>{count}</span>}
        </button>
        {/* Desktop: render panel inline inside the wrap (positioned absolute) */}
        {open && !isMobile && panel}
      </div>

      {/* Mobile: render via portal to body so position:fixed escapes all containing blocks */}
      {mounted && open && isMobile && createPortal(
        <>
          <div
            aria-hidden="true"
            className="attention-panel-backdrop"
          />
          {panel}
        </>,
        document.body,
      )}
    </>
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
