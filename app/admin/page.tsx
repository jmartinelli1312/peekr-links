"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type AdminState = "loading" | "authorized" | "unauthorized";

export default function AdminPage() {
  const router = useRouter();
  const [state, setState] = useState<AdminState>("loading");
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    let mounted = true;

    async function checkAccess() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!mounted) return;

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      setEmail(user.email ?? "");

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .maybeSingle();

      if (!mounted) return;

      if (profileError || !profile?.is_admin) {
        setState("unauthorized");
        router.replace("/");
        return;
      }

      setState("authorized");
    }

    checkAccess();

    return () => {
      mounted = false;
    };
  }, [router]);

  if (state === "loading") {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          background: "#0b0b0f",
          padding: 24,
        }}
      >
        <div>Validando acceso...</div>
      </main>
    );
  }

  if (state !== "authorized") {
    return null;
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        color: "white",
        background: "#0b0b0f",
        padding: 24,
      }}
    >
      <h1 style={{ marginTop: 0 }}>Admin Dashboard</h1>
      <p>Acceso autorizado{email ? ` · ${email}` : ""}</p>
    </main>
  );
}
