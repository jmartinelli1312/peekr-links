// app/title/[tmdb_id]/page.tsx

import { supabase } from "@/lib/supabase"
import Image from "next/image"
import { notFound } from "next/navigation"

const TMDB_KEY = "3fe8e88bbcb0d91a3b4f9ab4d01f418a"

async function getTitle(type: string, id: string) {
  const res = await fetch(
    `https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_KEY}&append_to_response=credits,watch/providers`,
    { cache: "no-store" }
  )

  if (!res.ok) return null

  return res.json()
}

export default async function TitlePage({
  params,
}: {
  params: { type: string; id: string }
}) {

const id = params.id

const data = await getTitle(params.type, params.id)

if (!data) return notFound()

  const { data: ratings } = await supabase
    .from("user_title_activities")
    .select("rating")
    .eq("tmdb_id", id)

  const avg =
    ratings && ratings.length
      ? (
          ratings.reduce((a, b) => a + (b.rating || 0), 0) / ratings.length
        ).toFixed(1)
      : null

  return (
    <div className="bg-[#0B0B0F] min-h-screen text-white">

      {/* HERO */}
      <div className="relative h-[420px] w-full">

        {data.backdrop_path && (
          <Image
            src={`https://image.tmdb.org/t/p/original${data.backdrop_path}`}
            alt="backdrop"
            fill
            className="object-cover opacity-40"
          />
        )}

        <div className="absolute bottom-0 left-0 p-8 flex gap-8">

          {/* POSTER */}

          {data.poster_path && (
            <Image
              src={`https://image.tmdb.org/t/p/w500${data.poster_path}`}
              alt="poster"
              width={200}
              height={300}
              className="rounded-xl shadow-xl"
            />
          )}

          {/* INFO */}

          <div className="max-w-xl">

            <h1 className="text-4xl font-bold">
              {data.title} ({data.release_date?.slice(0,4)})
            </h1>

            {avg && (
              <div className="mt-2 text-pink-400 text-lg">
                ⭐ {avg}
              </div>
            )}

            <div className="flex gap-2 mt-3 flex-wrap">

              {data.genres?.map((g:any)=>(
                <span
                  key={g.id}
                  className="bg-[#15151C] px-3 py-1 rounded-full text-sm"
                >
                  {g.name}
                </span>
              ))}

            </div>

            <p className="mt-4 text-gray-300">
              {data.overview}
            </p>

            {/* ACTIONS */}

            <div className="flex gap-3 mt-5">

              <button className="bg-pink-500 px-4 py-2 rounded-lg">
                ⭐ Rate
              </button>

              <button className="bg-[#222] px-4 py-2 rounded-lg">
                👁 Watched
              </button>

              <button className="bg-[#222] px-4 py-2 rounded-lg">
                🔖 Save
              </button>

              <button className="bg-[#222] px-4 py-2 rounded-lg">
                🎬 Trailer
              </button>

            </div>

          </div>

        </div>

      </div>

      {/* TABS */}

      <div className="border-b border-[#222] px-8 mt-8">

        <div className="flex gap-6 text-gray-400">

          <button className="text-white pb-3 border-b-2 border-pink-500">
            Overview
          </button>

          <button>Cast</button>

          <button>Crew</button>

          <button>Details</button>

          <button>Genres</button>

          <button>Platforms</button>

          <button>Lists</button>

        </div>

      </div>

      {/* OVERVIEW CONTENT */}

      <div className="p-8">

        {/* CAST */}

        <h2 className="text-xl font-semibold mb-4">
          Cast
        </h2>

        <div className="flex gap-4 overflow-x-auto pb-4">

          {data.credits?.cast?.slice(0,10).map((actor:any)=>(
            <div
              key={actor.id}
              className="w-[120px] flex-shrink-0"
            >

              {actor.profile_path && (
                <Image
                  src={`https://image.tmdb.org/t/p/w185${actor.profile_path}`}
                  alt={actor.name}
                  width={120}
                  height={180}
                  className="rounded-lg"
                />
              )}

              <div className="mt-2 text-sm">
                {actor.name}
              </div>

              <div className="text-xs text-gray-400">
                {actor.character}
              </div>

            </div>
          ))}

        </div>

        {/* CREW */}

        <h2 className="text-xl font-semibold mt-8 mb-4">
          Crew
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

          {data.credits?.crew
            ?.filter((c:any)=>["Director","Writer"].includes(c.job))
            .slice(0,8)
            .map((c:any)=>(
              <div key={c.id}>
                <div className="font-medium">
                  {c.name}
                </div>
                <div className="text-sm text-gray-400">
                  {c.job}
                </div>
              </div>
            ))}

        </div>

        {/* DETAILS */}

        <h2 className="text-xl font-semibold mt-10 mb-4">
          Details
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-gray-300">

          <div>
            <div className="text-gray-500 text-sm">
              Release date
            </div>
            {data.release_date}
          </div>

          <div>
            <div className="text-gray-500 text-sm">
              Runtime
            </div>
            {data.runtime} min
          </div>

          <div>
            <div className="text-gray-500 text-sm">
              Language
            </div>
            {data.original_language}
          </div>

          <div>
            <div className="text-gray-500 text-sm">
              Status
            </div>
            {data.status}
          </div>

        </div>

      </div>

    </div>
  )
}
