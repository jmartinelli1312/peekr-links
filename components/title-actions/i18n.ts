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
  },
} as const;

export type ActionTexts = (typeof TITLE_ACTION_TEXTS)[Lang];
