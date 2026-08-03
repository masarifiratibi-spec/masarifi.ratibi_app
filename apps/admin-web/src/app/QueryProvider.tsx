"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { subscribeToSimulatedRoleChange } from "@/core/auth/use-simulated-role";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
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
