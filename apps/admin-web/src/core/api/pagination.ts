export interface Pagination {
  page: number;
  pageSize: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: Pagination & { total: number; totalPages: number };
}

export function normalizePagination(input: Pagination): Pagination {
  return {
    page: Math.max(1, Math.trunc(input.page) || 1),
    pageSize: Math.min(100, Math.max(1, Math.trunc(input.pageSize) || 20)),
  };
}
