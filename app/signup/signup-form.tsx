"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const BRAND = "#FA0082";

type Lang = "en" | "es" | "pt";

type UsernameStatus = "idle" | "checking" | "available" | "taken";

type SignupTexts = {
  eyebrow: string;
  title: string;
  subtitle: string;
  fullName: string;
  username: string;
  email: string;
  password: string;
  acceptedLegal: string;
  terms: string;
  and: string;
  privacy: string;
  createAccount: string;
  alreadyHaveAccount: string;
  signIn: string;
  enterFullName: string;
  usernameTooShort: string;
  usernameTaken: string;
  enterValidEmail: string;
  passwordMin: string;
  signupError: string;
  legalRequired: string;
  placeholderFullName: string;
  placeholderUsername: string;
  placeholderEmail: string;
  placeholderPassword: string;
  checking: string;
  available: string;
  taken: string;
};

function cleanUsername(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9_.]/g, "");
}

export default function SignupForm({
  lang,
  t,
}: {
  lang: Lang;
  t: SignupTexts;
}) {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  const [error, setError] = useState("");

  const cleanedUsername = useMemo(() => cleanUsername(username), [username]);

  useEffect(() => {
    if (cleanedUsername.length < 3) {
      setUsernameStatus("idle");
      return;
    }

    const timer = setTimeout(async () => {
      setUsernameStatus("checking");

      try {
        const { data } = await supabase
          .from("profiles")
          .select("id")
          .eq("username", cleanedUsername)
          .maybeSingle();

        setUsernameStatus(data ? "taken" : "available");
      } catch {
        setUsernameStatus("idle");
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [cleanedUsername]);

  function validate() {
    if (fullName.trim().length < 2) {
      setError(t.enterFullName);
      return false;
    }

    if (cleanedUsername.length < 3) {
      setError(t.usernameTooShort);
      return false;
    }

    if (usernameStatus === "taken") {
      setError(t.usernameTaken);
      return false;
    }

    if (!email.includes("@")) {
      setError(t.enterValidEmail);
      return false;
    }

    if (password.length < 6) {
      setError(t.passwordMin);
      return false;
    }

    if (!acceptedLegal) {
      setError(t.legalRequired);
      return false;
    }

    if (usernameStatus !== "available") {
      return false;
    }

    setError("");
    return true;
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();

    if (loading) return;
    if (!validate()) return;

    setLoading(true);
    setError("");

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
        options: {
          data: {
            username: cleanedUsername,
            display_name: fullName.trim(),
            language: lang,
            accepted_terms_at: new Date().toISOString(),
            accepted_privacy_at: new Date().toISOString(),
          },
        },
      });

      if (error) throw error;
      if (!data.user) throw new Error("User not created");

      router.push("/follow-onboarding");
    } catch (err: any) {
      setError(err?.message || t.signupError);
    } finally {
      setLoading(false);
    }
  }

  const legalLang = lang === "en" ? "en" : lang === "pt" ? "pt" : "es";

  return (
    <>
      <style>{`
        .signup-page {
          min-height: calc(100vh - 160px);
          display: grid;
          grid-template-columns: 1fr;
          gap: 28px;
          align-items: stretch;
        }

        .signup-copy {
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .signup-eyebrow {
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

        .signup-copy h1 {
          margin: 0;
          font-size: clamp(40px, 9vw, 64px);
          line-height: 0.98;
          letter-spacing: -0.05em;
          font-weight: 900;
          color: white;
          max-width: 720px;
        }

        .signup-copy p {
          margin: 18px 0 0 0;
          max-width: 680px;
          color: rgba(255,255,255,0.74);
          font-size: 17px;
          line-height: 1.75;
        }

        .signup-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 24px;
          padding: 20px;
        }

        .signup-form {
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

        .field-wrap {
          position: relative;
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

        .username-status {
          margin-top: 6px;
          font-size: 13px;
          color: rgba(255,255,255,0.64);
        }

        .username-status.available {
          color: #4ade80;
        }

        .username-status.taken {
          color: #fb7185;
        }

        .legal-row {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          color: rgba(255,255,255,0.76);
          font-size: 14px;
          line-height: 1.6;
        }

        .legal-row input {
          margin-top: 3px;
        }

        .legal-row a {
          color: ${BRAND};
          text-decoration: none;
          font-weight: 700;
        }

        .signup-button {
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

        .signup-button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .signup-error {
          padding: 12px 14px;
          border-radius: 14px;
          background: rgba(255,70,70,0.12);
          border: 1px solid rgba(255,70,70,0.28);
          color: #fda4af;
          font-size: 14px;
          line-height: 1.5;
        }

        .signup-footer {
          margin-top: 6px;
          text-align: center;
          color: rgba(255,255,255,0.72);
          font-size: 14px;
        }

        .signup-footer a {
          color: white;
          text-decoration: none;
          font-weight: 700;
        }

        @media (min-width: 980px) {
          .signup-page {
            grid-template-columns: 1.05fr 0.95fr;
            gap: 42px;
          }

          .signup-card {
            padding: 28px;
          }
        }
      `}</style>

      <div className="signup-page">
        <section className="signup-copy">
          <div className="signup-eyebrow">{t.eyebrow}</div>
          <h1>{t.title}</h1>
          <p>{t.subtitle}</p>
        </section>

        <section className="signup-card">
          <form className="signup-form" onSubmit={handleSignup}>
            <div className="field">
              <label htmlFor="fullName">{t.fullName}</label>
              <div className="field-wrap">
                <input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={t.placeholderFullName}
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="username">{t.username}</label>
              <div className="field-wrap">
                <input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t.placeholderUsername}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </div>

              {cleanedUsername.length >= 3 ? (
                <div
                  className={`username-status ${
                    usernameStatus === "available"
                      ? "available"
                      : usernameStatus === "taken"
                      ? "taken"
                      : ""
                  }`}
                >
                  {usernameStatus === "checking" ? t.checking : null}
                  {usernameStatus === "available" ? t.available : null}
                  {usernameStatus === "taken" ? t.taken : null}
                </div>
              ) : null}
            </div>

            <div className="field">
              <label htmlFor="email">{t.email}</label>
              <div className="field-wrap">
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t.placeholderEmail}
                  autoCapitalize="none"
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="password">{t.password}</label>
              <div className="field-wrap">
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t.placeholderPassword}
                />
              </div>
            </div>

            <label className="legal-row">
              <input
                type="checkbox"
                checked={acceptedLegal}
                onChange={(e) => setAcceptedLegal(e.target.checked)}
              />
              <span>
                {t.acceptedLegal}{" "}
                <Link href={`/terms?lang=${legalLang}`}>{t.terms}</Link> {t.and}{" "}
                <Link href={`/privacy?lang=${legalLang}`}>{t.privacy}</Link>
              </span>
            </label>

            {error ? <div className="signup-error">{error}</div> : null}

            <button
              type="submit"
              className="signup-button"
              disabled={
                loading ||
                usernameStatus === "checking" ||
                usernameStatus === "taken"
              }
            >
              {loading ? "..." : t.createAccount}
            </button>

            <div className="signup-footer">
              {t.alreadyHaveAccount} <Link href="/login">{t.signIn}</Link>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}
