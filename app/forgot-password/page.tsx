"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const BRAND = "#FA0082";

// Standalone (no /[lang] prefix) — same convention as /login and /signup.
// Triggers Supabase Auth's password-recovery email. The link inside the
// email points to /reset-password where the user picks a new password.

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Enter a valid email");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      const { error: e2 } = await supabase.auth.resetPasswordForEmail(
        trimmed,
        {
          redirectTo: `${origin}/reset-password`,
        }
      );
      if (e2) throw e2;
      setSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <div className="card">
        <h1>Forgot your password?</h1>
        <p className="sub">
          We&apos;ll email you a link to pick a new password.
        </p>

        {sent ? (
          <div className="ok">
            ✓ If an account exists for <strong>{email}</strong>, you&apos;ll
            receive an email with a reset link in a couple of minutes.
            Check spam.
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <label className="lbl">
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </label>
            {error && <div className="error">{error}</div>}
            <button type="submit" disabled={loading || !email.trim()}>
              {loading ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}

        <div className="footer">
          <Link href="/login">← Back to sign in</Link>
        </div>
      </div>

      <style jsx>{`
        .page {
          min-height: 100vh;
          background: #08080d;
          color: #fff;
          display: grid;
          place-items: center;
          padding: 24px;
        }
        .card {
          width: 100%;
          max-width: 420px;
          background: #11121a;
          border: 1px solid #ffffff14;
          border-radius: 16px;
          padding: 28px;
        }
        h1 {
          margin: 0 0 6px;
          font-size: 24px;
          font-weight: 900;
        }
        .sub {
          margin: 0 0 22px;
          color: #fff9;
          font-size: 14px;
          line-height: 1.45;
        }
        .ok {
          background: #06321e;
          border: 1px solid #14b85f;
          color: #b6f5d2;
          padding: 14px;
          border-radius: 10px;
          font-size: 14px;
          line-height: 1.5;
        }
        form {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .lbl {
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 12px;
          color: #fffa;
          font-weight: 600;
        }
        input {
          background: #0a0a10;
          border: 1px solid #ffffff22;
          border-radius: 10px;
          color: #fff;
          padding: 12px 14px;
          font-size: 15px;
          font-family: inherit;
        }
        input:focus {
          outline: none;
          border-color: ${BRAND};
        }
        button {
          background: ${BRAND};
          color: #fff;
          border: 0;
          border-radius: 12px;
          padding: 12px 18px;
          font-weight: 800;
          cursor: pointer;
          font-size: 14px;
        }
        button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .error {
          color: #ff8fa3;
          font-size: 13px;
        }
        .footer {
          margin-top: 22px;
          text-align: center;
        }
        .footer :global(a) {
          color: ${BRAND};
          text-decoration: none;
          font-size: 13px;
          font-weight: 700;
        }
      `}</style>
    </main>
  );
}
