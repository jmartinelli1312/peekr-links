import { Metadata } from 'next';

type PageProps = {
  params: Promise<{
    type: 'movie' | 'tv';
    id: string;
  }>;
};

async function getTitle(type: string, id: string) {
  const res = await fetch(
    `https://api.themoviedb.org/3/${type}/${id}?language=en-US`,
    {
      headers: {
        Authorization: `Bearer ${process.env.TMDB_BEARER_TOKEN}`,
      },
      cache: 'no-store',
    }
  );

  if (!res.ok) return null;
  return res.json();
}

// ----------------------------------------------------
// 🧠 METADATA (WhatsApp / OG / Twitter)
// ----------------------------------------------------
export async function generateMetadata(
  { params }: PageProps
): Promise<Metadata> {
  const { type, id } = await params; // ✅ FIX
  const data = await getTitle(type, id);

  if (!data) {
    return {
      title: 'Peekr',
      description: 'Discover movies and series on Peekr',
    };
  }

  const title = data.title || data.name;
  const description =
    data.overview || 'Discover this title on Peekr';

  const poster = data.poster_path
    ? `https://image.tmdb.org/t/p/w500${data.poster_path}`
    : undefined;

  const url = `https://peekr-links.vercel.app/title/${type}/${id}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: 'Peekr',
      images: poster
        ? [{ url: poster, width: 500, height: 750 }]
        : [],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: poster ? [poster] : [],
    },
  };
}

// ----------------------------------------------------
// 🧱 PAGE
// ----------------------------------------------------
export default async function TitlePage({ params }: PageProps) {
  const { type, id } = await params; // ✅ FIX
  const data = await getTitle(type, id);

  if (!data) {
    return <div style={{ padding: 40 }}>Not found</div>;
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#000',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
        textAlign: 'center',
      }}
    >
      <div>
        {data.poster_path && (
          <img
            src={`https://image.tmdb.org/t/p/w500${data.poster_path}`}
            style={{ width: 260, borderRadius: 12 }}
          />
        )}

        <h1 style={{ marginTop: 20 }}>
          {data.title || data.name}
        </h1>

        <p style={{ maxWidth: 420, opacity: 0.8 }}>
          {data.overview}
        </p>
      </div>
    </div>
  );
}