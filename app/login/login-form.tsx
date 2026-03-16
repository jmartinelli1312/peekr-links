"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const BRAND = "#FA0082";

type Lang = "en" | "es" | "pt";

type LoginTexts = {
  eyebrow: string;
  title: string;
  subtitle: string;
  email: string;
  password: string;
  signIn: string;
  forgotPassword: string;
  noAccount: string;
  createAccount: string;
  enterValidEmail: string;
  passwordMin: string;
  loginError: string;
  placeholderEmail: string;
  placeholderPassword: string;
};

export default function LoginForm({
  lang,
  t,
}: {
  lang: Lang;
  t: LoginTexts;
}) {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function validate() {
    if (!email.includes("@")) {
      setError(t.enterValidEmail);
      return false;
    }

    if (password.length < 6) {
      setError(t.passwordMin);
      return false;
    }

    setError("");
    return true;
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    if (loading) return;
    if (!validate()) return;

    setLoading(true);
    setError("");

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (error) throw error;

      router.push("/download-app");
      router.refresh();
    } catch (err: any) {
      setError(err?.message || t.loginError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style>{`
        .login-page {
          min-height: calc(100vh - 160px);
          display: grid;
          grid-template-columns: 1fr;
          gap: 28px;
          align-items: stretch;
        }

        .login-copy {
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .login-eyebrow {
          display: inline-flex;
          align-items: center;
          padding: 8px 12px;
          border-radius: 999px;
          background: rgba(250,0,130,0.12);
          color: ${BRAND};
          font-weight: 800;
          font-size: 13px;
          margin-bottom: 18px;
          width: fit-content;
        }

        .login-copy h1 {
          margin: 0;
          font-size: clamp(40px, 9vw, 64px);
          line-height: 0.98;
          letter-spacing: -0.05em;
          font-weight: 900;
          color: white;
          max-width: 720px;
        }

        .login-copy p {
          margin: 18px 0 0 0;
          max-width: 680px;
          color: rgba(255,255,255,0.74);
          font-size: 17px;
          line-height: 1.75;
        }

        .login-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 24px;
          padding: 20px;
        }

        .login-form {
          display: grid;
          gap: 16px;
        }

        .field {
          display: grid;
          gap: 8px;
        }

        .field label {
          font-size: 14px;
          font-weight: 700;
          color: rgba(255,255,255,0.9);
        }

        .field input {
          width: 100%;
          box-sizing: border-box;
          padding: 15px 16px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.06);
          color: white;
          font-size: 15px;
          outline: none;
        }

        .field input::placeholder {
          color: rgba(255,255,255,0.42);
        }

        .login-aux {
          display: flex;
          justify-content: flex-end;
          margin-top: -4px;
        }

        .login-aux a {
          color: rgba(255,255,255,0.76);
          text-decoration: none;
          font-size: 13px;
          font-weight: 600;
        }

        .login-button {
          margin-top: 6px;
          width: 100%;
          border: none;
          background: ${BRAND};
          color: white;
          border-radius: 16px;
          padding: 15px 18px;
          font-weight: 800;
          font-size: 15px;
          cursor: pointer;
        }

        .login-button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .login-error {
          padding: 12px 14px;
          border-radius: 14px;
          background: rgba(255,70,70,0.12);
          border: 1px solid rgba(255,70,70,0.28);
          color: #fda4af;
          font-size: 14px;
          line-height: 1.5;
        }

        .login-footer {
          margin-top: 6px;
          text-align: center;
          color: rgba(255,255,255,0.72);
          font-size: 14px;
        }

        .login-footer a {
          color: white;
          text-decoration: none;
          font-weight: 700;
        }

        @media (min-width: 980px) {
          .login-page {
            grid-template-columns: 1.05fr 0.95fr;
            gap: 42px;
          }

          .login-card {
            padding: 28px;
          }
        }
      `}</style>

      <div className="login-page">
        <section className="login-copy">
          <div className="login-eyebrow">{t.eyebrow}</div>
          <h1>{t.title}</h1>
          <p>{t.subtitle}</p>
        </section>

        <section className="login-card">
          <form className="login-form" onSubmit={handleLogin}>
            <div className="field">
              <label htmlFor="email">{t.email}</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.placeholderEmail}
                autoCapitalize="none"
              />
            </div>

            <div className="field">
              <label htmlFor="password">{t.password}</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t.placeholderPassword}
              />
            </div>

            <div className="login-aux">
              <Link href="#">{t.forgotPassword}</Link>
            </div>

            {error ? <div className="login-error">{error}</div> : null}

            <button type="submit" className="login-button" disabled={loading}>
              {loading ? "..." : t.signIn}
            </button>

            <div className="login-footer">
              {t.noAccount} <Link href="/signup">{t.createAccount}</Link>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}
