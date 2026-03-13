import { supabase } from "@/lib/supabase";

export default async function UserPage({ params }) {

const username = params.username

const { data } = await supabase
.from("profiles")
.select("*")
.eq("username", username)
.single()

if (!data) {
return <div>User not found</div>
}

return (

<div style={{padding:40}}>

<h1>@{data.username}</h1>

{data.display_name && (
<h2>{data.display_name}</h2>
)}

{data.bio && (
<p>{data.bio}</p>
)}

</div>

)

}
