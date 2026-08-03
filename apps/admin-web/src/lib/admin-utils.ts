import type { AdminUserListItem, AdminUsersQuery } from "@/features/users/contracts";

export type UserFilters = Partial<Omit<AdminUsersQuery, "page" | "pageSize" | "scenario">>;
type FilterableUser = AdminUserListItem & { appVersion?: string };

export function filterUsers<User extends FilterableUser>(users: User[], filters: UserFilters): User[] {
  const query = filters.query?.toLocaleLowerCase("ar");
  return users.filter((user) => {
    const searchable = `${user.displayName} ${user.maskedEmail} ${user.id}`.toLocaleLowerCase("ar");
    const platformMatches = filters.platform === undefined
      || filters.platform === "all"
      || (filters.platform === "multi"
        ? user.registeredPlatforms.length === 2
        : user.registeredPlatforms.includes(filters.platform));

    return (!query || searchable.includes(query))
      && (!filters.status || user.status === filters.status)
      && (!filters.plan || user.plan === filters.plan)
      && (!filters.country || user.country === filters.country)
      && (!filters.language || user.language === filters.language)
      && (!filters.registeredFrom || user.registeredAt >= filters.registeredFrom)
      && (!filters.registeredTo || user.registeredAt.slice(0, 10) <= filters.registeredTo)
      && (!filters.lastActiveFrom || user.lastActiveAt >= filters.lastActiveFrom)
      && (!filters.lastActiveTo || user.lastActiveAt <= filters.lastActiveTo)
      && platformMatches
      && (!filters.appVersion || user.appVersion === filters.appVersion)
      && (!filters.verification || user.verification === filters.verification)
      && (!filters.risk || user.risk === filters.risk);
  });
}

const riskRank = { low: 0, medium: 1, high: 2 } as const;

export function sortUsers<User extends AdminUserListItem>(
  users: User[],
  sort: AdminUsersQuery["sort"],
  order: AdminUsersQuery["order"],
): User[] {
  const direction = order === "asc" ? 1 : -1;
  return [...users].sort((left, right) => {
    const comparison = sort === "name"
      ? left.displayName.localeCompare(right.displayName, ["en", "ar"])
      : sort === "registeredAt"
        ? left.registeredAt.localeCompare(right.registeredAt)
        : sort === "lastActive"
          ? left.lastActiveAt.localeCompare(right.lastActiveAt)
          : riskRank[left.risk] - riskRank[right.risk];
    return comparison * direction || left.id.localeCompare(right.id);
  });
}

export function paginate<T>(items: T[], page: number, pageSize: number) {
  return items.slice((page - 1) * pageSize, page * pageSize);
}

export function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

const adminDateFormatter = new Intl.DateTimeFormat("en-GB-u-nu-latn", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const adminDateTimeFormatter = new Intl.DateTimeFormat("en-GB-u-nu-latn", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

export function formatAdminNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatDate(value: string, includeTime = false) {
  return (includeTime ? adminDateTimeFormatter : adminDateFormatter)
    .format(new Date(value))
    .replace(/\b(am|pm)\b/g, (period) => period.toUpperCase());
}
