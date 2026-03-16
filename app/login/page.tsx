export const dynamic = "force-dynamic";

import Link from "next/link";
import { cookies } from "next/headers";

const BRAND = "#FA0082";

type Lang = "en" | "es" | "pt";

function normalizeLang(value?: string | null): Lang {
  const raw = (value || "en").toLowerCase();
  if (raw.startsWith("es")) return "es";
  if (raw.startsWith("pt")) return "pt";
  return "en";
}

export default async function LoginPage() {
  const cookieStore = await cookies();
  const lang = normalizeLang(cookieStore.get("lang")?.value);

  const t = {
    en: {
      eyebrow: "Peekr",
      title: "Welcome back.",
      subtitle:
        "Sign in to continue tracking what you watch, rating titles, building Peeklists and following activity across Peekr.",
      email: "Email",
      password: "Password",
      signIn: "Sign in",
      forgotPassword: "Forgot password?",
      noAccount: "Don’t have an account?",
      createAccount: "Create account",
      terms:
        "By signing in, you agree to Peekr’s Terms and Privacy Policy.",
      comingSoon:
        "This screen is already designed. Next step is wiring it to Supabase Auth.",
      placeholderEmail: "you@example.com",
      placeholderPassword: "Enter your password",
    },
    es: {
      eyebrow: "Peekr",
      title: "Bienvenido de vuelta.",
      subtitle:
        "Inicia sesión para seguir registrando lo que ves, calificando títulos, creando Peeklists y siguiendo actividad dentro de Peekr.",
      email: "Email",
      password: "Contraseña",
      signIn: "Iniciar sesión",
      forgotPassword: "¿Olvidaste tu contraseña?",
      noAccount: "¿No tienes cuenta?",
      createAccount: "Crear cuenta",
      terms:
        "Al iniciar sesión, aceptas los Términos y la Política de Privacidad de Peekr.",
      comingSoon:
        "Esta pantalla ya está diseñada. El siguiente paso es conectarla con Supabase Auth.",
      placeholderEmail: "tu@email.com",
      placeholderPassword: "Ingresa tu contraseña",
    },
    pt: {
      eyebrow: "Peekr",
      title: "Bem-vindo de volta.",
      subtitle:
        "Entre para continuar registrando o que você assiste, avaliando títulos, criando Peeklists e seguindo atividade dentro do Peekr.",
      email: "Email",
      password: "Senha",
      signIn: "Entrar",
      forgotPassword: "Esqueceu sua senha?",
      noAccount: "Não tem uma conta?",
      createAccount: "Criar conta",
      terms:
        "Ao entrar, você concorda com os Termos e a Política de Privacidade do Peekr.",
      comingSoon:
        "Esta tela já está desenhada. O próximo passo é conectá-la ao Supabase Auth.",
      placeholderEmail: "voce@email.com",
      placeholderPassword: "Digite sua senha",
    },
  }[lang];

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

        .login-note {
          margin-top: 22px;
          padding: 14px 16px;
          border-radius: 16px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          color: rgba(255,255,255,0.84);
          font-size: 14px;
          line-height: 1.6;
          max-width: 620px;
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

        .login-terms {
          margin-top: 4px;
          color: rgba(255,255,255,0.58);
          font-size: 13px;
          line-height: 1.6;
        }

        .login-footer {
          margin-top: 12px;
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
          <div className="login-note">{t.comingSoon}</div>
        </section>

        <section className="login-card">
          <form className="login-form">
            <div className="field">
              <label htmlFor="email">{t.email}</label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder={t.placeholderEmail}
              />
            </div>

            <div className="field">
              <label htmlFor="password">{t.password}</label>
              <input
                id="password"
                name="password"
                type="password"
                placeholder={t.placeholderPassword}
              />
            </div>

            <div className="login-aux">
              <Link href="#">{t.forgotPassword}</Link>
            </div>

            <button type="button" className="login-button">
              {t.signIn}
            </button>

            <div className="login-terms">{t.terms}</div>

            <div className="login-footer">
              {t.noAccount} <Link href="/signup">{t.createAccount}</Link>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}
