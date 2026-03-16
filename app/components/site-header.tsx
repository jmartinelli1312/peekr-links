"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Lang = "en" | "es" | "pt";

type Profile = {
  username: string | null;
  avatar_url: string | null;
  display_name: string | null;
};

type HeaderTexts = {
  explore: string;
  lists: string;
  activity: string;
  peekrbuzz: string;
  signIn: string;
  createAccount: string;
  settings: string;
  signOut: string;
  profile: string;
};

function normalizeLang(value?: string | null): Lang {
  const raw = (value || "en").toLowerCase();
  if (raw.startsWith("es")) return "es";
  if (raw.startsWith("pt")) return "pt";
  return "en";
}

export default function SiteHeader({ lang }: { lang: Lang }) {
  const router = useRouter();

  const [currentLang, setCurrentLang] = useState<Lang>(normalizeLang(lang));
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const t: HeaderTexts = {
    en: {
      explore: "Explore",
      lists: "Lists",
      activity: "Activity",
      peekrbuzz: "PeekrBuzz",
      signIn: "Sign in",
      createAccount: "Create account",
      settings: "Settings",
      signOut: "Sign out",
      profile: "Profile",
    },
    es: {
      explore: "Explorar",
      lists: "Listas",
      activity: "Actividad",
      peekrbuzz: "PeekrBuzz",
      signIn: "Iniciar sesión",
      createAccount: "Crear cuenta",
      settings: "Settings",
      signOut: "Cerrar sesión",
      profile: "Perfil",
    },
    pt: {
      explore: "Explorar",
      lists: "Listas",
      activity: "Atividade",
      peekrbuzz: "PeekrBuzz",
      signIn: "Entrar",
      createAccount: "Criar conta",
      settings: "Settings",
      signOut: "Sair",
      profile: "Perfil",
    },
  }[currentLang];

  async function loadSessionAndProfile() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        setIsLoggedIn(false);
        setProfile(null);
        setLoadingAuth(false);
        return;
      }

      setIsLoggedIn(true);

      const { data } = await supabase
        .from("profiles")
        .select("username,avatar_url,display_name")
        .eq("id", session.user.id)
        .maybeSingle();

      setProfile((data as Profile | null) ?? null);
    } catch {
      setIsLoggedIn(false);
      setProfile(null);
    } finally {
      setLoadingAuth(false);
    }
  }

  useEffect(() => {
    loadSessionAndProfile();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadSessionAndProfile();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);

    try {
      await supabase.auth.signOut();
      setIsLoggedIn(false);
      setProfile(null);
      router.push("/");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  const profileHref =
    profile?.username && profile.username.length > 0
      ? `/user/${profile.username}`
      : "/download-app";

  return (
    <>
      <style>{`
        .peekr-header {
          position: sticky;
          top: 0;
          z-index: 1000;
          background: #0B0B0F;
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }

        .peekr-header-inner {
          max-width: 1200px;
          margin: 0 auto;
          padding: 14px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        .peekr-logo {
          font-size: 22px;
          font-weight: 800;
          color: #FA0082;
          text-decoration: none;
          flex-shrink: 0;
        }

        .peekr-nav-desktop {
          display: none;
          align-items: center;
          gap: 24px;
        }

        .peekr-actions-desktop {
          display: none;
          align-items: center;
          gap: 14px;
        }

        .peekr-link {
          color: white;
          text-decoration: none;
          font-size: 15px;
          opacity: 0.9;
          white-space: nowrap;
        }

        .peekr-pill {
          background: #FA0082;
          padding: 10px 14px;
          border-radius: 12px;
          font-weight: 700;
          color: white;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: none;
          cursor: pointer;
          font-size: 14px;
        }

        .peekr-secondary-pill {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.10);
          padding: 10px 14px;
          border-radius: 12px;
          font-weight: 700;
          color: white;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          cursor: pointer;
        }

        .peekr-lang {
          position: relative;
        }

        .peekr-lang summary,
        .peekr-menu summary,
        .peekr-user summary {
          list-style: none;
          cursor: pointer;
        }

        .peekr-lang summary::-webkit-details-marker,
        .peekr-menu summary::-webkit-details-marker,
        .peekr-user summary::-webkit-details-marker {
          display: none;
        }

        .peekr-lang-menu,
        .peekr-user-menu {
          position: absolute;
          right: 0;
          top: 40px;
          min-width: 180px;
          background: #111;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 16px 40px rgba(0,0,0,0.35);
        }

        .peekr-lang-item,
        .peekr-user-item {
          display: block;
          padding: 11px 13px;
          text-decoration: none;
          color: white;
          font-size: 14px;
          background: transparent;
          border: none;
          width: 100%;
          text-align: left;
          cursor: pointer;
        }

        .peekr-lang-item:hover,
        .peekr-user-item:hover {
          background: rgba(255,255,255,0.06);
        }

        .peekr-mobile-right {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-left: auto;
        }

        .peekr-menu {
          position: relative;
        }

        .peekr-menu-button {
          width: 42px;
          height: 42px;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.04);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .peekr-menu-icon {
          width: 18px;
          height: 12px;
          position: relative;
          display: block;
        }

        .peekr-menu-icon::before,
        .peekr-menu-icon::after,
        .peekr-menu-icon span {
          content: "";
          position: absolute;
          left: 0;
          width: 18px;
          height: 2px;
          background: white;
          border-radius: 999px;
        }

        .peekr-menu-icon::before {
          top: 0;
        }

        .peekr-menu-icon span {
          top: 5px;
        }

        .peekr-menu-icon::after {
          top: 10px;
        }

        .peekr-mobile-panel {
          position: absolute;
          right: 0;
          top: 50px;
          width: min(300px, calc(100vw - 32px));
          background: #111;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 14px;
          padding: 10px;
          box-shadow: 0 18px 44px rgba(0,0,0,0.38);
        }

        .peekr-mobile-item {
          display: block;
          padding: 12px 10px;
          color: white;
          text-decoration: none;
          border-radius: 10px;
          font-size: 15px;
        }

        .peekr-mobile-item:hover {
          background: rgba(255,255,255,0.06);
        }

        .peekr-mobile-divider {
          height: 1px;
          background: rgba(255,255,255,0.08);
          margin: 8px 0;
        }

        .peekr-avatar-button {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 6px 8px;
          border-radius: 999px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
        }

        .peekr-avatar,
        .peekr-avatar-fallback {
          width: 34px;
          height: 34px;
          border-radius: 999px;
          object-fit: cover;
          background: rgba(255,255,255,0.08);
          display: block;
          flex-shrink: 0;
        }

        .peekr-avatar-name {
          font-size: 14px;
          font-weight: 700;
          color: white;
          max-width: 120px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        @media (min-width: 900px) {
          .peekr-header-inner {
            padding: 14px 28px;
          }

          .peekr-nav-desktop {
            display: flex;
          }

          .peekr-actions-desktop {
            display: flex;
          }

          .peekr-mobile-right {
            display: none;
          }
        }
      `}</style>

      <header className="peekr-header">
        <div className="peekr-header-inner">
          <Link href="/" className="peekr-logo">
            Peekr
          </Link>

          <nav className="peekr-nav-desktop">
            <Link href="/explore" className="peekr-link">
              {t.explore}
            </Link>
            <Link href="/lists" className="peekr-link">
              {t.lists}
            </Link>
            <Link href="/activity" className="peekr-link">
              {t.activity}
            </Link>
            <Link href="/peekrbuzz" className="peekr-link">
              {t.peekrbuzz}
            </Link>
          </nav>

          <div className="peekr-actions-desktop">
            <details className="peekr-lang">
              <summary style={{ cursor: "pointer", fontSize: 18 }}>🌍</summary>
              <div className="peekr-lang-menu">
                <a href="/lang/en" className="peekr-lang-item">
                  🇺🇸 English
                </a>
                <a href="/lang/es" className="peekr-lang-item">
                  🇪🇸 Español
                </a>
                <a href="/lang/pt" className="peekr-lang-item">
                  🇧🇷 Português
                </a>
              </div>
            </details>

            {loadingAuth ? null : isLoggedIn ? (
              <>
                <Link href="/download-app" className="peekr-secondary-pill">
                  {t.settings}
                </Link>

                <details className="peekr-user">
                  <summary className="peekr-avatar-button">
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={profile?.username || "user"}
                        className="peekr-avatar"
                      />
                    ) : (
                      <div className="peekr-avatar-fallback" />
                    )}

                    <span className="peekr-avatar-name">
                      {profile?.display_name || profile?.username || "User"}
                    </span>
                  </summary>

                  <div className="peekr-user-menu">
                    <Link href={profileHref} className="peekr-user-item">
                      {t.profile}
                    </Link>
                    <Link href="/download-app" className="peekr-user-item">
                      {t.settings}
                    </Link>
                    <button
                      type="button"
                      className="peekr-user-item"
                      onClick={handleSignOut}
                    >
                      {signingOut ? "..." : t.signOut}
                    </button>
                  </div>
                </details>
              </>
            ) : (
              <>
                <Link href="/login" className="peekr-link">
                  {t.signIn}
                </Link>

                <Link href="/signup" className="peekr-pill">
                  {t.createAccount}
                </Link>
              </>
            )}
          </div>

          <div className="peekr-mobile-right">
            <details className="peekr-lang">
              <summary style={{ cursor: "pointer", fontSize: 18 }}>🌍</summary>
              <div className="peekr-lang-menu">
                <a href="/lang/en" className="peekr-lang-item">
                  🇺🇸 English
                </a>
                <a href="/lang/es" className="peekr-lang-item">
                  🇪🇸 Español
                </a>
                <a href="/lang/pt" className="peekr-lang-item">
                  🇧🇷 Português
                </a>
              </div>
            </details>

            <details className="peekr-menu">
              <summary className="peekr-menu-button">
                <span className="peekr-menu-icon">
                  <span />
                </span>
              </summary>

              <div className="peekr-mobile-panel">
                <Link href="/explore" className="peekr-mobile-item">
                  {t.explore}
                </Link>
                <Link href="/lists" className="peekr-mobile-item">
                  {t.lists}
                </Link>
                <Link href="/activity" className="peekr-mobile-item">
                  {t.activity}
                </Link>
                <Link href="/peekrbuzz" className="peekr-mobile-item">
                  {t.peekrbuzz}
                </Link>

                <div className="peekr-mobile-divider" />

                {loadingAuth ? null : isLoggedIn ? (
                  <>
                    <Link href={profileHref} className="peekr-mobile-item">
                      {t.profile}
                    </Link>
                    <Link href="/download-app" className="peekr-mobile-item">
                      {t.settings}
                    </Link>
                    <button
                      type="button"
                      className="peekr-user-item"
                      onClick={handleSignOut}
                    >
                      {signingOut ? "..." : t.signOut}
                    </button>
                  </>
                ) : (
                  <>
                    <Link href="/login" className="peekr-mobile-item">
                      {t.signIn}
                    </Link>
                    <Link href="/signup" className="peekr-mobile-item">
                      {t.createAccount}
                    </Link>
                  </>
                )}
              </div>
            </details>
          </div>
        </div>
      </header>
    </>
  );
}
