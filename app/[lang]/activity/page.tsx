import ActivityClient from "./activity-client";

type Lang = "en" | "es" | "pt";

type PageProps = {
  params: Promise<{
    lang: string;
  }>;
};

function normalizeLang(value?: string | null): Lang {
  const raw = (value || "en").toLowerCase();
  if (raw.startsWith("es")) return "es";
  if (raw.startsWith("pt")) return "pt";
  return "en";
}

export default async function ActivityPage({ params }: PageProps) {
  const { lang: rawLang } = await params;
  const lang = normalizeLang(rawLang);

  const t = {
    en: {
      title: "Activity",
      subtitle:
        "See what the people you follow are watching, rating and creating on Peekr.",
      noSessionTitle: "Sign in to see your activity feed.",
      noSessionText:
        "Your Activity feed is personalized from the people you follow on Peekr.",
      createAccount: "Create account",
      signIn: "Sign in",
      noActivity: "No activity yet.",
      seen: "watched",
      titleSingle: "title",
      titlePlural: "titles",
      createdPeeklist: "created a Peeklist",
    },
    es: {
      title: "Actividad",
      subtitle:
        "Mira lo que las personas que sigues están viendo, calificando y creando en Peekr.",
      noSessionTitle: "Inicia sesión para ver tu feed de actividad.",
      noSessionText:
        "Tu feed de Actividad se personaliza con la gente que sigues en Peekr.",
      createAccount: "Crear cuenta",
      signIn: "Iniciar sesión",
      noActivity: "Todavía no hay actividad.",
      seen: "vio",
      titleSingle: "título",
      titlePlural: "títulos",
      createdPeeklist: "creó una Peeklist",
    },
    pt: {
      title: "Atividade",
      subtitle:
        "Veja o que as pessoas que você segue estão assistindo, avaliando e criando no Peekr.",
      noSessionTitle: "Entre para ver seu feed de atividade.",
      noSessionText:
        "Seu feed de Atividade é personalizado com base nas pessoas que você segue no Peekr.",
      createAccount: "Criar conta",
      signIn: "Entrar",
      noActivity: "Ainda não há atividade.",
      seen: "assistiu",
      titleSingle: "título",
      titlePlural: "títulos",
      createdPeeklist: "criou uma Peeklist",
    },
  }[lang];

  return <ActivityClient lang={lang} t={t} />;
}
