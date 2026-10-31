"use client";

import { useRef, useState } from "react";
import { LogOut } from "lucide-react";
import { useAdminIdentity } from "@/app/providers";
import { useT } from "@/core/localization/provider";

export function SignOutButton() {
  const identity = useAdminIdentity();
  const translate = useT();
  const pendingRef = useRef(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!identity.enabled || !identity.loaded || !identity.actorId || !identity.signOut) return null;

  const signOut = async () => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setFailed(false);
    try {
      await identity.signOut?.();
    } catch {
      setFailed(true);
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };

  return <>
    <button type="button" className="button sign-out-button" title={translate("shell.signOut")} disabled={pending} onClick={() => void signOut()}>
      <LogOut size={18} aria-hidden="true" />
      <span>{translate(pending ? "shell.signingOut" : "shell.signOut")}</span>
    </button>
    {failed && <span role="alert">{translate("shell.signOutFailed")}</span>}
  </>;
}
