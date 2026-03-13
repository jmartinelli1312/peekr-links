export const dynamic = "force-dynamic";

import { supabase } from "@/lib/supabase";

export default async function TestSupabase() {
  const { data, error } = await supabase
    .from("profiles")
    .select("username")
    .limit(5);

  return (
    <div style={{ padding: 40 }}>
      <h1>Supabase Test</h1>

      <h2>Data:</h2>
      <pre>{JSON.stringify(data, null, 2)}</pre>

      <h2>Error:</h2>
      <pre>{JSON.stringify(error, null, 2)}</pre>
    </div>
  );
}
