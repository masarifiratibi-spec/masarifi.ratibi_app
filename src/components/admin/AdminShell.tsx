"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity, Bell, ChevronLeft, CircleDollarSign, Database, FileInput, HeartPulse,
  Languages, LayoutDashboard, Menu, Moon, PanelRightClose, Search, Settings,
  ShieldCheck, Sun, Users, X,
} from "lucide-react";
import { useEffect, useState } from "react";

const nav = [
  {
    label: "المنصة",
    items: [
      { label: "نظرة عامة", href: "/admin", icon: LayoutDashboard },
      { label: "صحة النظام", href: "/admin/system-health", icon: HeartPulse },
      { label: "المهام وقوائم الانتظار", icon: Activity },
    ],
  },
  {
    label: "العملاء والإيرادات",
    items: [
      { label: "المستخدمون", href: "/admin/users", icon: Users },
      { label: "الاشتراكات", icon: CircleDollarSign },
      { label: "المدفوعات", icon: CircleDollarSign },
    ],
  },
  {
    label: "العمليات",
    items: [
      { label: "الاستيراد والمعاملات", href: "/admin/imports", icon: FileInput },
      { label: "إدارة المحللات", icon: Database },
      { label: "إدارة الذكاء الاصطناعي", icon: Activity },
    ],
  },
  {
    label: "الحوكمة",
    items: [
      { label: "الأمان", icon: ShieldCheck },
      { label: "إعدادات النظام", icon: Settings },
    ],
  },
];

function Sidebar({ compact, mobile, close }: { compact: boolean; mobile?: boolean; close?: () => void }) {
  const pathname = usePathname();
  return (
    <aside className={`sidebar ${compact ? "sidebar-compact" : ""} ${mobile ? "sidebar-mobile" : ""}`}>
      <div className="brand">
        <span className="brand-mark">م</span>
        {!compact && <div><strong>مصاريفي</strong><small>لوحة الإدارة</small></div>}
        {mobile && <button className="icon-button sidebar-close" onClick={close} aria-label="إغلاق القائمة"><X size={20} /></button>}
      </div>
      <nav aria-label="التنقل الرئيسي">
        {nav.map((group) => (
          <div className="nav-group" key={group.label}>
            {!compact && <p>{group.label}</p>}
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = item.href === "/admin" ? pathname === item.href : pathname.startsWith(item.href ?? "—");
              if (!item.href) {
                return (
                  <div className="nav-item nav-disabled" key={item.label} title={compact ? `${item.label} — قريباً` : undefined}>
                    <Icon size={18} /><span>{item.label}</span>{!compact && <small>قريباً</small>}
                  </div>
                );
              }
              return (
                <Link className={`nav-item ${active ? "active" : ""}`} href={item.href} key={item.label} onClick={close} title={compact ? item.label : undefined}>
                  <Icon size={18} /><span>{item.label}</span>{!compact && <ChevronLeft size={16} className="nav-arrow" />}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      {!compact && <div className="sidebar-note"><ShieldCheck size={18} /><span>البيانات المالية الحساسة مخفية افتراضياً.</span></div>}
    </aside>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [compact, setCompact] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <div className={`admin-shell ${compact ? "shell-compact" : ""}`}>
      <Sidebar compact={compact} />
      {mobileOpen && <div className="mobile-overlay" role="presentation" onMouseDown={() => setMobileOpen(false)}><div onMouseDown={(event) => event.stopPropagation()}><Sidebar compact={false} mobile close={() => setMobileOpen(false)} /></div></div>}
      <div className="admin-main">
        <header className="topbar">
          <div className="topbar-start">
            <button className="icon-button mobile-menu" onClick={() => setMobileOpen(true)} aria-label="فتح القائمة"><Menu size={20} /></button>
            <button className="icon-button desktop-collapse" onClick={() => setCompact((value) => !value)} aria-label={compact ? "توسيع القائمة" : "طي القائمة"}><PanelRightClose size={20} /></button>
            <label className="global-search">
              <Search size={18} />
              <span className="sr-only">البحث العام</span>
              <input placeholder="ابحث عن مستخدم أو عملية استيراد…" />
              <kbd>⌘ K</kbd>
            </label>
          </div>
          <div className="topbar-actions">
            <span className="environment"><span /> الإنتاج</span>
            <button className="icon-button" aria-label="تغيير اللغة"><Languages size={19} /></button>
            <button className="icon-button" onClick={() => setTheme((value) => value === "light" ? "dark" : "light")} aria-label="تبديل المظهر">
              {theme === "light" ? <Moon size={19} /> : <Sun size={19} />}
            </button>
            <button className="icon-button notification" aria-label="الإشعارات"><Bell size={19} /><span>3</span></button>
            <div className="profile"><div className="avatar profile-photo" role="img" aria-label="صورة Walled" /><div><strong>Walled</strong><small>مسؤول عمليات</small></div></div>
          </div>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
