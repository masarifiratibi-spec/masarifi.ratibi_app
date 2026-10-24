"use client";

import { useEffect, useState } from "react";
import { mocksEnabled } from "@/core/config/runtime";

let workerStart: Promise<unknown> | undefined;

export function MockProvider({ children }: { children: React.ReactNode }) {
  const enabled = mocksEnabled();
  const [ready, setReady] = useState(!enabled);
  const [failure, setFailure] = useState<"import" | "start" | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void (async () => {
      let worker;
      try {
        worker = (await import("@/mocks/browser")).mockWorker;
      } catch {
        workerStart = undefined;
        if (active) setFailure("import");
        return;
      }
      try {
        workerStart ??= worker.start({
          onUnhandledRequest(request, print) {
            if (new URL(request.url).pathname.startsWith("/api/"))
              print.error();
          },
        });
        await workerStart;
        if (active) setReady(true);
      } catch {
        workerStart = undefined;
        if (active) setFailure("start");
      }
    })();
    return () => {
      active = false;
    };
  }, [enabled, attempt]);

  return !enabled || ready ? (
    children
  ) : failure ? (
    <div className="page" role="alert">
      تعذر تجهيز البيانات التجريبية.
      {failure === "import" ? (
        <a href="">إعادة تحميل الصفحة</a>
      ) : (
        <button
          type="button"
          onClick={() => {
            setFailure(null);
            setAttempt((value) => value + 1);
          }}
        >
          إعادة المحاولة
        </button>
      )}
    </div>
  ) : (
    <div className="page" role="status">
      جاري تجهيز البيانات التجريبية…
    </div>
  );
}
