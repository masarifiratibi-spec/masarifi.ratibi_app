import type { UserRecord } from "../types/admin.ts";

export interface UserFilters {
  query?: string;
  status?: string;
  plan?: string;
  country?: string;
  platform?: string;
  verification?: string;
  risk?: string;
}

export function filterUsers(users: UserRecord[], filters: UserFilters) {
  const query = filters.query?.trim().toLocaleLowerCase("ar") ?? "";
  return users.filter((user) => {
    const searchable = `${user.name} ${user.email} ${user.id}`.toLocaleLowerCase("ar");
    return (!query || searchable.includes(query))
      && (!filters.status || user.status === filters.status)
      && (!filters.plan || user.plan === filters.plan)
      && (!filters.country || user.country === filters.country)
      && (!filters.platform || user.platform === filters.platform)
      && (!filters.verification || user.verification === filters.verification)
      && (!filters.risk || user.risk === filters.risk);
  });
}

export function paginate<T>(items: T[], page: number, pageSize: number) {
  return items.slice((page - 1) * pageSize, page * pageSize);
}

export function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("ar-SA", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function formatDate(value: string, includeTime = false) {
  return new Intl.DateTimeFormat("ar-SA", {
    dateStyle: "medium",
    ...(includeTime ? { timeStyle: "short" as const } : {}),
  }).format(new Date(value));
}
