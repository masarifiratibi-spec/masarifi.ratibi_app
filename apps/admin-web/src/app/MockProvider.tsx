"use client";

import { useEffect, useState } from "react";
import { mocksEnabled } from "@/core/config/runtime";

let workerStart: Promise<unknown> | undefined;

export function MockProvider({ children }: { children: React.ReactNode }) {
  const enabled = mocksEnabled();
  const [ready, setReady] = useState(!enabled);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void import("@/mocks/browser")
      .then(
        ({ mockWorker }) =>
          (workerStart ??= mockWorker.start({
            onUnhandledRequest(request, print) {
              if (new URL(request.url).pathname.startsWith("/api/"))
                print.error();
            },
          })),
      )
      .then(() => {
        if (active) setReady(true);
      })
      .catch(() => {
        workerStart = undefined;
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [enabled, attempt]);

  return !enabled || ready ? (
    children
  ) : failed ? (
    <div className="page" role="alert">
      تعذر تجهيز البيانات التجريبية.
      <button
        type="button"
        onClick={() => {
          setFailed(false);
          setAttempt((value) => value + 1);
        }}
      >
        إعادة المحاولة
      </button>
    </div>
  ) : (
    <div className="page" role="status">
      جاري تجهيز البيانات التجريبية…
    </div>
  );
}
