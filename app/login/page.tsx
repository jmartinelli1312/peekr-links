import { cookies } from "next/headers";
import LoginForm from "./login-form";

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
      enterValidEmail: "Enter a valid email",
      passwordMin: "Password must be at least 6 characters",
      loginError: "There was an error signing you in",
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
      enterValidEmail: "Ingresa un email válido",
      passwordMin: "La contraseña debe tener al menos 6 caracteres",
      loginError: "Hubo un error iniciando sesión",
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
      enterValidEmail: "Digite um email válido",
      passwordMin: "A senha deve ter pelo menos 6 caracteres",
      loginError: "Houve um erro ao entrar",
      placeholderEmail: "voce@email.com",
      placeholderPassword: "Digite sua senha",
    },
  }[lang];

  return <LoginForm lang={lang} t={t} />;
}
