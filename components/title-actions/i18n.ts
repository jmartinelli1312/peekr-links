// Strings for the title-action widgets (Watched button + Rate modal +
// Season selector). Mirrors the keys used by Flutter's AppTexts so the
// web and app stay aligned by feel.

export type Lang = "es" | "pt" | "en";

export function normalizeLang(value: string | undefined): Lang {
  const raw = (value ?? "es").toLowerCase();
  if (raw.startsWith("pt")) return "pt";
  if (raw.startsWith("en")) return "en";
  return "es";
}

export const TITLE_ACTION_TEXTS = {
  es: {
    markWatched: "Marcar visto",
    alreadyWatched: "Visto",
    signInToWatch: "Iniciá sesión para marcar como visto",
    rateThisTitle: "Calificá este título",
    slideToRate: "Deslizá para calificar",
    over10: "/ 10",
    newWatch: "Vista nueva",
    watchedBefore: "Vista anterior",
    newWatchHelp: "Aparecerá en el feed de tus seguidores",
    watchedBeforeHelp: "Solo actualiza tu historial, sin notificar",
    writeComment: "Escribí un comentario (opcional)",
    save: "Guardar",
    saving: "Guardando…",
    cancel: "Cancelar",
    selectSeasons: "Seleccionar temporadas",
    season: (n: number) => `Temporada ${n}`,
    confirm: "Confirmar",
    loading: "Cargando…",

    // Bookmark modal
    bookmark: "Guardar",
    bookmarked: "Guardado",
    saveTitle: "Guardar título",
    myWatchlist: "Mi Watchlist",
    myTop5: "Mi Top 5",
    myPeeklists: "Mis Peeklists",
    top5Full: "Tu Top 5 está lleno (5/5).",
    listName: "Nombre de la lista",
    create: "Crear",
    noListsYet: "No tenés listas aún. ¡Creá una!",
    signInToBookmark: "Iniciá sesión para guardar",

    // Premium waitlist
    premiumTitle: "Peekr Premium",
    premiumComingSoon: "Próximamente",
    premiumBenefitLists: "Listas ilimitadas",
    premiumBenefitPlatforms: "Más plataformas de streaming",
    premiumBenefitBadge: "Insignia Premium en tu perfil",
    premiumJoin: "Unirme a la lista de espera",
    premiumAlreadyJoined: "Ya estás en la lista",
    premiumJoinSuccess: "Te avisaremos cuando esté listo.",
  },
  pt: {
    markWatched: "Marcar como visto",
    alreadyWatched: "Visto",
    signInToWatch: "Faça login para marcar como visto",
    rateThisTitle: "Avalie este título",
    slideToRate: "Deslize para avaliar",
    over10: "/ 10",
    newWatch: "Nova vista",
    watchedBefore: "Vista anterior",
    newWatchHelp: "Aparecerá no feed dos seus seguidores",
    watchedBeforeHelp: "Apenas atualiza seu histórico, sem notificar",
    writeComment: "Escreva um comentário (opcional)",
    save: "Salvar",
    saving: "Salvando…",
    cancel: "Cancelar",
    selectSeasons: "Selecionar temporadas",
    season: (n: number) => `Temporada ${n}`,
    confirm: "Confirmar",
    loading: "Carregando…",

    bookmark: "Salvar",
    bookmarked: "Salvo",
    saveTitle: "Salvar título",
    myWatchlist: "Minha Watchlist",
    myTop5: "Meu Top 5",
    myPeeklists: "Minhas Peeklists",
    top5Full: "Seu Top 5 está cheio (5/5).",
    listName: "Nome da lista",
    create: "Criar",
    noListsYet: "Você ainda não tem listas. Crie uma!",
    signInToBookmark: "Faça login para salvar",

    premiumTitle: "Peekr Premium",
    premiumComingSoon: "Em breve",
    premiumBenefitLists: "Listas ilimitadas",
    premiumBenefitPlatforms: "Mais plataformas de streaming",
    premiumBenefitBadge: "Selo Premium no seu perfil",
    premiumJoin: "Entrar na lista de espera",
    premiumAlreadyJoined: "Você já está na lista",
    premiumJoinSuccess: "Avisaremos quando estiver pronto.",
  },
  en: {
    markWatched: "Mark as watched",
    alreadyWatched: "Watched",
    signInToWatch: "Sign in to mark as watched",
    rateThisTitle: "Rate this title",
    slideToRate: "Slide to rate",
    over10: "/ 10",
    newWatch: "New watch",
    watchedBefore: "Watched before",
    newWatchHelp: "Will appear in your followers' feed",
    watchedBeforeHelp: "Only updates your history, no notifications",
    writeComment: "Write a comment (optional)",
    save: "Save",
    saving: "Saving…",
    cancel: "Cancel",
    selectSeasons: "Select seasons",
    season: (n: number) => `Season ${n}`,
    confirm: "Confirm",
    loading: "Loading…",

    bookmark: "Save",
    bookmarked: "Saved",
    saveTitle: "Save title",
    myWatchlist: "My Watchlist",
    myTop5: "My Top 5",
    myPeeklists: "My Peeklists",
    top5Full: "Your Top 5 is full (5/5).",
    listName: "List name",
    create: "Create",
    noListsYet: "You don't have any lists yet. Create one!",
    signInToBookmark: "Sign in to save",

    premiumTitle: "Peekr Premium",
    premiumComingSoon: "Coming soon",
    premiumBenefitLists: "Unlimited lists",
    premiumBenefitPlatforms: "More streaming platforms",
    premiumBenefitBadge: "Premium badge on your profile",
    premiumJoin: "Join the waitlist",
    premiumAlreadyJoined: "You're on the list",
    premiumJoinSuccess: "We'll notify you when it's ready.",
  },
} as const;

export type ActionTexts = (typeof TITLE_ACTION_TEXTS)[Lang];
