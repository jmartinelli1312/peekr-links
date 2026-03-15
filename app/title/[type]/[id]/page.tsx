export const dynamic = "force-dynamic";

import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const TMDB_KEY = process.env.TMDB_API_KEY!;
const TMDB = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p/original";
const POSTER = "https://image.tmdb.org/t/p/w342";

async function getTitle(type: string, id: string) {
  const res = await fetch(
    `${TMDB}/${type}/${id}?api_key=${TMDB_KEY}&language=es-ES&append_to_response=credits,videos,watch/providers`,
    { next: { revalidate: 3600 } }
  );

  if (!res.ok) return null;
  return res.json();
}

export default async function TitlePage({
  params,
}: {
  params: Promise<{ type: string; id: string }>;
}) {

  const { type, id } = await params

  const data = await getTitle(type, id);

  if (!data) {
    return (
      <div style={{ padding: 40, color: "white" }}>
        Error loading TMDB data<br />
        type: {type} id: {id}
      </div>
    );
  }

  const title = data.title || data.name;
  const year = (data.release_date || data.first_air_date || "").slice(0, 4);
  const backdrop = data.backdrop_path;
  const poster = data.poster_path;

  const cast = data.credits?.cast?.slice(0, 12) || [];
  const crew = data.credits?.crew?.slice(0, 12) || [];

  const director =
    data.credits?.crew?.find((c:any)=>c.job==="Director") || null

  const creator = data.created_by?.[0] || null

  const providers =
    data["watch/providers"]?.results?.AR?.flatrate || []

  const trailer =
    data.videos?.results?.find((v:any)=>v.type==="Trailer") || null


  /* ---------------------- */
  /* PEEKR SOCIAL DATA */
  /* ---------------------- */

  const { data: ratings } = await supabase
    .from("user_title_activities")
    .select("rating")
    .eq("tmdb_id", id)

  const peekrRating =
    ratings?.length
      ? (ratings.reduce((a,b)=>a+b.rating,0)/ratings.length).toFixed(1)
      : null

  const { data: watchers } = await supabase
    .from("user_title_activities")
    .select(`
      user_id,
      profiles (
        username,
        avatar_url
      )
    `)
    .eq("tmdb_id", id)
    .limit(12)

  const { data: comments } = await supabase
    .from("title_comments")
    .select(`
      id,
      content,
      profiles (
        username,
        avatar_url
      )
    `)
    .eq("tmdb_id", id)
    .limit(10)


  return (
    <div style={{ background:"#0B0B0F",minHeight:"100vh",color:"white"}}>

      {/* BACKDROP */}

      {backdrop && (
        <div style={{position:"relative",height:420}}>
          <Image
            src={`${IMG}${backdrop}`}
            alt={title}
            fill
            style={{objectFit:"cover",opacity:.35}}
          />
        </div>
      )}

      <div style={{maxWidth:1100,margin:"auto",padding:30}}>

        {/* HEADER */}

        <div
          style={{
            display:"flex",
            gap:30,
            marginTop:-120,
            position:"relative",
            zIndex:5
          }}
        >

          {poster && (
            <Image
              src={`${POSTER}${poster}`}
              alt={title}
              width={220}
              height={330}
              style={{borderRadius:10}}
            />
          )}

          <div>

            <h1 style={{fontSize:36}}>
              {title} {year && <span style={{opacity:.6}}>({year})</span>}
            </h1>

            {director && (
              <div style={{marginTop:6}}>
                Directed by{" "}
                <Link href={`/actor/${director.id}`}>
                  {director.name}
                </Link>
              </div>
            )}

            {creator && (
              <div style={{marginTop:6}}>
                Created by{" "}
                <Link href={`/actor/${creator.id}`}>
                  {creator.name}
                </Link>
              </div>
            )}

            <div style={{marginTop:8,opacity:.7}}>
              {data.runtime && <>⏱ {data.runtime} min</>}
            </div>

            {/* GENRES */}

            <div style={{marginTop:12}}>
              {data.genres?.map((g:any)=>(
                <span
                  key={g.id}
                  style={{
                    marginRight:10,
                    padding:"4px 10px",
                    background:"#1c1c24",
                    borderRadius:20,
                    fontSize:12
                  }}
                >
                  {g.name}
                </span>
              ))}
            </div>

            {/* TRAILER */}

            {trailer && (
              <div style={{marginTop:20}}>
                <Link
                  href={`https://youtube.com/watch?v=${trailer.key}`}
                  target="_blank"
                  style={{
                    background:"#FA0082",
                    padding:"10px 18px",
                    borderRadius:8
                  }}
                >
                  ▶ Watch Trailer
                </Link>
              </div>
            )}

            {/* PEEKR RATING */}

            {peekrRating && (
              <div style={{marginTop:20}}>
                ⭐ Peekr Rating: {peekrRating}
              </div>
            )}

          </div>
        </div>


        {/* OVERVIEW */}

        {data.overview && (
          <div style={{marginTop:40}}>
            <h2>Overview</h2>
            <p style={{opacity:.8,marginTop:10}}>
              {data.overview}
            </p>
          </div>
        )}


        {/* STREAMING */}

        {providers.length>0 && (
          <div style={{marginTop:40}}>
            <h2>Where to watch</h2>

            <div style={{display:"flex",gap:12,marginTop:12}}>
              {providers.map((p:any)=>(
                <Image
                  key={p.provider_id}
                  src={`https://image.tmdb.org/t/p/w92${p.logo_path}`}
                  alt={p.provider_name}
                  width={50}
                  height={50}
                />
              ))}
            </div>
          </div>
        )}


        {/* USERS WHO WATCHED */}

        {watchers?.length>0 && (
          <div style={{marginTop:40}}>
            <h2>Users who watched</h2>

            <div style={{display:"flex",gap:10,marginTop:12}}>
              {watchers.map((w:any)=>(
                <Link key={w.user_id} href={`/user/${w.profiles.username}`}>
                  <Image
                    src={w.profiles.avatar_url}
                    alt={w.profiles.username}
                    width={40}
                    height={40}
                    style={{borderRadius:"50%"}}
                  />
                </Link>
              ))}
            </div>
          </div>
        )}


        {/* CAST */}

        <div style={{marginTop:40}}>
          <h2>Cast</h2>

          <div
            style={{
              display:"grid",
              gridTemplateColumns:"repeat(auto-fill,120px)",
              gap:20,
              marginTop:20
            }}
          >
            {cast.map((c:any)=>(
              <Link key={c.id} href={`/actor/${c.id}`}>

                <div style={{textAlign:"center"}}>

                  {c.profile_path && (
                    <Image
                      src={`https://image.tmdb.org/t/p/w185${c.profile_path}`}
                      alt={c.name}
                      width={120}
                      height={160}
                      style={{borderRadius:8}}
                    />
                  )}

                  <div style={{marginTop:6,fontSize:13}}>
                    {c.name}
                  </div>

                  <div style={{fontSize:12,opacity:.6}}>
                    {c.character}
                  </div>

                </div>

              </Link>
            ))}
          </div>
        </div>


        {/* CREW */}

        <div style={{marginTop:40}}>
          <h2>Crew</h2>

          <div
            style={{
              display:"grid",
              gridTemplateColumns:"repeat(auto-fill,120px)",
              gap:20,
              marginTop:20
            }}
          >
            {crew.map((c:any)=>(
              <Link key={c.id} href={`/actor/${c.id}`}>

                <div style={{textAlign:"center"}}>

                  {c.profile_path && (
                    <Image
                      src={`https://image.tmdb.org/t/p/w185${c.profile_path}`}
                      alt={c.name}
                      width={120}
                      height={160}
                      style={{borderRadius:8}}
                    />
                  )}

                  <div style={{marginTop:6,fontSize:13}}>
                    {c.name}
                  </div>

                  <div style={{fontSize:12,opacity:.6}}>
                    {c.job}
                  </div>

                </div>

              </Link>
            ))}
          </div>
        </div>


        {/* COMMENTS */}

        {comments?.length>0 && (
          <div style={{marginTop:40}}>
            <h2>Comments</h2>

            {comments.map((c:any)=>(
              <div
                key={c.id}
                style={{
                  display:"flex",
                  gap:10,
                  marginTop:14,
                  background:"#16161d",
                  padding:12,
                  borderRadius:8
                }}
              >

                <Image
                  src={c.profiles.avatar_url}
                  alt=""
                  width={36}
                  height={36}
                  style={{borderRadius:"50%"}}
                />

                <div>
                  <b>{c.profiles.username}</b>
                  <div style={{opacity:.8}}>
                    {c.content}
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
