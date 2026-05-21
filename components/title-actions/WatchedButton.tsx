"use client";

// Entry point rendered on the title detail page. Detects auth state, shows
// "Marcar visto" or "Visto · ⭐X.X" depending on the user's current activity
// for this title, and orchestrates the two modals.
//
// Movie flow:   click → RateModal(seasonNumber=null)
// TV flow:      click → SeasonSelectorModal → if any seasons added, open
//               RateModal anchored to last(added)

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import RateModal from "./RateModal";
import SeasonSelectorModal, { TmdbSeason } from "./SeasonSelectorModal";
import { normalizeLang, TITLE_ACTION_TEXTS } from "./i18n";

type Props = {
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  posterPath: string | null;
  releaseYear: number | null;
  seasons: TmdbSeason[] | null; // null for movies, list for TV
  lang: string;
};

type MyActivity = {
  // Highest rating across rows (movies have 1 row, TV has N — show the
  // one anchored to the highest watched season).
  rating: number | null;
  watchedSeasons: Set<number>;
  // True when the user has marked at least one season watched (or movie).
  hasAny: boolean;
};

export default function WatchedButton({
  tmdbId,
  mediaType,
  title,
  posterPath,
  releaseYear,
  seasons,
  lang,
}: Props) {
  const router = useRouter();
  const texts = TITLE_ACTION_TEXTS[normalizeLang(lang)];

  const [authChecked, setAuthChecked] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activity, setActivity] = useState<MyActivity>({
    rating: null,
    watchedSeasons: new Set(),
    hasAny: false,
  });

  const [seasonModalOpen, setSeasonModalOpen] = useState(false);
  const [rateModalOpen, setRateModalOpen] = useState(false);
  const [pendingSeason, setPendingSeason] = useState<number | null>(null);

  const fetchActivity = useCallback(async () => {
    const { data: userResp } = await supabase.auth.getUser();
    const uid = userResp.user?.id;
    if (!uid) {
      setIsLoggedIn(false);
      setAuthChecked(true);
      return;
    }
    setIsLoggedIn(true);

    const { data, error } = await supabase
      .from("user_title_activities")
      .select("rating, season_number")
      .eq("user_id", uid)
      .eq("tmdb_id", tmdbId);
    if (error) {
      setAuthChecked(true);
      return;
    }
    const rows = data ?? [];
    const seasonsSet = new Set<number>();
    let best: number | null = null;
    for (const r of rows) {
      const s = r.season_number;
      if (typeof s === "number") seasonsSet.add(s);
      const rt = r.rating;
      if (typeof rt === "number") {
        if (best === null || rt > best) best = rt;
      }
    }
    setActivity({
      rating: best,
      watchedSeasons: seasonsSet,
      hasAny: rows.length > 0,
    });
    setAuthChecked(true);
  }, [tmdbId]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  const onClick = useCallback(() => {
    if (!isLoggedIn) {
      router.push(`/${lang}/signup`);
      return;
    }
    if (mediaType === "tv") {
      setSeasonModalOpen(true);
    } else {
      setPendingSeason(null);
      setRateModalOpen(true);
    }
  }, [isLoggedIn, mediaType, router, lang]);

  // Don't render while we haven't confirmed auth state — prevents a
  // flicker between "sign in" and "mark watched".
  if (!authChecked) {
    return (
      <button className="wb-btn wb-btn-placeholder" disabled aria-hidden>
        {texts.markWatched}
      </button>
    );
  }

  const labelWatched = activity.rating != null
    ? `${texts.alreadyWatched} · ⭐ ${activity.rating.toFixed(1)}`
    : texts.alreadyWatched;

  const label = activity.hasAny ? labelWatched : texts.markWatched;

  return (
    <>
      <button
        className={`wb-btn ${activity.hasAny ? "wb-btn-done" : ""}`}
        onClick={onClick}
        aria-label={label}
      >
        <span aria-hidden>{activity.hasAny ? "👁" : "＋"}</span>
        {label}
      </button>

      {mediaType === "tv" && seasons && (
        <SeasonSelectorModal
          open={seasonModalOpen}
          onClose={() => setSeasonModalOpen(false)}
          tmdbId={tmdbId}
          title={title}
          posterPath={posterPath}
          seasons={seasons}
          initiallyWatched={activity.watchedSeasons}
          texts={texts}
          onConfirmed={({ added }) => {
            if (added.length > 0) {
              setPendingSeason(added[added.length - 1]);
              setRateModalOpen(true);
            } else {
              fetchActivity();
            }
          }}
        />
      )}

      <RateModal
        open={rateModalOpen}
        onClose={() => setRateModalOpen(false)}
        tmdbId={tmdbId}
        mediaType={mediaType}
        title={title}
        posterPath={posterPath}
        releaseYear={releaseYear}
        seasonNumber={pendingSeason}
        texts={texts}
        onSaved={fetchActivity}
      />

      <style>{`
        .wb-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 6px 14px; border-radius: 20px;
          border: 1px solid rgba(255,255,255,.18);
          background: rgba(255,255,255,.06);
          color: rgba(255,255,255,.9); font-size: 13px; font-weight: 600;
          cursor: pointer; transition: background .15s, border-color .15s;
          white-space: nowrap; touch-action: manipulation;
        }
        .wb-btn:hover {
          background: rgba(250,0,130,.18); border-color: rgba(250,0,130,.5);
          color: #fff;
        }
        .wb-btn-done {
          background: rgba(250,0,130,.16);
          border-color: rgba(250,0,130,.5);
          color: #fff;
        }
        .wb-btn-placeholder {
          opacity: .4; cursor: default;
        }
      `}</style>
    </>
  );
}
