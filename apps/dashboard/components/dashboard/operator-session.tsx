"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { ApiError, getMe, type Me } from "@/lib/api";
import { supabase } from "@/lib/supabase";

const OperatorContext = createContext<Me | null>(null);

export function useOperatorIdentity() {
  return useContext(OperatorContext);
}

/** Gate the route itself, so page effects cannot read or subscribe before /me authorizes them. */
export function OperatorSessionBoundary({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const publicRoute = pathname === "/" || pathname === "/login";
  if (publicRoute) return children;
  return <OperatorGate>{children}</OperatorGate>;
}

export function OperatorGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [identity, setIdentity] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let revision = 0;
    setIdentity(null);
    setError(null);
    const client = supabase();
    if (!client) {
      setError("Supabase Auth is not configured. Operator access is unavailable.");
      return;
    }
    const verify = async () => {
      const request = ++revision;
      try {
        const me = await getMe();
        if (cancelled || request !== revision) return;
        if (!me.is_operator) {
          setIdentity(null);
          setError("This account does not have operator access. Contact an administrator.");
          return;
        }
        setIdentity(me);
        setError(null);
      } catch (cause) {
        if (cancelled || request !== revision) return;
        setIdentity(null);
        if (cause instanceof ApiError && cause.status === 401) router.replace("/login");
        setError(cause instanceof ApiError && cause.status === 403
          ? "This account does not have operator access."
          : "Unable to verify operator access. Sign in again or retry when the API is reachable.");
      }
    };
    void verify();
    const { data } = client.auth.onAuthStateChange((event, session) => {
      // Do not await Supabase methods inside its auth callback (it holds an auth lock).
      if (!session) {
        revision += 1;
        setIdentity(null);
        router.replace("/login");
      } else if (event !== "INITIAL_SESSION") {
        setIdentity(null);
        window.setTimeout(() => { if (!cancelled) void verify(); }, 0);
      }
    });
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [router, retry]);

  if (!identity) {
    return <main className="flex min-h-screen items-center justify-center bg-background px-6 text-sm text-muted-foreground"><div className="max-w-md rounded-xl border border-border bg-card p-6 text-center">
      <p role={error ? "alert" : "status"}>{error ?? "Checking operator access…"}</p>
      {error && <div className="mt-4 flex justify-center gap-4"><button type="button" className="font-medium text-primary" onClick={() => setRetry((key) => key + 1)}>Retry access check</button><Link href="/login" className="font-medium text-primary">Operator login</Link></div>}
    </div></main>;
  }
  return <OperatorContext.Provider value={identity}>{children}</OperatorContext.Provider>;
}
