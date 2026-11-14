"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader, RegionState } from "@/components/admin/ui";
import { useLocale } from "@/core/localization/provider";
import { useCurrentPermission } from "@/core/permissions/current-permissions";
import { getStatusLabel } from "@/core/localization/display-labels";
import {
  communicationsRepository,
  type SupportTicketQuery,
} from "./repository";
import {
  useSupportCategories,
  useSupportConversation,
  useSupportTickets,
  useTicketAction,
} from "./hooks";
import { SupportConversation } from "./SupportConversation";
import { SafeText } from "./shared/SafeText";

const labels = {
  en: {
    tickets: "Support tickets",
    description: "Search and triage customer conversations.",
    search: "Search subject or ticket ID",
    status: "Status",
    priority: "Priority",
    assignee: "Assigned Admin ID",
    unassigned: "Unassigned",
    category: "Category",
    from: "Created from (UTC)",
    to: "Created to (UTC)",
    all: "All",
    apply: "Apply filters",
    next: "Next",
    previous: "Previous",
    empty: "No matching tickets",
    total: "Matching tickets",
    customer: "Customer",
    detail: "Ticket conversation",
    downloadReady: "Open attachment",
    downloadError: "Attachment unavailable. Try again.",
    changed:
      "The ticket changed while loading messages. Refresh before continuing.",
    refresh: "Refresh ticket",
  },
  ar: {
    tickets: "تذاكر الدعم",
    description: "بحث وفرز محادثات العملاء.",
    search: "بحث بالعنوان أو معرّف التذكرة",
    status: "الحالة",
    priority: "الأولوية",
    assignee: "معرّف المشرف المكلّف",
    unassigned: "غير مكلّف",
    category: "التصنيف",
    from: "تاريخ الإنشاء من (UTC)",
    to: "تاريخ الإنشاء إلى (UTC)",
    all: "الكل",
    apply: "تطبيق الفلاتر",
    next: "التالي",
    previous: "السابق",
    empty: "لا توجد تذاكر مطابقة",
    total: "التذاكر المطابقة",
    customer: "العميل",
    detail: "محادثة التذكرة",
    downloadReady: "فتح المرفق",
    downloadError: "المرفق غير متاح. أعد المحاولة.",
    changed: "تغيرت التذكرة أثناء تحميل الرسائل. حدّثها قبل المتابعة.",
    refresh: "تحديث التذكرة",
  },
};

export function SupportTicketList() {
  const { locale } = useLocale();
  const c = labels[locale];
  const [filters, setFilters] = useState<SupportTicketQuery>({
    page: 1,
    pageSize: "25",
  });
  const [cursors, setCursors] = useState<Array<string | undefined>>([
    undefined,
  ]);
  const query = useSupportTickets({
    ...filters,
    cursor: cursors[filters.page - 1],
  });
  const categories = useSupportCategories({});
  return (
    <div className="page">
      <PageHeader title={c.tickets} description={c.description} />
      <form
        className="table-card support-filters"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          setCursors([undefined]);
          setFilters({
            page: 1,
            pageSize: "25",
            search: String(form.get("search") ?? ""),
            status: (form.get("status") ||
              undefined) as SupportTicketQuery["status"],
            priority: (form.get("priority") ||
              undefined) as SupportTicketQuery["priority"],
            assignedAgent: String(form.get("assignee") || "") || undefined,
            categoryId: String(form.get("category") || "") || undefined,
            dateFrom: String(form.get("from") || "") || undefined,
            dateTo: String(form.get("to") || "") || undefined,
          });
        }}
      >
        <label>
          {c.search}
          <input name="search" type="search" maxLength={120} />
        </label>
        <label>
          {c.status}
          <select name="status">
            <option value="">{c.all}</option>
            {[
              "open",
              "waiting_customer",
              "waiting_support",
              "resolved",
              "closed",
            ].map((status) => (
              <option key={status} value={status}>
                {getStatusLabel(locale, status)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {c.priority}
          <select name="priority">
            <option value="">{c.all}</option>
            {["low", "normal", "high", "urgent"].map((priority) => (
              <option key={priority} value={priority}>
                {getStatusLabel(locale, priority)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {c.assignee}
          <input name="assignee" list="support-assignees" maxLength={128} />
          <datalist id="support-assignees">
            <option value="unassigned">{c.unassigned}</option>
          </datalist>
        </label>
        <label>
          {c.category}
          <select name="category">
            <option value="">{c.all}</option>
            {categories.data?.items.map((category) => (
              <option key={category.id} value={category.id}>
                {category.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          {c.from}
          <input type="date" name="from" />
        </label>
        <label>
          {c.to}
          <input type="date" name="to" />
        </label>
        <button className="button primary">{c.apply}</button>
      </form>
      <RegionState
        isPending={query.isPending}
        isError={query.isError}
        error={query.error ? { code: query.error.message } : undefined}
        permission="support.tickets.read"
        onRetry={() => void query.refetch()}
      >
        {query.data && (
          <>
            <p>
              {c.total}: {query.data.pagination.totalItems}
            </p>
            <div className="support-ticket-list">
              {query.data.tickets.map((ticket) => (
                <article className="table-card" key={ticket.id}>
                  <h2>
                    <Link
                      href={`/admin/support/tickets/${encodeURIComponent(ticket.id)}`}
                    >
                      <SafeText text={ticket.title} />
                    </Link>
                  </h2>
                  <p>
                    {getStatusLabel(locale, ticket.state)} ·{" "}
                    {getStatusLabel(locale, ticket.priority ?? "normal")}
                  </p>
                  <p>
                    {c.customer}: <bdi>{ticket.customerReference}</bdi>
                  </p>
                  <p>
                    {c.assignee}:{" "}
                    <bdi>{ticket.assignedAdminId ?? c.unassigned}</bdi>
                  </p>
                  <small>
                    <bdi>{ticket.id}</bdi>
                  </small>
                </article>
              ))}
            </div>
            {!query.data.tickets.length && <p role="status">{c.empty}</p>}
            <nav className="toolbar-actions" aria-label={c.tickets}>
              <button
                className="button"
                disabled={filters.page === 1 || query.isFetching}
                onClick={() =>
                  setFilters((value) => ({ ...value, page: value.page - 1 }))
                }
              >
                {c.previous}
              </button>
              <span>
                {filters.page} / {Math.max(1, query.data.pagination.totalPages)}
              </span>
              <button
                className="button"
                disabled={!query.data.hasMore || query.isFetching}
                onClick={() => {
                  const next = query.data?.nextCursor;
                  if (!next) return;
                  setCursors((value) => [
                    ...value.slice(0, filters.page),
                    next,
                  ]);
                  setFilters((value) => ({ ...value, page: value.page + 1 }));
                }}
              >
                {c.next}
              </button>
            </nav>
          </>
        )}
      </RegionState>
    </div>
  );
}

export function SupportTicketConversation({ ticketId }: { ticketId: string }) {
  const { locale } = useLocale();
  const c = labels[locale];
  const can = useCurrentPermission();
  const query = useSupportConversation(ticketId);
  const mutation = useTicketAction();
  const [download, setDownload] = useState<{
    url: string;
    expiresAt: string;
  } | null>(null);
  const [downloadFailed, setDownloadFailed] = useState(false);
  useEffect(() => {
    if (!download) return;
    const timer = setTimeout(
      () => setDownload(null),
      Math.max(0, Date.parse(download.expiresAt) - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [download]);
  const first = query.data?.pages[0];
  const changed = query.data?.pages.some(
    (page) => page.revision !== first?.revision,
  );
  const item = first
    ? {
        ...first,
        messages: [
          ...new Map(
            query
              .data!.pages.flatMap((page) => page.messages ?? [])
              .map((message) => [message.id, message]),
          ).values(),
        ],
        nextMessageCursor: query.data?.pages.at(-1)?.nextMessageCursor,
        hasMoreMessages: query.hasNextPage,
      }
    : undefined;
  return (
    <div className="page">
      <PageHeader title={first?.title ?? c.detail} description={ticketId} />
      <RegionState
        isPending={query.isPending}
        isError={query.isError}
        error={query.error ? { code: query.error.message } : undefined}
        permission="support.tickets.detail.read"
        onRetry={() => void query.refetch()}
      >
        {changed && (
          <p role="alert">
            {c.changed}
            <button className="button" onClick={() => void query.refetch()}>
              {c.refresh}
            </button>
          </p>
        )}
        {item && (
          <SupportConversation
            item={item}
            pending={mutation.isPending || query.isFetchingNextPage}
            canAct={(permission) => !changed && can(permission) && (permission === "support.tickets.notes" || can("support.tickets.manage"))}
            onLoadMore={() => void query.fetchNextPage()}
            onRefresh={() => void query.refetch()}
            onAction={async (action) => {
              const result = await mutation.mutateAsync({ ticketId, action });
              if (!["success", "accepted"].includes(result.outcome))
                throw new Error(result.outcome);
            }}
            onDownload={async (id) => {
              setDownload(null);
              setDownloadFailed(false);
              try {
                const signed =
                  await communicationsRepository.downloadSupportAttachment(
                    ticketId,
                    id,
                  );
                if (Date.parse(signed.expiresAt) <= Date.now())
                  throw new Error("expired");
                setDownload(signed);
              } catch {
                setDownloadFailed(true);
              }
            }}
          />
        )}
      </RegionState>
      {download && (
        <p role="status">
          <a href={download.url} target="_blank" rel="noopener noreferrer">
            {c.downloadReady}
          </a>
        </p>
      )}
      {downloadFailed && <p role="alert">{c.downloadError}</p>}
    </div>
  );
}
