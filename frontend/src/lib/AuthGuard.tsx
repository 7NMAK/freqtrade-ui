"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "./api";

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
    } else {
      setReady(true);
    }
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
