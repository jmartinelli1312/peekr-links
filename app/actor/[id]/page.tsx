const TMDB = "https://api.themoviedb.org/3";

export default async function ActorPage({ params }) {

const id = params.id

const res = await fetch(
`${TMDB}/person/${id}?api_key=${process.env.TMDB_API_KEY}`
)

const actor = await res.json()

return (

<div style={{padding:40}}>

<h1>{actor.name}</h1>

{actor.biography && (
<p>{actor.biography}</p>
)}

</div>

)

}
