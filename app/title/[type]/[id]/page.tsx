export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { supabase } from '@/lib/supabase';

type Params = {
  type: 'movie' | 'tv';
  id: string;
};

type Props = {
  params: Promise<Params>;
};

// ===============================
// TMDB FETCH
// ===============================

const TMDB_KEY = process.env.TMDB_API_KEY!;
const TMDB_BASE = 'https://api.themoviedb.org/3';

async function getTitle(type: string, id: string) {
  const res = await fetch(
    `${TMDB_BASE}/${type}/${id}?api_key=${TMDB_KEY}&language=en-US`,
    { next: { revalidate: 86400 } }
  );

  if (!res.ok) return null;
  return res.json();
}

// ===============================
// FETCH PEEKR RATING
// ===============================

async function getPeekrRating(tmdbId: number) {
  const { data, error } = await supabase.rpc(
    'avg_rating_for_title',
    { tmdbid: tmdbId }
  );

  if (error || data == null) return null;

  const rating = Number(data) / 2;
  return Number(rating.toFixed(1));
}

// ===============================
// METADATA (OG)
// ===============================

export async function generateMetadata(
  { params }: Props
): Promise<Metadata> {

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

  const year =
    data.release_date?.split('-')[0] ||
    data.first_air_date?.split('-')[0];

  const genres = data.genres?.map((g: any) => g.name).join(', ');

  const deeplink = `peekr://title/${type}/${id}`;

  return (
    <main className="min-h-screen bg-black text-white p-6">

      <div className="max-w-5xl mx-auto">

        <div className="flex flex-col md:flex-row gap-8">

          {poster && (
            <img
              src={poster}
              alt={title}
              className="w-64 rounded-xl"
            />
          )}

          <div>

            <h1 className="text-4xl font-bold">
              {title}
            </h1>

            <p className="text-white/60 mt-2">
              {year} {genres && `• ${genres}`}
            </p>

            {rating && (
              <div className="mt-4 text-yellow-400 text-xl font-semibold">
                ⭐ {rating} Peekr rating
              </div>
            )}

            <p className="mt-6 text-white/80 max-w-xl">
              {data.overview}
            </p>

            <a
              href={deeplink}
              className="inline-block mt-6 px-6 py-3 bg-white text-black rounded-lg font-semibold"
            >
              Open in Peekr
            </a>

          </div>

        </div>

      </div>

    </main>
  );
}
