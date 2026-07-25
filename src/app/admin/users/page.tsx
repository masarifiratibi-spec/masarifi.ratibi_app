"use client";

import { Check, Download, FilterX, Info, Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { Drawer, EmptyState, ErrorState, MetricCard, PageHeader, TableSkeleton } from "@/components/admin/ui";
import { users } from "@/data/admin/users";
import { filterUsers, formatDate, paginate, type UserFilters } from "@/lib/admin-utils";
import type { UserRecord, ViewState } from "@/types/admin";

const statusLabel = { active: "نشط", suspended: "موقوف", pending: "قيد التفعيل" };
const riskLabel = { low: "منخفض", medium: "متوسط", high: "مرتفع" };

export default function UsersPage() {
  const [filters, setFilters] = useState<UserFilters>({});
  const [state, setState] = useState<ViewState>("default");
  const [selected, setSelected] = useState<string[]>([]);
  const [activeUser, setActiveUser] = useState<UserRecord | null>(null);
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => filterUsers(users, filters), [filters]);
  const displayed = paginate(filtered, page, 5);
  const filterCount = Object.values(filters).filter(Boolean).length;
  const update = (key: keyof UserFilters, value: string) => { setFilters((current) => ({ ...current, [key]: value })); setPage(1); setState("default"); };
  const visible = state === "empty" ? [] : displayed;

  return (
    <div className="page">
      <PageHeader eyebrow="العملاء والإيرادات / المستخدمون" title="إدارة المستخدمين" description="اكتشاف الحسابات ومراجعة حالتها دون عرض بيانات مالية حساسة." actions={<button className="button"><Download size={16}/><span>تصدير الملخص</span></button>} />
      <div className="metrics-grid">{[
        { label: "إجمالي المستخدمين", value: "128,450", change: 8.4 },
        { label: "نشطون", value: "84,210", change: 5.2 },
        { label: "Premium", value: "19,340", tone: "premium" as const },
        { label: "موقوفون", value: "312", tone: "attention" as const },
      ].map((metric) => <MetricCard metric={metric} key={metric.label} />)}</div>
      <div className="toolbar">
        <div className="toolbar-filters">
          <label className="search-input"><Search size={17}/><span className="sr-only">بحث المستخدمين</span><input className="input" value={filters.query ?? ""} onChange={(event) => update("query", event.target.value)} placeholder="الاسم، البريد المخفي، أو المعرّف" /></label>
          <select className="select" value={filters.status ?? ""} onChange={(event) => update("status", event.target.value)} aria-label="حالة الحساب"><option value="">كل الحالات</option><option value="active">نشط</option><option value="pending">قيد التفعيل</option><option value="suspended">موقوف</option></select>
          <select className="select" value={filters.plan ?? ""} onChange={(event) => update("plan", event.target.value)} aria-label="الخطة"><option value="">كل الخطط</option><option>Free</option><option>Basic</option><option>Premium</option></select>
          <select className="select" value={filters.country ?? ""} onChange={(event) => update("country", event.target.value)} aria-label="الدولة"><option value="">كل الدول</option><option>السعودية</option><option>الإمارات</option></select>
          <select className="select" value={filters.platform ?? ""} onChange={(event) => update("platform", event.target.value)} aria-label="المنصة"><option value="">كل المنصات</option><option>iOS</option><option>Android</option></select>
          {filterCount > 0 && <button className="button ghost" onClick={() => setFilters({})}><FilterX size={16}/> مسح <span className="filter-count">{filterCount}</span></button>}
        </div>
        <div className="toolbar-actions"><span style={{color:"var(--text-muted)",fontSize:11}}><SlidersHorizontal size={14} style={{display:"inline"}}/> عرض محفوظ: المستخدمون النشطون</span></div>
      </div>
      <div className="toolbar-actions" style={{marginBottom:10}} aria-label="معاينة حالات الجدول">
        {(["default","loading","empty","error"] as ViewState[]).map((value) => <button key={value} className={`button ${state === value ? "primary" : "secondary"}`} onClick={() => setState(value)}>{({default:"البيانات",loading:"تحميل",empty:"بلا نتائج",error:"خطأ"})[value]}</button>)}
      </div>
      <div className="table-card">
        {state === "loading" ? <TableSkeleton/> : state === "error" ? <ErrorState/> : visible.length === 0 ? <EmptyState/> : <>
          <div className="desktop-table"><table className="data-table"><thead><tr><th><span className="sr-only">تحديد</span></th><th>المستخدم</th><th>الدولة</th><th>المنصة</th><th>الخطة</th><th>الحالة</th><th>التحقق</th><th>آخر نشاط</th><th>المخاطر</th><th>الإجراء</th></tr></thead><tbody>{visible.map((user) => <tr key={user.id} className={selected.includes(user.id) ? "selected" : ""}><td><input type="checkbox" checked={selected.includes(user.id)} onChange={() => setSelected((current) => current.includes(user.id) ? current.filter((id) => id !== user.id) : [...current, user.id])} aria-label={`تحديد ${user.name}`}/></td><td><div className="user-cell"><div className="avatar">{user.name.slice(0,2)}</div><div><button className="table-link" onClick={() => setActiveUser(user)}>{user.name}</button><small className="ltr">{user.email} · {user.id}</small></div></div></td><td>{user.country}</td><td className="ltr">{user.platform}</td><td>{user.plan}</td><td><span className={`badge status-${user.status === "active" ? "operational" : user.status === "suspended" ? "major-outage" : "maintenance"}`}>{statusLabel[user.status]}</span></td><td>{user.verification === "verified" ? "موثّق" : "معلّق"}</td><td>{formatDate(user.lastActive, true)}</td><td><span className={`badge severity-${user.risk}`}>{riskLabel[user.risk]}</span></td><td><button className="button ghost" onClick={() => setActiveUser(user)}>عرض</button></td></tr>)}</tbody></table></div>
          <div className="mobile-cards">{visible.map((user) => <article className="mobile-data-card" key={user.id}><div className="mobile-data-head"><div className="user-cell"><div className="avatar">{user.name.slice(0,2)}</div><div><strong>{user.name}</strong><small className="ltr">{user.id}</small></div></div><span className={`badge severity-${user.risk}`}>{riskLabel[user.risk]}</span></div><div className="mobile-data-meta"><div><small>الخطة</small><strong>{user.plan}</strong></div><div><small>الحالة</small><strong>{statusLabel[user.status]}</strong></div><div><small>الدولة</small><strong>{user.country}</strong></div><div><small>المنصة</small><strong className="ltr">{user.platform}</strong></div></div><button className="button" onClick={() => setActiveUser(user)}>عرض الملخص</button></article>)}</div>
          <div className="pagination"><span>عرض {visible.length} من {filtered.length}</span><div><button className="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>السابق</button><button className="button" disabled={page * 5 >= filtered.length} onClick={() => setPage((value) => value + 1)}>التالي</button></div></div>
        </>}
      </div>
      {selected.length > 0 && <div className="bulk-bar"><span><Check size={15} style={{display:"inline"}}/> تم تحديد {selected.length}</span><div><button className="button">إضافة ملاحظة</button><button className="button">تصدير المعرّفات</button></div></div>}
      <Drawer open={Boolean(activeUser)} onClose={() => setActiveUser(null)} title={activeUser?.name ?? ""} eyebrow={activeUser?.id}>
        {activeUser && <><div className="privacy-notice"><Info size={18}/><span>البيانات المالية الحساسة مخفية افتراضياً.</span></div><div className="detail-grid">{[
          ["البريد المخفي", activeUser.email, true], ["الدولة", activeUser.country], ["اللغة", activeUser.language], ["العملة", activeUser.currency, true],
          ["المنطقة الزمنية", activeUser.timezone, true], ["حالة الحساب", statusLabel[activeUser.status]], ["تاريخ التسجيل", formatDate(activeUser.registeredAt)],
          ["آخر نشاط", formatDate(activeUser.lastActive, true)], ["المنصة", activeUser.platform, true], ["إصدار التطبيق", activeUser.appVersion, true],
          ["الخطة الحالية", activeUser.plan], ["عدد الحسابات", String(activeUser.accounts)], ["المعاملات المجمعة", String(activeUser.transactions)],
          ["الأهداف", String(activeUser.goals)], ["آخر مزامنة", formatDate(activeUser.lastSync, true)], ["مصادر الاستيراد", String(activeUser.importSources)],
        ].map(([label,value,ltr]) => <div className="detail-item" key={label as string}><small>{label}</small><strong className={ltr ? "ltr" : ""}>{value}</strong></div>)}</div></>}
      </Drawer>
    </div>
  );
}
