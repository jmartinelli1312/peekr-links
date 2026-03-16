import { cookies } from "next/headers";
import UserProfileClient from "./user-profile-client";

type Lang = "en" | "es" | "pt";

function normalizeLang(value?: string | null): Lang {
  const raw = (value || "en").toLowerCase();
  if (raw.startsWith("es")) return "es";
  if (raw.startsWith("pt")) return "pt";
  return "en";
}

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const cookieStore = await cookies();
  const lang = normalizeLang(cookieStore.get("lang")?.value);

  const t = {
    en: {
      userNotFound: "User not found",
      watched: "Watched",
      peeklists: "Peeklists",
      followers: "Followers",
      following: "Following",
      follow: "Follow",
      followingBtn: "Following",
      request: "Request",
      requested: "Requested",
      privateAccountMsg: "This account is private.",
      emptyWatched: "No watched titles yet.",
      emptyPeeklists: "No Peeklists yet.",
      creator: "Creator",
      settings: "Settings",
      openInApp: "Open in app",
    },
    es: {
      userNotFound: "Usuario no encontrado",
      watched: "Vistos",
      peeklists: "Peeklists",
      followers: "Seguidores",
      following: "Siguiendo",
      follow: "Seguir",
      followingBtn: "Siguiendo",
      request: "Solicitar",
      requested: "Solicitado",
      privateAccountMsg: "Esta cuenta es privada.",
      emptyWatched: "Todavía no hay títulos vistos.",
      emptyPeeklists: "Todavía no hay Peeklists.",
      creator: "Creador",
      settings: "Settings",
      openInApp: "Abrir en app",
    },
    pt: {
      userNotFound: "Usuário não encontrado",
      watched: "Assistidos",
      peeklists: "Peeklists",
      followers: "Seguidores",
      following: "Seguindo",
      follow: "Seguir",
      followingBtn: "Seguindo",
      request: "Solicitar",
      requested: "Solicitado",
      privateAccountMsg: "Esta conta é privada.",
      emptyWatched: "Ainda não há títulos assistidos.",
      emptyPeeklists: "Ainda não há Peeklists.",
      creator: "Criador",
      settings: "Settings",
      openInApp: "Abrir no app",
    },
  }[lang];

  return <UserProfileClient username={username} lang={lang} t={t} />;
}
