// Peekr Newsletter — May 2026 wrap-up.
// Renders the data we'll DM to all users (2,675 incl. 253 churn risk).
// Server component: fetches leaderboard + top series + top movies from
// Supabase at request time. Brand-styled so Jorge can preview the final
// look in his browser before we hit "Send to all" via peekr_oficial DM.
import { supabase } from "@/lib/supabase";

// Force dynamic rendering — leaderboard / most-watched are live data.
// Without this, Next.js may try to statically generate at build time
// (when scores would be empty / stale).
export const dynamic = "force-dynamic";
export const revalidate = 0;

const BRAND = "#FA0082";
const BG = "#0B0B0F";
const CARD = "#15151B";
const BORDER = "rgba(255,255,255,0.08)";
const SUBTLE = "rgba(255,255,255,0.55)";
const SITE = "https://www.peekr.app";
const TMDB_IMG = "https://image.tmdb.org/t/p/w342";

// ─── Types matching our RPCs / queries ───────────────────────────────
type LeaderRow = {
  rank: number;
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  is_verified: boolean;
  score: number;
  current_streak_weeks: number | null;
};

type WatchedRow = {
  tmdb_id: number;
  media_type: "tv" | "movie";
  title: string;
  poster_path: string | null;
  avg_rating: string | number | null;
};

// ─── Data loaders ────────────────────────────────────────────────────
async function loadLeaderboard(): Promise<LeaderRow[]> {
  const { data, error } = await supabase.rpc("get_monthly_leaderboard_at", {
    p_month_start: "2026-05-01T00:00:00Z",
    p_scope: "global",
    p_limit: 10,
  });
  if (error) {
    console.error("[newsletter] leaderboard error:", error);
    return [];
  }
  return (data ?? []) as LeaderRow[];
}

async function loadTopByMediaType(
  mediaType: "tv" | "movie",
  limit = 6,
): Promise<WatchedRow[]> {
  // Direct query — there's no RPC for this. Anon role has SELECT on these
  // tables via the public read policies we already have for the feed.
  // Aggregation done in PostgREST via RPC-like view would be cleaner;
  // for now we do it inline in two steps.
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const { data, error } = await supabase
    .from("user_title_activities")
    .select("tmdb_id, media_type, title, poster_path, rating")
    .gte("watched_at", since)
    .eq("media_type", mediaType);
  if (error || !data) {
    console.error("[newsletter] top", mediaType, "error:", error);
    return [];
  }
  // Aggregate client-side: count + avg rating per (tmdb_id, media_type).
  const byKey = new Map<
    string,
    {
      tmdb_id: number;
      media_type: "tv" | "movie";
      title: string | null;
      poster_path: string | null;
      count: number;
      rating_sum: number;
      rating_n: number;
    }
  >();
  for (const r of data as Array<{
    tmdb_id: number;
    media_type: "tv" | "movie";
    title: string | null;
    poster_path: string | null;
    rating: number | null;
  }>) {
    const key = `${r.tmdb_id}:${r.media_type}`;
    const e = byKey.get(key) ?? {
      tmdb_id: r.tmdb_id,
      media_type: r.media_type,
      title: r.title,
      poster_path: r.poster_path,
      count: 0,
      rating_sum: 0,
      rating_n: 0,
    };
    e.count += 1;
    if (r.rating && r.rating > 0) {
      e.rating_sum += r.rating;
      e.rating_n += 1;
    }
    if (!e.title && r.title) e.title = r.title;
    if (!e.poster_path && r.poster_path) e.poster_path = r.poster_path;
    byKey.set(key, e);
  }
  const ranked = Array.from(byKey.values())
    .filter((e) => e.title && e.poster_path)
    .sort((a, b) => b.count - a.count || b.rating_n - a.rating_n)
    .slice(0, limit)
    .map<WatchedRow>((e) => ({
      tmdb_id: e.tmdb_id,
      media_type: e.media_type,
      title: e.title!,
      poster_path: e.poster_path,
      avg_rating: e.rating_n > 0 ? (e.rating_sum / e.rating_n).toFixed(1) : null,
    }));
  return ranked;
}

// ─── UI primitives ───────────────────────────────────────────────────
function Section({
  emoji,
  title,
  subtitle,
  children,
}: {
  emoji: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginTop: 48 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span style={{ fontSize: 24 }}>{emoji}</span>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: "white" }}>
          {title}
        </h2>
      </div>
      {subtitle && (
        <p
          style={{
            color: SUBTLE,
            fontSize: 14,
            marginTop: 6,
            marginBottom: 18,
          }}
        >
          {subtitle}
        </p>
      )}
      {children}
    </section>
  );
}

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: string;
  title: string;
  body: string;
}) {
  return (
    <div
      style={{
        background: CARD,
        border: `1px solid ${BORDER}`,
        borderRadius: 14,
        padding: 18,
        display: "flex",
        gap: 14,
        alignItems: "flex-start",
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          minWidth: 40,
          borderRadius: 999,
          background: "rgba(250,0,130,0.16)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 20,
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ fontWeight: 700, color: "white", marginBottom: 4 }}>
          {title}
        </div>
        <div style={{ color: SUBTLE, fontSize: 14, lineHeight: 1.45 }}>
          {body}
        </div>
      </div>
    </div>
  );
}

function LeaderboardRow({ row }: { row: LeaderRow }) {
  const medal =
    row.rank === 1 ? "🥇" : row.rank === 2 ? "🥈" : row.rank === 3 ? "🥉" : null;
  return (
    <a
      href={`${SITE}/${row.username}`}
      style={{ textDecoration: "none" }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "12px 14px",
          background: CARD,
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          marginBottom: 8,
        }}
      >
        <div
          style={{
            width: 36,
            minWidth: 36,
            textAlign: "center",
            fontSize: medal ? 22 : 14,
            fontWeight: 700,
            color: medal ? undefined : SUBTLE,
          }}
        >
          {medal ?? row.rank}
        </div>
        <div
          style={{
            width: 40,
            height: 40,
            minWidth: 40,
            borderRadius: 999,
            background: BRAND,
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontWeight: 700,
          }}
        >
          {row.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={row.avatar_url}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            (row.username?.[0] ?? "?").toUpperCase()
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: "white", fontWeight: 700, fontSize: 15 }}>
            @{row.username}{" "}
            {row.is_verified && (
              <span style={{ color: BRAND, fontSize: 13 }}>✓</span>
            )}
          </div>
          {row.display_name && (
            <div style={{ color: SUBTLE, fontSize: 12 }}>
              {row.display_name}
            </div>
          )}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: "white", fontWeight: 800, fontSize: 16 }}>
            {row.score} pts
          </div>
          {row.current_streak_weeks && row.current_streak_weeks > 1 && (
            <div style={{ color: SUBTLE, fontSize: 12 }}>
              🔥 {row.current_streak_weeks} sem
            </div>
          )}
        </div>
      </div>
    </a>
  );
}

function PosterTile({ item }: { item: WatchedRow }) {
  // Universal link — opens the iOS/Android app via deep-link associations
  // when installed, falls back to the web title page when not. The web
  // page has install banners (apple-itunes-app / Google Play smart banner)
  // so the user is still routed to install.
  const href = `${SITE}/es/title/${item.media_type}/${item.tmdb_id}`;
  return (
    <a
      href={href}
      style={{
        textDecoration: "none",
        display: "block",
      }}
    >
      <div style={{ position: "relative" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${TMDB_IMG}${item.poster_path}`}
          alt={item.title}
          style={{
            width: "100%",
            aspectRatio: "2 / 3",
            objectFit: "cover",
            borderRadius: 12,
            border: `1px solid ${BORDER}`,
            background: CARD,
          }}
        />
        {item.avg_rating && (
          <div
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              background: "rgba(0,0,0,0.72)",
              color: "white",
              padding: "3px 8px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: 3,
            }}
          >
            ⭐ {item.avg_rating}
          </div>
        )}
      </div>
      <div
        style={{
          color: "white",
          fontSize: 13,
          fontWeight: 600,
          marginTop: 8,
          lineHeight: 1.3,
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical" as const,
        }}
      >
        {item.title}
      </div>
    </a>
  );
}

// ─── Page ────────────────────────────────────────────────────────────
export default async function NewsletterMay2026() {
  const [leaderboard, topSeries, topMovies] = await Promise.all([
    loadLeaderboard(),
    loadTopByMediaType("tv", 6),
    loadTopByMediaType("movie", 6),
  ]);

  return (
    <main
      style={{
        background: BG,
        minHeight: "100vh",
        color: "white",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* Hero */}
      <header
        style={{
          padding: "60px 24px 40px",
          textAlign: "center",
          background: `linear-gradient(180deg, rgba(250,0,130,0.18) 0%, rgba(250,0,130,0) 100%)`,
        }}
      >
        <div
          style={{
            color: BRAND,
            fontSize: 36,
            fontWeight: 900,
            letterSpacing: -1,
          }}
        >
          Peekr
        </div>
        <div style={{ color: SUBTLE, fontSize: 14, marginTop: 6 }}>
          NEWSLETTER · EDICIÓN MAYO 2026
        </div>
        <h1
          style={{
            fontSize: 32,
            fontWeight: 900,
            marginTop: 18,
            marginBottom: 8,
            lineHeight: 1.1,
          }}
        >
          ¿Qué hay de nuevo en Peekr?
        </h1>
        <p
          style={{
            color: SUBTLE,
            fontSize: 15,
            maxWidth: 540,
            margin: "0 auto",
            lineHeight: 1.5,
          }}
        >
          El resumen del mes: features nuevas, los líderes de la comunidad y lo
          que todos están viendo esta semana.
        </p>
      </header>

      <div
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "0 20px 80px",
        }}
      >
        {/* What's new */}
        <Section
          emoji="✨"
          title="Qué hay de nuevo"
          subtitle="Tres features que estrenamos este mes"
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: 12,
            }}
          >
            <FeatureCard
              icon="🤖"
              title="Peekr AI — Tu Personalidad Cinéfila"
              body="Descubrí qué tipo de espectador sos y compará tus gustos con los de otros usuarios. ¿Sos más de thrillers oscuros o de comedias románticas? Peekr AI te lo dice."
            />
            <FeatureCard
              icon="🔍"
              title="Filtros en la búsqueda"
              body="Ahora podés filtrar por tipo (serie / película) y por plataforma de streaming. Encontrá más rápido lo que estás buscando."
            />
            <FeatureCard
              icon="🎯"
              title="Feed más inteligente"
              body="El algoritmo ahora te muestra lo que están viendo las personas con gustos más parecidos a los tuyos. Cuanto más interactúes, más se afina."
            />
          </div>
        </Section>

        {/* Tips */}
        <Section
          emoji="💡"
          title="Tips para sacarle el jugo"
          subtitle="Pequeños hábitos, gran diferencia en el feed"
        >
          <div
            style={{
              background: CARD,
              border: `1px solid ${BORDER}`,
              borderRadius: 14,
              padding: 18,
              fontSize: 14,
              lineHeight: 1.6,
              color: "rgba(255,255,255,0.85)",
            }}
          >
            <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
              <span style={{ color: BRAND }}>•</span>
              <span>
                Dale like a títulos que te llamen la atención y calificá los que
                ya viste — el algoritmo aprende rápido con esas señales.
              </span>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <span style={{ color: BRAND }}>•</span>
              <span>
                Seguí a personas con gustos similares — vas a ver contenido
                nuevo todo el tiempo.
              </span>
            </div>
          </div>
        </Section>

        {/* Leaderboard */}
        <Section
          emoji="🏆"
          title="Líderes del Mes · Mayo 2026"
          subtitle="Se acumulan puntos por seguidores, interacciones, likes y rachas semanales de uso del app. Top 10 global."
        >
          {leaderboard.length === 0 ? (
            <div style={{ color: SUBTLE, fontSize: 14 }}>
              Aún no hay datos para mostrar.
            </div>
          ) : (
            <div>
              {leaderboard.map((row) => (
                <LeaderboardRow key={row.user_id} row={row} />
              ))}
            </div>
          )}
        </Section>

        {/* Top Series */}
        <Section
          emoji="📺"
          title="Series más vistas en Peekr"
          subtitle="Lo más mirado por la comunidad esta semana"
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 14,
            }}
          >
            {topSeries.map((item) => (
              <PosterTile key={`${item.tmdb_id}-tv`} item={item} />
            ))}
          </div>
        </Section>

        {/* Top Movies */}
        <Section
          emoji="🎬"
          title="Películas más vistas en Peekr"
          subtitle="El cine que está sumando esta semana"
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 14,
            }}
          >
            {topMovies.map((item) => (
              <PosterTile key={`${item.tmdb_id}-movie`} item={item} />
            ))}
          </div>
        </Section>

        {/* Footer */}
        <div
          style={{
            marginTop: 64,
            paddingTop: 32,
            borderTop: `1px solid ${BORDER}`,
            textAlign: "center",
            color: SUBTLE,
            fontSize: 13,
          }}
        >
          <div style={{ marginBottom: 10 }}>
            Gracias por ser parte de Peekr 🎬
          </div>
          <div>
            ¿Algo que te gustaría ver en la próxima edición? Respondé este chat
            desde el app, leemos todo.
          </div>
        </div>
      </div>
    </main>
  );
}
