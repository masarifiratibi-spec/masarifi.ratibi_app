import { z } from "zod";

export const deletionStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum([
    "requested",
    "verified",
    "processing",
    "completed",
    "cancelled",
    "failed",
  ]),
  coolingOffEndsAt: z.string().datetime().nullable().optional(),
  completedAt: z.string().datetime().nullable().optional(),
});
export type DeletionStatus = z.infer<typeof deletionStatusSchema>;
export type DeletionJournal = {
  operationId: string;
  completionToken: string;
  requestId?: string;
};
export const deletionJournalSchema = z
  .object({
    operationId: z.string().uuid(),
    completionToken: z.string().regex(/^[a-f0-9]{64}$/),
    requestId: z.string().uuid().optional(),
  })
  .strict();

// Match Clerk's documented reverification hint contract; its hook presents the factor UI.
export const recentAuthHint = {
  clerk_error: {
    type: "forbidden",
    reason: "reverification-error",
    metadata: { reverification: { level: "first_factor", afterMinutes: 1 } },
  },
} as const;

export async function deletionRequest(
  path: string,
  init: RequestInit,
  token: string,
  fetcher = fetch,
) {
  const origin = process.env.NEXT_PUBLIC_API_URL;
  if (!origin || !/^https:\/\//.test(origin))
    throw new Error("SERVICE_UNAVAILABLE");
  const response = await fetcher(
    `${origin.replace(/\/+$/, "")}/api/v1/${path}`,
    {
      ...init,
      cache: "no-store",
      credentials: "omit",
      headers: {
        "Content-Type": "application/json",
        ...init.headers,
        Authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(30000),
    },
  );
  if (response.status === 204) return null;
  const body: unknown = await response.json();
  if (!response.ok) {
    if (
      response.status === 403 &&
      body &&
      typeof body === "object" &&
      "code" in body &&
      body.code === "RECENT_AUTH_REQUIRED"
    )
      return recentAuthHint;
    throw new Error(
      response.status === 429 ? "RATE_LIMITED" : "REQUEST_FAILED",
    );
  }
  return deletionStatusSchema.parse(body);
}
