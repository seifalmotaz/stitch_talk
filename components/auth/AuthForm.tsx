"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/brand/Logo";

type Mode = "login" | "signup";

type AuthFormProps = {
  mode: Mode;
};

/**
 * Shared login / signup form — few fields, one primary action.
 * Mock only: any valid-looking submit routes to the dashboard.
 */
export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSignup = mode === "signup";

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    const password = String(fd.get("password") ?? "");

    if (!email || !email.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setError("Password needs at least 6 characters.");
      return;
    }
    if (isSignup) {
      const name = String(fd.get("name") ?? "").trim();
      if (!name) {
        setError("What should we call you?");
        return;
      }
    }

    setPending(true);
    // Mock auth delay — then enter the product.
    window.setTimeout(() => {
      router.push("/dashboard");
    }, 450);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <Logo href="/" />
        </div>

        <h1 className="auth-title">
          {isSignup ? "Create your studio" : "Welcome back"}
        </h1>
        <p className="auth-lead">
          {isSignup
            ? "Start a free workspace. No card required."
            : "Sign in to continue your design threads."}
        </p>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {isSignup && (
            <label className="field">
              <span className="field-label">Name</span>
              <input
                className="field-input"
                name="name"
                type="text"
                autoComplete="name"
                placeholder="Alex Rivera"
                disabled={pending}
              />
            </label>
          )}

          <label className="field">
            <span className="field-label">Email</span>
            <input
              className="field-input"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@studio.co"
              disabled={pending}
              required
            />
          </label>

          <label className="field">
            <span className="field-label">Password</span>
            <input
              className="field-input"
              name="password"
              type="password"
              autoComplete={isSignup ? "new-password" : "current-password"}
              placeholder="••••••••"
              disabled={pending}
              required
              minLength={6}
            />
          </label>

          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="btn btn-thread auth-submit"
            disabled={pending}
          >
            {pending
              ? "Opening studio…"
              : isSignup
                ? "Create account"
                : "Sign in"}
          </button>
        </form>

        <p className="auth-switch">
          {isSignup ? (
            <>
              Already have an account?{" "}
              <Link href="/login">Sign in</Link>
            </>
          ) : (
            <>
              New here? <Link href="/signup">Create an account</Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
