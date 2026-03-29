"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken, isTokenExpiringSoon, setToken } from "./api";

/**
 * Wraps pages that require authentication.
 * Redirects to /login if no token is found.
 */
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    if (isTokenExpiringSoon()) {
      setToken(null);
      router.replace("/login?expired=1");
      return;
    }
    setReady(true);

    // Periodic check: redirect if token expires while page is open
    const interval = setInterval(() => {
      if (isTokenExpiringSoon()) {
        setToken(null);
        router.replace("/login?expired=1");
      }
    }, 60_000);
    return () => clearInterval(interval);
  }, [router]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-bg-0 flex items-center justify-center">
        <div className="text-text-3 text-sm">Loading...</div>
      </div>
    );
  }

  return <>{children}</>;
}
