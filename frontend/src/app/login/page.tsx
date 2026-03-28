"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login, ApiError } from "@/lib/api";

// ── Validation ──────────────────────────────────────────────────────────

function validateUsername(v: string): string {
  if (!v.trim()) return "Username is required";
  if (v.length < 3) return "Username must be at least 3 characters";
  if (v.length > 32) return "Username must be 32 characters or fewer";
  if (!/^[a-zA-Z0-9_.-]+$/.test(v)) return "Only letters, numbers, underscores, hyphens and dots";
  return "";
}

function validatePassword(v: string): string {
  if (!v) return "Password is required";
  if (v.length < 6) return "Password must be at least 6 characters";
  return "";
}

// ── Page ─────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [usernameError, setUsernameError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError("");

    // Client-side validation
    const uErr = validateUsername(username);
    const pErr = validatePassword(password);
    setUsernameError(uErr);
    setPasswordError(pErr);
    if (uErr || pErr) return;

    setLoading(true);

    // Show info toast if taking >5s (slow connection)
    let slowTimer: ReturnType<typeof setTimeout> | null = null;
    if (typeof window !== "undefined") {
      slowTimer = setTimeout(() => {
        setFormError("Still connecting — this is taking longer than expected...");
      }, 5000);
    }

    try {
      await login(username, password);

      if (slowTimer) clearTimeout(slowTimer);

      router.push("/dashboard");
    } catch (err) {
      if (slowTimer) clearTimeout(slowTimer);

      if (err instanceof ApiError) {
        if (err.status === 401 || err.status === 403) {
          setFormError("Invalid username or password.");
        } else if (err.status === 0 || err.message.includes("fetch")) {
          setFormError("Cannot connect to server — is the orchestrator running?");
        } else {
          setFormError(err.message || "Login failed. Please try again.");
        }
      } else {
        setFormError("Connection failed — is the orchestrator running?");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg-0 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* L-1: Logo */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-gradient-to-br from-accent to-purple rounded-2xl flex items-center justify-center text-2xl font-bold text-white mx-auto mb-5 shadow-[0_0_32px_rgba(99,102,241,0.3)]">
            FT
          </div>
          <h1 className="text-xl font-bold text-text-0 mb-1">FreqTrade Platform</h1>
          <p className="text-sm text-text-3">Multi-Strategy Trading System</p>
        </div>

        {/* L-2: Form */}
        <form onSubmit={handleSubmit} className="bg-bg-2 border border-border rounded-card p-10" noValidate>

          {/* L-2a: Username */}
          <div className="mb-5">
            <label
              htmlFor="login-username"
              className="block text-xs text-text-3 font-medium uppercase tracking-wider mb-2"
            >
              Username
            </label>
            <input
              id="login-username"
              name="username"
              type="text"
              required
              autoComplete="username"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                if (usernameError) setUsernameError(validateUsername(e.target.value));
              }}
              onBlur={(e) => setUsernameError(validateUsername(e.target.value))}
              disabled={loading}
              className={`w-full bg-bg-1 border rounded-btn px-4 py-3 text-sm text-text-0 outline-none transition-colors disabled:opacity-50 ${
                usernameError
                  ? "border-red focus:border-red"
                  : "border-border focus:border-accent"
              }`}
              placeholder="Enter username"
            />
            {usernameError && (
              <p className="mt-1.5 text-xs text-red">{usernameError}</p>
            )}
          </div>

          {/* L-2b: Password + L-3: Toggle */}
          <div className="mb-5">
            <label
              htmlFor="login-password"
              className="block text-xs text-text-3 font-medium uppercase tracking-wider mb-2"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="login-password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (passwordError) setPasswordError(validatePassword(e.target.value));
                }}
                onBlur={(e) => setPasswordError(validatePassword(e.target.value))}
                disabled={loading}
                className={`w-full bg-bg-1 border rounded-btn px-4 py-3 pr-11 text-sm text-text-0 outline-none transition-colors disabled:opacity-50 ${
                  passwordError
                    ? "border-red focus:border-red"
                    : "border-border focus:border-accent"
                }`}
                placeholder="Enter password"
              />
              {/* L-3: Password visibility toggle */}
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-3 hover:text-text-1 transition-colors cursor-pointer select-none p-1"
                aria-label={showPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
            {passwordError && (
              <p className="mt-1.5 text-xs text-red">{passwordError}</p>
            )}
          </div>

          {/* Form-level error (auth failures, network) */}
          {formError && (
            <div className="mb-4 px-3.5 py-2.5 bg-red-bg border border-red/20 rounded-btn text-xs text-red font-medium">
              {formError}
            </div>
          )}

          {/* L-2c: Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent hover:bg-accent-dim text-white font-semibold py-3 rounded-btn text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Signing in...
              </span>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        <p className="text-center text-2xs text-text-3 mt-6">
          FreqTrade v2026.2 — Powered by FreqTrade
        </p>
      </div>
    </div>
  );
}
