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

export default async function SignupPage() {
  const cookieStore = await cookies();
  const lang = normalizeLang(cookieStore.get("lang")?.value);

  const t = {
    en: {
      eyebrow: "Peekr",
      title: "Create your account.",
      subtitle:
        "Join Peekr to track what you watch, rate titles, build Peeklists and follow real movie and series activity.",
      name: "Name",
      username: "Username",
      email: "Email",
      password: "Password",
      confirmPassword: "Confirm password",
      createAccount: "Create account",
      alreadyHave: "Already have an account?",
      signIn: "Sign in",
      terms:
        "By creating an account, you agree to Peekr’s Terms and Privacy Policy.",
      comingSoon:
        "This screen is already designed. Next step is wiring it to Supabase Auth.",
      placeholderName: "Your name",
      placeholderUsername: "yourusername",
      placeholderEmail: "you@example.com",
      placeholderPassword: "Create a password",
      placeholderConfirmPassword: "Repeat your password",
    },
    es: {
      eyebrow: "Peekr",
      title: "Crea tu cuenta.",
      subtitle:
        "Únete a Peekr para registrar lo que ves, calificar títulos, crear Peeklists y seguir actividad real de películas y series.",
      name: "Nombre",
      username: "Usuario",
      email: "Email",
      password: "Contraseña",
      confirmPassword: "Confirmar contraseña",
      createAccount: "Crear cuenta",
      alreadyHave: "¿Ya tienes cuenta?",
      signIn: "Iniciar sesión",
      terms:
        "Al crear una cuenta, aceptas los Términos y la Política de Privacidad de Peekr.",
      comingSoon:
        "Esta pantalla ya está diseñada. El siguiente paso es conectarla con Supabase Auth.",
      placeholderName: "Tu nombre",
      placeholderUsername: "tuusuario",
      placeholderEmail: "tu@email.com",
      placeholderPassword: "Crea una contraseña",
      placeholderConfirmPassword: "Repite tu contraseña",
    },
    pt: {
      eyebrow: "Peekr",
      title: "Crie sua conta.",
      subtitle:
        "Entre no Peekr para registrar o que você assiste, avaliar títulos, criar Peeklists e seguir atividade real de filmes e séries.",
      name: "Nome",
      username: "Usuário",
      email: "Email",
      password: "Senha",
      confirmPassword: "Confirmar senha",
      createAccount: "Criar conta",
      alreadyHave: "Já tem uma conta?",
      signIn: "Entrar",
      terms:
        "Ao criar uma conta, você concorda com os Termos e a Política de Privacidade do Peekr.",
      comingSoon:
        "Esta tela já está desenhada. O próximo passo é conectá-la ao Supabase Auth.",
      placeholderName: "Seu nome",
      placeholderUsername: "seuusuario",
      placeholderEmail: "voce@email.com",
      placeholderPassword: "Crie uma senha",
      placeholderConfirmPassword: "Repita sua senha",
    },
  }[lang];

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

        .signup-note {
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

        .signup-terms {
          margin-top: 4px;
          color: rgba(255,255,255,0.58);
          font-size: 13px;
          line-height: 1.6;
        }

        .signup-footer {
          margin-top: 12px;
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
          <div className="signup-note">{t.comingSoon}</div>
        </section>

        <section className="signup-card">
          <form className="signup-form">
            <div className="field">
              <label htmlFor="name">{t.name}</label>
              <input id="name" name="name" type="text" placeholder={t.placeholderName} />
            </div>

            <div className="field">
              <label htmlFor="username">{t.username}</label>
              <input
                id="username"
                name="username"
                type="text"
                placeholder={t.placeholderUsername}
              />
            </div>

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

            <div className="field">
              <label htmlFor="confirmPassword">{t.confirmPassword}</label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder={t.placeholderConfirmPassword}
              />
            </div>

            <button type="button" className="signup-button">
              {t.createAccount}
            </button>

            <div className="signup-terms">{t.terms}</div>

            <div className="signup-footer">
              {t.alreadyHave} <Link href="/login">{t.signIn}</Link>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}
