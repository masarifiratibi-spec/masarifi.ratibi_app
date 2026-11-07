"use client";

import { SignIn, useClerk, useReverification } from "@clerk/nextjs";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  deletionJournalSchema,
  deletionRequest,
  type DeletionJournal,
  type DeletionStatus,
} from "./deletion-client";
import styles from "./deletion.module.css";

const copy = {
  ar: {
    title: "حذف حساب مصاريفي",
    language: "English",
    intro:
      "يمكنك طلب حذف حسابك والبيانات المرتبطة به من هذه الصفحة دون تثبيت التطبيق.",
    effect:
      "يشمل الطلب بيانات الحساب والمعاملات والحسابات المالية والميزانيات والصوت والتتبع المرتبطة بك. صدّر ما تحتاجه من التطبيق أولاً. البيانات غير المتزامنة على جهازك لا تصل إلى الخادم؛ أزلها من الجهاز بشكل منفصل.",
    retention:
      "لا يعني إرسال الطلب اكتمال الحذف. قد تؤخر فترة الانتظار أو التزام الاحتفاظ القانوني المعالجة. تظهر حالة الطلب أدناه؛ لا نعرض تأكيد الإزالة إلا بعد إكمال المعالجة. قد تبقى سجلات امتثال وأمن محدودة وفق سياسة الاحتفاظ المطبقة.",
    confirm: "أفهم أن حذف الحساب نهائي بعد اكتماله، وأطلب حذف حسابي وبياناته.",
    submit: "طلب حذف الحساب",
    refresh: "تحديث الحالة",
    cancel: "إلغاء طلب الحذف",
    signIn:
      "سجّل الدخول بالحساب الذي تريد حذفه. قد يُطلب منك تأكيد هويتك مرة أخرى.",
    unavailable:
      "خدمة طلب الحذف غير متاحة حالياً. حاول لاحقاً أو استخدم الخصوصية داخل تطبيق مصاريفي.",
    failure:
      "تعذر إتمام الطلب. احتفظنا بمعرّف المحاولة؛ أعد المحاولة أو حدّث الحالة.",
    deadline: "نهاية فترة الانتظار",
    state: "حالة الطلب",
    requested: "تم استلام الطلب",
    verified: "بانتظار انتهاء فترة الانتظار",
    processing: "الحذف قيد المعالجة",
    completed: "اكتملت معالجة الحذف",
    cancelled: "تم إلغاء الطلب",
    failed: "لم تكتمل المعالجة؛ أعد المحاولة",
    waiting: "جارٍ التحميل…",
    newRequest: "بدء طلب جديد",
  },
  en: {
    title: "Delete your Masarifi account",
    language: "العربية",
    intro:
      "Request deletion of your account and associated data here without installing the app.",
    effect:
      "The request covers your profile, transactions, financial accounts, budgets, voice and tracking data. Export anything you need in the app first. Unsynced data on your device is not on the server; remove it separately from the device.",
    retention:
      "Submitting a request does not confirm erasure. A waiting period or legal retention hold can delay processing. Check the status below; completion is shown only after processing finishes. Limited compliance and security records may remain under the applicable retention policy.",
    confirm:
      "I understand deletion is permanent when completed, and request deletion of my account and its data.",
    submit: "Request account deletion",
    refresh: "Refresh status",
    cancel: "Cancel deletion request",
    signIn:
      "Sign in to the account you want to delete. You may be asked to verify your identity again.",
    unavailable:
      "The deletion request service is currently unavailable. Try later or use Privacy in the Masarifi app.",
    failure:
      "The request could not be completed. We kept the attempt identifier; retry or refresh its status.",
    deadline: "Waiting period ends",
    state: "Request status",
    requested: "Request received",
    verified: "Waiting period in progress",
    processing: "Deletion in progress",
    completed: "Deletion processing completed",
    cancelled: "Request cancelled",
    failed: "Processing incomplete; retry",
    waiting: "Loading…",
    newRequest: "Start a new request",
  },
};
type Language = keyof typeof copy;

export function DeletionPage({ enabled }: { enabled: boolean }) {
  const [language, setLanguage] = useState<Language>("ar");
  const text = copy[language];
  return (
    <main
      className={styles.page}
      lang={language}
      dir={language === "ar" ? "rtl" : "ltr"}
    >
      <header className={styles.header}>
        <span>مصاريفي · Masarifi</span>
        <button
          type="button"
          onClick={() => setLanguage(language === "ar" ? "en" : "ar")}
        >
          {text.language}
        </button>
      </header>
      <div className={styles.grid}>
        <section>
          <h1>{text.title}</h1>
          <p className={styles.intro}>{text.intro}</p>
        </section>
        <section className={styles.details}>
          <p>{text.effect}</p>
          <p>{text.retention}</p>
          {enabled ? (
            <AuthenticatedDeletion text={text} language={language} />
          ) : (
            <p role="alert">{text.unavailable}</p>
          )}
        </section>
      </div>
    </main>
  );
}

function AuthenticatedDeletion({
  text,
  language,
}: {
  text: typeof copy.ar | typeof copy.en;
  language: Language;
}) {
  const clerk = useClerk();
  const snapshot = useSyncExternalStore(
    (notify) => clerk.addListener(() => notify()),
    () => {
      if (clerk.user?.id && clerk.session?.id)
        return JSON.stringify({
          owner: clerk.user.id,
          sessionId: clerk.session.id,
          signedIn: true,
        });
      try {
        const saved = sessionStorage.getItem("masarifi.deletion.lastOwner");
        const previous: unknown = saved ? JSON.parse(saved) : null;
        if (
          previous &&
          typeof previous === "object" &&
          "owner" in previous &&
          "sessionId" in previous &&
          typeof previous.owner === "string" &&
          typeof previous.sessionId === "string"
        )
          return JSON.stringify({
            owner: previous.owner,
            sessionId: previous.sessionId,
            signedIn: false,
          });
      } catch {
        /* A missing receipt does not prevent sign-in. */
      }
      return "";
    },
    () => "",
  );
  const identity = snapshot
    ? (JSON.parse(snapshot) as {
        owner: string;
        sessionId: string;
        signedIn: boolean;
      })
    : null;
  const signedIn = identity?.signedIn === true;
  return (
    <div>
      {!signedIn ? (
        <>
          <p>{text.signIn}</p>
          <SignIn
            routing="hash"
            forceRedirectUrl="/delete-account"
            signUpForceRedirectUrl="/delete-account"
          />
        </>
      ) : null}
      {identity ? (
        <DeletionForm
          key={`${identity.owner}:${identity.sessionId}`}
          owner={identity.owner}
          sessionId={identity.sessionId}
          text={text}
          language={language}
        />
      ) : null}
    </div>
  );
}

function DeletionForm({
  owner,
  sessionId,
  text,
  language,
}: {
  owner: string;
  sessionId: string;
  text: typeof copy.ar | typeof copy.en;
  language: Language;
}) {
  const clerk = useClerk();
  const key = `masarifi.deletion.${owner}`;
  const journal = useRef<DeletionJournal | null>(null);
  const active = useRef(true);
  const inFlight = useRef(false);
  const [observedAt, setObservedAt] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setObservedAt(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const [hasReceipt, setHasReceipt] = useState(false);
  const [busy, setBusy] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [status, setStatus] = useState<DeletionStatus | null>(null);
  const [failed, setFailed] = useState(false);
  const assertCurrent = () => {
    if (
      !active.current ||
      clerk.session?.id !== sessionId ||
      clerk.user?.id !== owner
    )
      throw new Error("OWNER_CHANGED");
  };
  const save = () => {
    assertCurrent();
    sessionStorage.setItem(key, JSON.stringify(journal.current));
    setHasReceipt(Boolean(journal.current));
    sessionStorage.setItem(
      "masarifi.deletion.lastOwner",
      JSON.stringify({ owner, sessionId }),
    );
  };
  const authenticatedRequest = useReverification(
    async (path: string, init: RequestInit) => {
      assertCurrent();
      const token = await clerk.session!.getToken({ skipCache: true });
      assertCurrent();
      if (!token) throw new Error("SESSION_REQUIRED");
      const result = await deletionRequest(path, init, token);
      // A successful immediate deletion may revoke the session during this request.
      if (result && !("clerk_error" in result) && result.status === "completed")
        return result;
      assertCurrent();
      return result;
    },
  );
  useEffect(() => {
    active.current = true;
    try {
      const saved = sessionStorage.getItem(key);
      journal.current = saved
        ? deletionJournalSchema.parse(JSON.parse(saved))
        : null;
      setHasReceipt(Boolean(journal.current));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
    return () => {
      active.current = false;
    };
  }, [key]);
  const perform = async (action: "request" | "refresh" | "cancel") => {
    if (inFlight.current || (action === "request" && !confirmed)) return;
    inFlight.current = true;
    setBusy(true);
    setFailed(false);
    try {
      if (action === "refresh") {
        if (!active.current || (clerk.user && clerk.user.id !== owner))
          throw new Error("OWNER_CHANGED");
        if (!journal.current) throw new Error("NO_RECEIPT");
      } else assertCurrent();
      if (!journal.current) {
        const bytes = crypto.getRandomValues(new Uint8Array(32));
        journal.current = {
          operationId: crypto.randomUUID(),
          completionToken: Array.from(bytes, (value) =>
            value.toString(16).padStart(2, "0"),
          ).join(""),
        };
        save();
      }
      const saved = journal.current;
      let result: DeletionStatus | null;
      if (action === "refresh") {
        // The narrowly scoped receipt works after immediate deletion has revoked sign-in.
        const value =
          saved.requestId && clerk.session?.id === sessionId
            ? await authenticatedRequest(
                `me/deletion-requests/${saved.requestId}`,
                {},
              )
            : await deletionRequest(
                `privacy/deletion-completions/${saved.operationId}`,
                {},
                saved.completionToken,
              );
        if (value && "clerk_error" in value) throw new Error("RECEIPT_INVALID");
        result = value;
      } else {
        const path =
          action === "cancel"
            ? `me/deletion-requests/${saved.requestId}`
            : "me/deletion-requests";
        const value = await authenticatedRequest(path, {
          method: action === "cancel" ? "DELETE" : "POST",
          headers: {
            "Idempotency-Key":
              action === "cancel"
                ? `${saved.operationId}-cancel`
                : saved.operationId,
          },
          ...(action === "request"
            ? {
                body: JSON.stringify({
                  confirmation: "DELETE_MY_ACCOUNT",
                  completionToken: saved.completionToken,
                }),
              }
            : {}),
        });
        if (value && "clerk_error" in value)
          throw new Error("REVERIFICATION_REQUIRED");
        result = value;
      }
      if (!active.current) return;
      if (result) {
        setStatus(result);
        if (clerk.session?.id === sessionId) {
          saved.requestId = result.id;
          save();
        }
      } else if (action === "cancel" && status)
        setStatus({ ...status, status: "cancelled" });
    } catch {
      if (active.current) setFailed(true);
    } finally {
      inFlight.current = false;
      if (active.current) setBusy(false);
    }
  };
  const authenticated =
    clerk.session?.id === sessionId && clerk.user?.id === owner;
  const canCancel =
    authenticated &&
    status &&
    ["requested", "verified"].includes(status.status) &&
    status.coolingOffEndsAt &&
    Date.parse(status.coolingOffEndsAt) > observedAt;
  return (
    <div className={styles.form}>
      {status ? (
        <div role="status">
          <strong>
            {text.state}: {text[status.status]}
          </strong>
          {status.coolingOffEndsAt &&
          ["requested", "verified"].includes(status.status) ? (
            <p>
              {text.deadline}:{" "}
              {new Intl.DateTimeFormat(language, {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(status.coolingOffEndsAt))}
            </p>
          ) : null}
        </div>
      ) : null}
      {failed ? <p role="alert">{text.failure}</p> : null}
      {authenticated && (!status || status.status === "failed") ? (
        <>
          <label className={styles.confirm}>
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            {text.confirm}
          </label>
          <button
            disabled={busy || !confirmed}
            onClick={() => void perform("request")}
          >
            {busy ? text.waiting : text.submit}
          </button>
        </>
      ) : null}
      <button
        disabled={busy || !hasReceipt}
        onClick={() => void perform("refresh")}
      >
        {text.refresh}
      </button>
      {canCancel ? (
        <button disabled={busy} onClick={() => void perform("cancel")}>
          {text.cancel}
        </button>
      ) : null}
      {status?.status === "cancelled" ? (
        <button
          disabled={busy}
          onClick={() => {
            journal.current = null;
            setHasReceipt(false);
            sessionStorage.removeItem(key);
            setStatus(null);
            setConfirmed(false);
          }}
        >
          {text.newRequest}
        </button>
      ) : null}
    </div>
  );
}
