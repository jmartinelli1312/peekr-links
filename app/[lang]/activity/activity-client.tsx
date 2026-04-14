"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

const BRAND = "#FA0082";
const POSTER = "https://image.tmdb.org/t/p/w300";

type Lang = "en" | "es" | "pt";

type ActivityTexts = {
  title: string;
  subtitle: string;
  noSessionTitle: string;
  noSessionText: string;
  createAccount: string;
  signIn: string;
  noActivity: string;
  seen: string;
  titleSingle: string;
  titlePlural: string;
  createdPeeklist: string;
};

type ActivityItem = {
  activity_type?: string;
  activity_key?: string;
  username?: string;
  avatar_url?: string | null;
  activity_time?: string;
  titles?: string[];
  posters?: string[];
  ratings?: (number | null)[];
  tmdb_ids?: number[];
  media_types?: string[];
  peeklist_title?: string;
  peeklist_id?: string;
};

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function titleHref({
  lang,
  tmdbId,
  mediaType,
  title,
}: {
  lang: Lang;
  tmdbId: number;
  mediaType: string;
  title: string;
}) {
  const type = mediaType === "tv" ? "tv" : "movie";
  return `/${lang}/title/${type}/${tmdbId}-${slugify(title || "title")}`;
}

function userHref(lang: Lang, username: string) {
  return `/${lang}/u/${username}`;
}

function peeklistHref(lang: Lang, peeklistId: string) {
  return `/${lang}/peeklist/${peeklistId}`;
}

function signupHref(lang: Lang) {
  return `/${lang}/signup`;
}

function loginHref(lang: Lang) {
  return `/${lang}/login`;
}

function formatRelativeTime(dateString: string, lang: Lang) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();

  const divisions = [
    { amount: 60, unit: "second" as const },
    { amount: 60, unit: "minute" as const },
    { amount: 24, unit: "hour" as const },
    { amount: 7, unit: "day" as const },
    { amount: 4.34524, unit: "week" as const },
    { amount: 12, unit: "month" as const },
    { amount: Number.POSITIVE_INFINITY, unit: "year" as const },
  ];

  let duration = diffMs / 1000;
  let unit: Intl.RelativeTimeFormatUnit = "second";

  for (const division of divisions) {
    if (Math.abs(duration) < division.amount) {
      unit = division.unit;
      break;
    }
    duration /= division.amount;
  }

  const locale = lang === "es" ? "es" : lang === "pt" ? "pt-BR" : "en";
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  return rtf.format(Math.round(duration), unit);
}

function normalizeRating(value: number | null | undefined) {
  if (value == null) return null;
  const normalized = value > 5 ? value / 2 : value;
  return Number.isInteger(normalized)
    ? String(normalized)
    : normalized.toFixed(1);
}

export default function ActivityClient({
  lang,
  t,
}: {
  lang: Lang;
  t: ActivityTexts;
}) {
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  async function loadActivity() {
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setIsLoggedIn(false);
        setActivities([]);
        setLoading(false);
        return;
      }

      setIsLoggedIn(true);

      const { data: profile } = await supabase
        .from("profiles")
        .select("language")
        .eq("id", user.id)
        .maybeSingle();

      const feedLang =
        (profile?.language as string | null) ||
        (lang === "pt" ? "pt" : lang === "es" ? "es" : "en");

      const { data, error } = await supabase.rpc("get_activity_feed", {
        p_user_id: user.id,
        p_language: feedLang,
        p_limit: 30,
        p_offset: 0,
      });

      if (error) {
        setActivities([]);
      } else {
        setActivities((data as ActivityItem[] | null) ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadActivity();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadActivity();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const filteredActivities = useMemo(() => {
    return activities.filter((item) => {
      if (item.activity_type === "titles") {
        return (item.titles ?? []).length > 0;
      }
      if (item.activity_type === "peeklist_created") {
        return !!item.peeklist_id;
      }
      return false;
    });
  }, [activities]);

  function toggleExpanded(key: string) {
    setExpanded((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }

  function renderPosterStack(posters: string[]) {
    const visible = posters.slice(0, 4);

    return (
      <div className="poster-stack">
        {visible.map((poster, i) => (
          <img
            key={`${poster}-${i}`}
            src={`${POSTER}${poster}`}
            alt=""
            className="stack-poster"
            style={{ left: `${i * 28}px` }}
          />
        ))}

        {posters.length > 4 ? (
          <div className="stack-more" style={{ left: `${4 * 28}px` }}>
            +{posters.length - 4}
          </div>
        ) : null}
      </div>
    );
  }

  function renderTitleActivity(item: ActivityItem) {
    const activityKey = item.activity_key || Math.random().toString();
    const username = item.username || "";
    const avatar = item.avatar_url || "";
    const titles = item.titles || [];
    const posters = item.posters || [];
    const ratings = item.ratings || [];
    const tmdbIds = item.tmdb_ids || [];
    const mediaTypes = item.media_types || [];
    const time = item.activity_time || "";
    const isExpanded = !!expanded[activityKey];

    return (
      <div key={activityKey} className="activity-card">
        <div className="activity-top">
          <Link href={userHref(lang, username)} className="avatar-link">
            {avatar ? (
              <img src={avatar} alt={username} className="avatar" />
            ) : (
              <div className="avatar-fallback" />
            )}
          </Link>

          <div className="activity-main">
            <Link
              href={userHref(lang, username)}
              className="activity-headline"
            >
              @{username} {t.seen} {titles.length}{" "}
              {titles.length === 1 ? t.titleSingle : t.titlePlural}
            </Link>

            {time ? (
              <div className="activity-time">
                {formatRelativeTime(time, lang)}
              </div>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          className="poster-stack-button"
          onClick={() => toggleExpanded(activityKey)}
        >
          {renderPosterStack(posters)}
        </button>

        {isExpanded ? (
          <div className="expanded-list">
            {titles.map((title, i) => {
              const poster = posters[i];
              const rating = ratings[i];
              const tmdbId = tmdbIds[i];
              const mediaType = mediaTypes[i] || "movie";

              if (!tmdbId) return null;

              return (
                <Link
                  key={`${tmdbId}-${i}`}
                  href={titleHref({
                    lang,
                    tmdbId,
                    mediaType,
                    title,
                  })}
                  className="expanded-row"
                >
                  {poster ? (
                    <img
                      src={`${POSTER}${poster}`}
                      alt={title}
                      className="expanded-poster"
                    />
                  ) : (
                    <div className="expanded-poster-fallback" />
                  )}

                  <div className="expanded-title">{title}</div>

                  {rating != null ? (
                    <div className="expanded-rating">
                      ★{normalizeRating(rating)}
                    </div>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  }

  function renderPeeklistActivity(item: ActivityItem, index: number) {
    const username = item.username || "";
    const avatar = item.avatar_url || "";
    const peeklistTitle = item.peeklist_title || "";
    const peeklistId = item.peeklist_id || "";
    const time = item.activity_time || "";

    return (
      <div key={`${peeklistId}-${index}`} className="activity-card">
        <div className="activity-top">
          <Link href={userHref(lang, username)} className="avatar-link">
            {avatar ? (
              <img src={avatar} alt={username} className="avatar" />
            ) : (
              <div className="avatar-fallback" />
            )}
          </Link>

          <div className="activity-main">
            <div className="activity-headline">
              <Link href={userHref(lang, username)} className="inline-user">
                @{username}
              </Link>{" "}
              {t.createdPeeklist}
            </div>

            <Link
              href={peeklistHref(lang, peeklistId)}
              className="peeklist-link"
            >
              {peeklistTitle}
            </Link>

            {time ? (
              <div className="activity-time">
                {formatRelativeTime(time, lang)}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        .activity-page {
          display: flex;
          flex-direction: column;
          gap: 28px;
        }

        .activity-hero h1 {
          margin: 0;
          font-size: clamp(42px, 9vw, 68px);
          line-height: 0.98;
          letter-spacing: -0.05em;
          font-weight: 900;
          color: white;
        }

        .activity-hero p {
          margin: 16px 0 0 0;
          max-width: 760px;
          color: rgba(255,255,255,0.74);
          font-size: 17px;
          line-height: 1.75;
        }

        .empty-shell {
          margin-top: 8px;
          border-radius: 26px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04);
          padding: 26px 22px;
          text-align: center;
        }

        .empty-shell h2 {
          margin: 0;
          font-size: clamp(28px, 7vw, 40px);
          line-height: 1.02;
          font-weight: 900;
          letter-spacing: -0.03em;
          color: white;
        }

        .empty-shell p {
          margin: 14px auto 0 auto;
          max-width: 700px;
          color: rgba(255,255,255,0.72);
          font-size: 16px;
          line-height: 1.7;
        }

        .empty-actions {
          display: flex;
          justify-content: center;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 22px;
        }

        .btn-primary,
        .btn-secondary {
          text-decoration: none;
          border-radius: 16px;
          padding: 14px 18px;
          font-weight: 800;
          font-size: 15px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .btn-primary {
          background: ${BRAND};
          color: white;
        }

        .btn-secondary {
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.10);
          color: white;
        }

        .activity-list {
          display: grid;
          gap: 16px;
        }

        .activity-card {
          padding: 16px;
          border-radius: 20px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
        }

        .activity-top {
          display: flex;
          gap: 12px;
          align-items: flex-start;
        }

        .avatar-link {
          text-decoration: none;
          flex-shrink: 0;
        }

        .avatar,
        .avatar-fallback {
          width: 40px;
          height: 40px;
          border-radius: 999px;
          object-fit: cover;
          background: rgba(255,255,255,0.08);
          display: block;
        }

        .activity-main {
          min-width: 0;
          flex: 1;
        }

        .activity-headline,
        .inline-user {
          color: white;
          text-decoration: none;
          font-size: 15px;
          line-height: 1.5;
          font-weight: 700;
        }

        .activity-time {
          margin-top: 4px;
          color: rgba(255,255,255,0.42);
          font-size: 12px;
        }

        .peeklist-link {
          display: inline-block;
          margin-top: 8px;
          color: rgba(255,255,255,0.74);
          text-decoration: none;
          font-size: 14px;
          line-height: 1.5;
        }

        .poster-stack-button {
          margin-top: 14px;
          padding: 0;
          background: transparent;
          border: none;
          width: 100%;
          text-align: left;
          cursor: pointer;
        }

        .poster-stack {
          position: relative;
          height: 62px;
          width: 170px;
        }

        .stack-poster,
        .stack-more {
          position: absolute;
          top: 0;
          width: 46px;
          height: 62px;
          border-radius: 8px;
          object-fit: cover;
          background: rgba(255,255,255,0.08);
        }

        .stack-more {
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 800;
          font-size: 14px;
          background: rgba(255,255,255,0.12);
        }

        .expanded-list {
          margin-top: 14px;
          display: grid;
          gap: 10px;
        }

        .expanded-row {
          display: flex;
          gap: 12px;
          align-items: center;
          text-decoration: none;
          color: white;
        }

        .expanded-poster,
        .expanded-poster-fallback {
          width: 36px;
          height: 52px;
          border-radius: 8px;
          object-fit: cover;
          background: rgba(255,255,255,0.08);
          flex-shrink: 0;
        }

        .expanded-title {
          flex: 1;
          min-width: 0;
          font-size: 14px;
          line-height: 1.45;
          color: rgba(255,255,255,0.92);
        }

        .expanded-rating {
          color: #fbbf24;
          font-weight: 800;
          font-size: 14px;
          flex-shrink: 0;
        }
      `}</style>

      <div className="activity-page">
        <section className="activity-hero">
          <h1>{t.title}</h1>
          <p>{t.subtitle}</p>
        </section>

        {loading ? (
          <div className="empty-shell">
            <p>Loading...</p>
          </div>
        ) : !isLoggedIn ? (
          <div className="empty-shell">
            <h2>{t.noSessionTitle}</h2>
            <p>{t.noSessionText}</p>

            <div className="empty-actions">
              <Link href={signupHref(lang)} className="btn-primary">
                {t.createAccount}
              </Link>
              <Link href={loginHref(lang)} className="btn-secondary">
                {t.signIn}
              </Link>
            </div>
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="empty-shell">
            <p>{t.noActivity}</p>
          </div>
        ) : (
          <div className="activity-list">
            {filteredActivities.map((item, index) => {
              if (item.activity_type === "titles") {
                return renderTitleActivity(item);
              }

              if (item.activity_type === "peeklist_created") {
                return renderPeeklistActivity(item, index);
              }

              return null;
            })}
          </div>
        )}
      </div>
    </>
  );
}
