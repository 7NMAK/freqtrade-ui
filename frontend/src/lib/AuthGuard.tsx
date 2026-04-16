"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "./api";

/**
 * Wraps pages that require authentication.
 * Redirects to /login if no token is found in localStorage.
 * Token expiry is handled server-side: when the JWT expires, the orchestrator
 * returns 401 on API calls and the request() function in api.ts redirects to /login.
 * We intentionally do NOT do client-side expiry checks here because they cause
 * false logouts when the client's system clock differs from the server's clock.
 */
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  return <>{children}</>;
}
