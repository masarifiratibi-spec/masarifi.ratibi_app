"use client";

import { AlertCircle, CheckCircle, LoaderCircle } from "lucide-react";
import { useEffect, useRef } from "react";
import { useLocale } from "@/core/localization/provider";
import type { ActionContext } from "../contracts";

interface CommunicationActionDialogProps {
  open: boolean;
  title: string;
  message: string;
  actionLabel: string;
  cancelLabel: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  actionContext?: ActionContext;
  triggerRef?: React.RefObject<HTMLElement | null>;
  pending?: boolean;
  successMessage?: string;
  errorMessage?: string;
  direction?: "rtl" | "ltr";
  reducedMotion?: boolean;
  permissionDenied?: boolean;
  deniedMessage?: string;
}

export function CommunicationActionDialog({
  open,
  title,
  message,
  actionLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  actionContext,
  triggerRef,
  pending = false,
  successMessage,
  errorMessage,
  direction,
  reducedMotion = false,
  permissionDenied = false,
  deniedMessage,
}: CommunicationActionDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const { locale } = useLocale();
  const dir = direction ?? (locale === "ar" ? "rtl" : "ltr");
  const c = locale === "ar"
    ? { action: "الإجراء", expectedState: "الحالة المتوقعة", expectedVersion: "الإصدار المتوقع", pending: "جاري التنفيذ...", reason: "السبب", denied: "غير مصرح بهذا الإجراء" }
    : { action: "Action", expectedState: "Expected state", expectedVersion: "Expected version", pending: "Processing...", reason: "Reason", denied: "You are not authorized for this action" };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      if (typeof dialog.showModal === "function") {
        dialog.showModal();
      } else {
        dialog.setAttribute("open", "");
      }
      confirmRef.current?.focus();
    }
    if (!open && dialog.open) {
      if (typeof dialog.close === "function") {
        dialog.close();
      } else {
        dialog.removeAttribute("open");
      }
      triggerRef?.current?.focus();
    }
  }, [open, triggerRef]);

  if (!open) return null;

  const closeDialog = () => {
    onCancel();
    triggerRef?.current?.focus();
  };

  return (
    <dialog
      aria-labelledby="communication-action-title"
      className="confirmation"
      dir={dir}
      onCancel={(event) => {
        event.preventDefault();
        closeDialog();
      }}
      ref={dialogRef}
      style={reducedMotion ? { transition: "none" } : undefined}
    >
      <h2 id="communication-action-title">{title}</h2>
      <p>{permissionDenied ? deniedMessage ?? c.denied : message}</p>

      {actionContext && !permissionDenied && (
        <dl className="confirmation-details">
          <div><dt>{c.action}</dt><dd>{actionContext.action}</dd></div>
          <div><dt>{c.expectedVersion}</dt><dd>{actionContext.expectedVersion}</dd></div>
          {actionContext.expectedState && <div><dt>{c.expectedState}</dt><dd>{actionContext.expectedState}</dd></div>}
          {actionContext.reason && <div><dt>{c.reason}</dt><dd>{actionContext.reason}</dd></div>}
        </dl>
      )}

      {successMessage && <p aria-live="polite" role="status"><CheckCircle size={18} />{successMessage}</p>}
      {errorMessage && <p aria-live="assertive" role="alert"><AlertCircle size={18} />{errorMessage}</p>}
      {pending && <p aria-live="polite" role="status"><LoaderCircle size={18} />{c.pending}</p>}

      <div className="dialog-actions">
        <button className="button secondary" disabled={pending} onClick={closeDialog} type="button">
          {cancelLabel}
        </button>
        {!permissionDenied && (
          <button className="button primary" disabled={pending} onClick={() => void onConfirm()} ref={confirmRef} type="button">
            {actionLabel}
          </button>
        )}
      </div>
    </dialog>
  );
}
