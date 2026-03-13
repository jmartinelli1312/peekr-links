export const dynamic = "force-dynamic";

import { supabase } from "@/lib/supabase";

type Params = {
  params: {
    username: string;
  };
};

async function getUser(username: string) {
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username)
    .single();

  return data;
}

export default async function UserPage({ params }: Params) {

  const user = await getUser(params.username);

  if (!user) return <div>User not found</div>;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "40px",
      }}
    >
      
      {/* HEADER */}

      <section style={{ display: "flex", gap: "20px", alignItems: "center" }}>
        
        {user.avatar_url && (
          <img
            src={user.avatar_url}
            style={{
              width: "90px",
              height: "90px",
              borderRadius: "50%",
            }}
          />
        )}

        <div>

          <h1 style={{ margin: 0 }}>
            @{user.username}
          </h1>

          {user.display_name && (
            <div style={{ opacity: 0.7 }}>
              {user.display_name}
            </div>
          )}

        </div>

      </section>

      {/* FUTURE CONTENT */}

      <section>

        <h2>Activity</h2>

        <div style={{ opacity: 0.7 }}>
          Ratings, lists and activity will appear here.
        </div>

      </section>

    </div>
  );
}
