export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { supabase } from '@/lib/supabase';
import AppRedirect from './AppRedirect';

// ===============================
// TYPES
// ===============================
type Params = {
  type: 'movie' | 'tv';
  id: string;
};

type Props = {
  params: Promise<Params>;
};

const TMDB_KEY = process.env.TMDB_API_KEY!;
const TMDB_BASE = 'https://api.themoviedb.org/3';

// ===============================
// TMDB FETCH
// ===============================
async function getTitle(type: string, id: string) {
  const res = await fetch(
    `${TMDB_BASE}/${type}/${id}?api_key=${TMDB_KEY}&language=en-US`,
    { next: { revalidate: 86400 } }
  );

  if (!res.ok) return null;
  return res.json();
}

// ===============================
// PEEKR RATING
// ===============================
async function getPeekrRating(tmdbId: number) {
  const { data } = await supabase.rpc('avg_rating_for_title', {
    tmdbid: tmdbId,
  });

  if (!data) return null;

  const rating = Number(data) / 2;
  return Number(rating.toFixed(1));
}

// ===============================
// METADATA (SEO / OG)
// ===============================
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { type, id } = await params;

  const data = await getTitle(type, id);

  if (!data) {
    return {
      title: 'Peekr',
      description: 'Discover movies & TV shows on Peekr',
    };
  }

  const title = data.title || data.name;

  const poster = data.poster_path
    ? `https://image.tmdb.org/t/p/w780${data.poster_path}`
    : undefined;

  return {
    title,
    description: data.overview,

    openGraph: {
      title,
      description: data.overview,
      url: `https://peekr.app/title/${type}/${id}`,
      images: poster ? [poster] : [],
      type: 'website',
    },

    twitter: {
      card: 'summary_large_image',
      title,
      description: data.overview,
      images: poster ? [poster] : [],
    },
  };
}

// ===============================
// CLIENT REDIRECT
// ===============================
function AppRedirect({ type, id }: { type: string; id: string }) {
  useEffect(() => {
    const appUrl = `peekr://title/${type}/${id}`;
    const fallback = process.env.NEXT_PUBLIC_TESTFLIGHT_URL;

    window.location.href = appUrl;

    const t = setTimeout(() => {
      if (fallback) {
        window.location.href = fallback;
      }
    }, 1500);

    return () => clearTimeout(t);
  }, [type, id]);

  return null;
}

// ===============================
// PAGE
// ===============================
export default async function TitlePage({ params }: Props) {
  const { type, id } = await params;

  const data = await getTitle(type, id);

  if (!data) {
    return <div className="p-10 text-white">Not found</div>;
  }

  const rating = await getPeekrRating(Number(id));

  const title = data.title || data.name;

  const poster = data.poster_path
    ? `https://image.tmdb.org/t/p/w500${data.poster_path}`
    : null;

  return (
    <>
      <AppRedirect type={type} id={id} />

      <main className="min-h-screen bg-black text-white p-6">
        <div className="flex gap-6">
          {poster && (
            <img
              src={poster}
              alt={title}
              className="w-64 rounded-xl"
            />
          )}

          <div>
            <h1 className="text-3xl font-bold">{title}</h1>

            {rating && (
              <div className="mt-2 text-yellow-400 text-lg">
                ⭐ {rating} Peekr rating
              </div>
            )}

            <p className="mt-4 text-white/80 max-w-xl">
              {data.overview}
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
