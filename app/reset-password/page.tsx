"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const BRAND = "#FA0082";

// Lands here from the Supabase Auth recovery email. The link looks like
//   https://www.peekr.app/reset-password#access_token=...&type=recovery
// The Supabase JS SDK auto-detects the hash fragment, exchanges it for a
// temporary session, and emits a PASSWORD_RECOVERY auth event. After that
// `supabase.auth.updateUser({ password })` succeeds.
//
// IMPORTANT (Supabase Dashboard config):
//   Authentication → URL Configuration → Site URL = https://www.peekr.app
//   Redirect URLs must include https://www.peekr.app/reset-password
// Without those, the email link 302s to a default Supabase URL and the
// fragment is lost.

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Wait for either the SDK to surface the recovery session OR for an
    // existing session that the user might already have. The SDK fires
    // an auth event once it parses the hash fragment from the URL.
    let mounted = true;
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      } else if (event === "SIGNED_IN" && session) {
        setReady(true);
      }
    });
    // Fallback: if the SDK already had a session when this mounts.
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (mounted && session) setReady(true);
    })();
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { error: e2 } = await supabase.auth.updateUser({ password });
      if (e2) throw e2;
      setDone(true);
      setTimeout(() => router.replace("/login"), 2400);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <div className="card">
        <h1>Set a new password</h1>
        <p className="sub">
          Choose a new password for your Peekr account.
        </p>

        {done ? (
          <div className="ok">
            ✓ Password updated. Redirecting to sign in…
          </div>
        ) : !ready ? (
          <div className="muted">
            Waiting for recovery link… If this page stays here, the email
            link may have expired. Go back and request a new one.
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <label className="lbl">
              New password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                autoComplete="new-password"
                required
                minLength={6}
              />
            </label>
            <label className="lbl">
              Confirm new password
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Type it again"
                autoComplete="new-password"
                required
                minLength={6}
              />
            </label>
            {error && <div className="error">{error}</div>}
            <button
              type="submit"
              disabled={loading || !password || !confirm}
            >
              {loading ? "Saving…" : "Update password"}
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
        .muted {
          color: #fff8;
          font-size: 14px;
          line-height: 1.55;
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
