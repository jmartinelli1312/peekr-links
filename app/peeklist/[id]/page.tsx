import { supabase } from "@/lib/supabase";

export default async function PeeklistPage({ params }) {

const id = params.id

const { data } = await supabase
.from("peeklists")
.select("*")
.eq("id", id)
.single()

if (!data) {
return <div>Peeklist not found</div>
}

return (

<div style={{padding:40}}>

<h1>{data.title}</h1>

{data.description && (
<p>{data.description}</p>
)}

</div>

)

}
