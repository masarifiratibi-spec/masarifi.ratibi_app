"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ApiError } from "@/core/api/errors";
import { subscribeToSimulatedRoleChange } from "@/core/auth/use-simulated-role";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: (count, error) => {
              if (error instanceof ApiError &&
                  (error.code === "rate_limited" || error.code === "recent_auth_required")) return false;
              return count < 1;
            },
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
          mutations: { retry: false },
        },
      }),
  );

  useEffect(() => subscribeToSimulatedRoleChange(() => client.clear()), [client]);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
