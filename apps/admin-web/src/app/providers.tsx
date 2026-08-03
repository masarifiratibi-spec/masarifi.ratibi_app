"use client";

import { MockProvider } from "./MockProvider";
import { QueryProvider } from "./QueryProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <MockProvider>{children}</MockProvider>
    </QueryProvider>
  );
}
