import { cookies } from "next/headers";
import SignupForm from "./signup-form";

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
      fullName: "Full name",
      username: "Username",
      email: "Email",
      password: "Password",
      acceptedLegal: "I agree to the",
      terms: "Terms & Conditions",
      and: "and",
      privacy: "Privacy Policy",
      createAccount: "Create account",
      alreadyHaveAccount: "Already have an account?",
      signIn: "Sign in",
      enterFullName: "Enter your full name",
      usernameTooShort: "Username must be at least 3 characters",
      usernameTaken: "This username is already taken",
      enterValidEmail: "Enter a valid email",
      passwordMin: "Password must be at least 6 characters",
      signupError: "There was an error creating your account",
      legalRequired: "You must accept the Terms and Privacy Policy",
      placeholderFullName: "Your name",
      placeholderUsername: "yourusername",
      placeholderEmail: "you@example.com",
      placeholderPassword: "Create a password",
      checking: "Checking...",
      available: "Available",
      taken: "Taken",
    },
    es: {
      eyebrow: "Peekr",
      title: "Crea tu cuenta.",
      subtitle:
        "Únete a Peekr para registrar lo que ves, calificar títulos, crear Peeklists y seguir actividad real de películas y series.",
      fullName: "Nombre completo",
      username: "Usuario",
      email: "Email",
      password: "Contraseña",
      acceptedLegal: "Acepto los",
      terms: "Términos y Condiciones",
      and: "y la",
      privacy: "Política de Privacidad",
      createAccount: "Crear cuenta",
      alreadyHaveAccount: "¿Ya tienes cuenta?",
      signIn: "Iniciar sesión",
      enterFullName: "Ingresa tu nombre completo",
      usernameTooShort: "El usuario debe tener al menos 3 caracteres",
      usernameTaken: "Este usuario ya está ocupado",
      enterValidEmail: "Ingresa un email válido",
      passwordMin: "La contraseña debe tener al menos 6 caracteres",
      signupError: "Hubo un error creando tu cuenta",
      legalRequired: "Debes aceptar los Términos y la Política de Privacidad",
      placeholderFullName: "Tu nombre",
      placeholderUsername: "tuusuario",
      placeholderEmail: "tu@email.com",
      placeholderPassword: "Crea una contraseña",
      checking: "Revisando...",
      available: "Disponible",
      taken: "Ocupado",
    },
    pt: {
      eyebrow: "Peekr",
      title: "Crie sua conta.",
      subtitle:
        "Entre no Peekr para registrar o que você assiste, avaliar títulos, criar Peeklists e seguir atividade real de filmes e séries.",
      fullName: "Nome completo",
      username: "Usuário",
      email: "Email",
      password: "Senha",
      acceptedLegal: "Eu concordo com os",
      terms: "Termos e Condições",
      and: "e a",
      privacy: "Política de Privacidade",
      createAccount: "Criar conta",
      alreadyHaveAccount: "Já tem uma conta?",
      signIn: "Entrar",
      enterFullName: "Digite seu nome completo",
      usernameTooShort: "O usuário deve ter pelo menos 3 caracteres",
      usernameTaken: "Este usuário já está em uso",
      enterValidEmail: "Digite um email válido",
      passwordMin: "A senha deve ter pelo menos 6 caracteres",
      signupError: "Houve um erro ao criar sua conta",
      legalRequired: "Você deve aceitar os Termos e a Política de Privacidade",
      placeholderFullName: "Seu nome",
      placeholderUsername: "seuusuario",
      placeholderEmail: "voce@email.com",
      placeholderPassword: "Crie uma senha",
      checking: "Verificando...",
      available: "Disponível",
      taken: "Em uso",
    },
  }[lang];

  return <SignupForm lang={lang} t={t} />;
}
