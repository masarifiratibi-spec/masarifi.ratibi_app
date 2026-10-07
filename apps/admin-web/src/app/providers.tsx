"use client";

import { useAuth, useClerk } from "@clerk/nextjs";
import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useLayoutEffect, useRef, useState } from "react";
import { bindApiSession } from "@/core/api/client";
import { returnToAdminSignIn } from "@/core/auth/sign-in-navigation";
import { MockProvider } from "./MockProvider";
import { QueryProvider } from "./QueryProvider";
import { ApiError, safeApiMessage } from "@/core/api/errors";
import { SessionExpired } from "@/components/admin/SessionExpired";

type AdminIdentity = {
  actorId: string;
  enabled: boolean;
  loaded: boolean;
  signOut?: () => Promise<void>;
};

const AdminIdentityContext = createContext<AdminIdentity>({
  actorId: "demo-admin",
  enabled: false,
  loaded: true,
});

export const useAdminIdentity = () => useContext(AdminIdentityContext);

function IdentityBridge({
  children,
  identity,
}: {
  children: React.ReactNode;
  identity: ReturnType<typeof useAuth>;
}) {
  const { isLoaded, userId, sessionId } = identity;
  const clerk = useClerk();
  const queryClient = useQueryClient();
  const [revoked, setRevoked] = useState(false);
  const release = useRef<(() => void) | null>(null);
  const mounted = useRef(false);
  const clerkRef = useRef(clerk);

  useLayoutEffect(() => { clerkRef.current = clerk; }, [clerk]);

  useLayoutEffect(() => {
    mounted.current = true;
    if (isLoaded && userId && sessionId) {
      release.current = bindApiSession(userId, sessionId, async () => {
        const session = clerkRef.current.session;
        const assertActive = () => {
          if (clerkRef.current.session?.id !== sessionId || clerkRef.current.session?.user.id !== userId) {
            throw new ApiError("session_expired", safeApiMessage("session_expired"), 401);
          }
        };
        assertActive();
        const token = await session!.getToken({ skipCache: true });
        assertActive();
        return token;
      });
    }
    const unsubscribe = clerkRef.current.addListener?.(({ session, user }) => {
      if (mounted.current && (session?.id !== sessionId || user?.id !== userId)) {
        release.current?.();
        void queryClient.cancelQueries();
        queryClient.clear();
        setRevoked(true);
      }
    });
    return () => {
      mounted.current = false;
      unsubscribe?.();
      release.current?.();
      void queryClient.cancelQueries();
      queryClient.clear();
    };
  }, [isLoaded, userId, sessionId, queryClient]);

  const signOut = async () => {
    if (!isLoaded || !userId || !sessionId) return;
    // A missing sessionId would revoke every session in a multi-session Clerk client.
    await clerk.signOut(async () => {
      release.current?.();
      await queryClient.cancelQueries();
      queryClient.clear();
      if (mounted.current) {
        setRevoked(true);
        returnToAdminSignIn();
      }
    }, { sessionId });
  };

  return (
    <AdminIdentityContext.Provider value={{ actorId: isLoaded && sessionId && !revoked ? userId ?? "" : "", enabled: true, loaded: isLoaded && !revoked, signOut: !revoked && userId && sessionId ? signOut : undefined }}>
      {revoked ? <SessionExpired temporary onReturn={returnToAdminSignIn} /> : children}
    </AdminIdentityContext.Provider>
  );
}

function IdentityQueryProvider({ children }: { children: React.ReactNode }) {
  const identity = useAuth();
  return (
    <QueryProvider key={identity.isLoaded ? `${identity.userId ?? "anonymous"}:${identity.sessionId ?? "signed-out"}` : "loading"}>
      <IdentityBridge identity={identity}>{children}</IdentityBridge>
    </QueryProvider>
  );
}

export function Providers({
  children,
  identityEnabled,
}: {
  children: React.ReactNode;
  identityEnabled: boolean;
}) {
  const content = <MockProvider>{children}</MockProvider>;
  return identityEnabled ? (
    <IdentityQueryProvider>{content}</IdentityQueryProvider>
  ) : (
    <QueryProvider>{content}</QueryProvider>
  );
}
