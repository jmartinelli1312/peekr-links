import { Metadata } from "next";
import { supabase } from "@/lib/supabase";
import UserProfileClient from "./user-profile-client";

export const revalidate = 86400;

const SITE = "https://www.peekr.app";

type Lang = "en" | "es" | "pt";

function normalizeLang(value?: string | null): Lang {
  const raw = (value || "en").toLowerCase();
  if (raw.startsWith("es")) return "es";
  if (raw.startsWith("pt")) return "pt";
  return "en";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; username: string }>;
}): Promise<Metadata> {
  const { lang: rawLang, username } = await params;
  const lang = normalizeLang(rawLang);

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name,bio,avatar_url")
    .eq("username", username)
    .maybeSingle();

  const displayName = profile?.display_name || `@${username}`;
  const description = profile?.bio || `${displayName} on Peekr`;

  return {
    title: `${displayName} | Peekr`,
    description,
    // User profiles are thin content from an SEO perspective (few words of
    // unique text). Noindex to focus crawl budget on title/actor/editorial
    // pages. Still follow links so user's peeklists/activity get discovered.
    robots: { index: false, follow: true },
    alternates: {
      canonical: `${SITE}/${lang}/u/${username}`,
    },
    openGraph: {
      title: `${displayName} | Peekr`,
      description,
      url: `${SITE}/${lang}/u/${username}`,
      siteName: "Peekr",
      type: "profile",
      images: profile?.avatar_url ? [{ url: profile.avatar_url }] : [],
    },
    twitter: {
      card: "summary",
      title: `${displayName} | Peekr`,
      description,
    },
  };
}

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ lang: string; username: string }>;
}) {
  const { lang: rawLang, username } = await params;
  const lang = normalizeLang(rawLang);

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
