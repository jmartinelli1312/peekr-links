export const translations = {
  en: {
    explore: "Explore",
    search_placeholder: "Search movies, series, cast, crew or users",
    peeklists: "Peeklists",
    trending_movies: "Trending Movies",
    trending_tv: "Trending TV",
    top_movies: "Top Rated Movies",
    top_tv: "Top Rated TV",
    titles: "Titles",
    people: "Cast/Crew",
    users: "Users",
  },

  es: {
    explore: "Explorar",
    search_placeholder: "Buscar películas, series, actores o usuarios",
    peeklists: "Peeklists",
    trending_movies: "Películas Populares",
    trending_tv: "Series Populares",
    top_movies: "Mejores Películas",
    top_tv: "Mejores Series",
    titles: "Títulos",
    people: "Actores/Equipo",
    users: "Usuarios",
  },

  pt: {
    explore: "Explorar",
    search_placeholder: "Buscar filmes, séries, atores ou usuários",
    peeklists: "Peeklists",
    trending_movies: "Filmes em Alta",
    trending_tv: "Séries em Alta",
    top_movies: "Melhores Filmes",
    top_tv: "Melhores Séries",
    titles: "Títulos",
    people: "Elenco",
    users: "Usuários",
  },
};

export function getLang() {
  if (typeof navigator !== "undefined") {
    const lang = navigator.language;

    if (lang.startsWith("es")) return "es";
    if (lang.startsWith("pt")) return "pt";
  }

  return "en";
}
