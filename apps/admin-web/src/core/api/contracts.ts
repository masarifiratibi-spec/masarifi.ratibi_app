import type { ApiErrorCode } from "./errors";

export interface ApiErrorPayload {
  status: number;
  code: ApiErrorCode;
  message: string;
  fieldErrors?: Record<string, string[]>;
  correlationId?: string;
}

export type AsyncViewState =
  | "loading"
  | "success"
  | "empty"
  | "partial"
  | "error"
  | "warning"
  | "conflict"
  | "forbidden"
  | "unavailable";

export interface SafeResponse<T> {
  data: T;
  partial?: boolean;
  warning?: string;
}
