"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const BRAND = "#FA0082";

type Lang = "es" | "en" | "pt";

const I18N: Record<Lang, {
  loading: string;
  title: string;
  subtitle: string;
  createNew: string;
  titleLabel: string;
  titlePlaceholder: string;
  descriptionLabel: string;
  descriptionPlaceholder: string;
  publicLabel: string;
  privateLabel: string;
  titleRequired: string;
  createBtn: string;
  creating: string;
  totalLists: (n: number) => string;
  noLists: string;
  itemsCount: (n: number) => string;
  top5Badge: string;
  visPublic: string;
  visPrivate: string;
  confirmDelete: (t: string) => string;
  untitled: string;
}> = {
  es: {
    loading: "Cargando…",
    title: "Mis Peeklists",
    subtitle:
      "Curá tus propias listas desde la web. Las públicas aparecen en tu perfil y en Explore.",
    createNew: "Crear nueva",
    titleLabel: "Título",
    titlePlaceholder: "Mis thrillers favoritos",
    descriptionLabel: "Descripción (opcional)",
    descriptionPlaceholder: "¿De qué trata esta lista?",
    publicLabel: "Pública",
    privateLabel: "Privada",
    titleRequired: "El título es obligatorio",
    createBtn: "Crear peeklist",
    creating: "Creando…",
    totalLists: (n: number) => `${n} lista${n === 1 ? "" : "s"}`,
    noLists: "Aún no tenés peeklists. Creá la primera arriba.",
    itemsCount: (n: number) => `${n} título${n === 1 ? "" : "s"}`,
    top5Badge: "Top 5",
    visPublic: "Pública",
    visPrivate: "Privada",
    confirmDelete: (t: string) =>
      `¿Eliminar "${t}"? Esta acción no se puede deshacer.`,
    untitled: "Sin título",
  },
  en: {
    loading: "Loading…",
    title: "My Peeklists",
    subtitle:
      "Curate your own lists from the web. Public lists show up on your profile and in Explore.",
    createNew: "Create new",
    titleLabel: "Title",
    titlePlaceholder: "My favorite thrillers",
    descriptionLabel: "Description (optional)",
    descriptionPlaceholder: "What's in this list?",
    publicLabel: "Public",
    privateLabel: "Private",
    titleRequired: "Title is required",
    createBtn: "Create peeklist",
    creating: "Creating…",
    totalLists: (n: number) => `${n} list${n === 1 ? "" : "s"}`,
    noLists: "No peeklists yet. Create your first above.",
    itemsCount: (n: number) => `${n} item${n === 1 ? "" : "s"}`,
    top5Badge: "Top 5",
    visPublic: "Public",
    visPrivate: "Private",
    confirmDelete: (t: string) =>
      `Delete "${t}"? This cannot be undone.`,
    untitled: "Untitled",
  },
  pt: {
    loading: "Carregando…",
    title: "Minhas Peeklists",
    subtitle:
      "Crie suas próprias listas pela web. As públicas aparecem no seu perfil e em Explore.",
    createNew: "Criar nova",
    titleLabel: "Título",
    titlePlaceholder: "Meus thrillers favoritos",
    descriptionLabel: "Descrição (opcional)",
    descriptionPlaceholder: "Do que trata esta lista?",
    publicLabel: "Pública",
    privateLabel: "Privada",
    titleRequired: "O título é obrigatório",
    createBtn: "Criar peeklist",
    creating: "Criando…",
    totalLists: (n: number) => `${n} lista${n === 1 ? "" : "s"}`,
    noLists: "Ainda não há peeklists. Crie a primeira acima.",
    itemsCount: (n: number) => `${n} título${n === 1 ? "" : "s"}`,
    top5Badge: "Top 5",
    visPublic: "Pública",
    visPrivate: "Privada",
    confirmDelete: (t: string) =>
      `Excluir "${t}"? Esta ação não pode ser desfeita.`,
    untitled: "Sem título",
  },
};

type Peeklist = {
  id: string;
  title: string | null;
  description: string | null;
  cover_url: string | null;
  custom_cover_url: string | null;
  visibility: string | null;
  list_type: string | null;
  follower_count: number | null;
  updated_at: string | null;
  item_count?: number;
};

export default function MyPeeklistsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [peeklists, setPeeklists] = useState<Peeklist[]>([]);
  const [lang, setLang] = useState<Lang>("es");
  const t = I18N[lang];

  // Form state
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newVisibility, setNewVisibility] = useState<"public" | "private">(
    "public"
  );
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPeeklists = useCallback(async (uid: string) => {
    // Fetch peeklists I created. RLS allows owner SELECT regardless of
    // visibility, so this includes private ones too.
    const { data, error: e } = await supabase
      .from("peeklists")
      .select(
        "id, title, description, cover_url, custom_cover_url, visibility, list_type, follower_count, updated_at"
      )
      .eq("created_by", uid)
      .order("updated_at", { ascending: false });

    if (e) {
      setError(e.message);
      return;
    }

    const lists = (data ?? []) as Peeklist[];

    // Count items per peeklist in one round-trip.
    if (lists.length > 0) {
      const ids = lists.map((l) => l.id);
      const { data: itemRows } = await supabase
        .from("peeklist_items")
        .select("peeklist_id")
        .in("peeklist_id", ids);

      const counts: Record<string, number> = {};
      for (const r of (itemRows ?? []) as { peeklist_id: string }[]) {
        counts[r.peeklist_id] = (counts[r.peeklist_id] ?? 0) + 1;
      }
      for (const l of lists) {
        l.item_count = counts[l.id] ?? 0;
      }
    }

    setPeeklists(lists);
  }, []);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      setUserId(user.id);
      // Read the user's preferred app language to localize the index. Same
      // source of truth as mobile (profiles.language).
      const { data: prof } = await supabase
        .from("profiles")
        .select("language")
        .eq("id", user.id)
        .maybeSingle();
      const raw = (prof?.language as string | null) ?? "es";
      const normalized: Lang = raw.startsWith("en")
        ? "en"
        : raw.startsWith("pt")
          ? "pt"
          : "es";
      setLang(normalized);
      await loadPeeklists(user.id);
      setLoading(false);
    })();
  }, [router, loadPeeklists]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    const title = newTitle.trim();
    if (!title) {
      setError(t.titleRequired);
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const { data, error: e2 } = await supabase
        .from("peeklists")
        .insert({
          title,
          description: newDesc.trim() || null,
          visibility: newVisibility,
          created_by: userId,
          list_type: "custom",
        })
        .select("id")
        .single();
      if (e2) throw e2;
      setNewTitle("");
      setNewDesc("");
      setNewVisibility("public");
      // Send the user straight to the editor for the new peeklist.
      router.push(`/my-peeklists/${data!.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setCreating(false);
    }
  }

  async function handleDelete(id: string, title: string | null) {
    if (!confirm(t.confirmDelete(title || t.untitled))) {
      return;
    }
    setError(null);
    const { error: e } = await supabase
      .from("peeklists")
      .delete()
      .eq("id", id);
    if (e) {
      setError(e.message);
      return;
    }
    setPeeklists((prev) => prev.filter((p) => p.id !== id));
  }

  if (loading) {
    return <Center>{t.loading}</Center>;
  }

  return (
    <main className="page">
      <div className="container">
        <header className="hdr">
          <h1>{t.title}</h1>
          <p className="sub">{t.subtitle}</p>
        </header>

        {error && <div className="error">{error}</div>}

        <section className="card">
          <h2>{t.createNew}</h2>
          <form onSubmit={handleCreate} className="form">
            <label className="lbl">
              {t.titleLabel}
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder={t.titlePlaceholder}
                maxLength={80}
                disabled={creating}
              />
            </label>
            <label className="lbl">
              {t.descriptionLabel}
              <textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder={t.descriptionPlaceholder}
                maxLength={500}
                rows={3}
                disabled={creating}
              />
            </label>
            <div className="visrow">
              <label>
                <input
                  type="radio"
                  name="vis"
                  checked={newVisibility === "public"}
                  onChange={() => setNewVisibility("public")}
                  disabled={creating}
                />
                <span>{t.publicLabel}</span>
              </label>
              <label>
                <input
                  type="radio"
                  name="vis"
                  checked={newVisibility === "private"}
                  onChange={() => setNewVisibility("private")}
                  disabled={creating}
                />
                <span>{t.privateLabel}</span>
              </label>
            </div>
            <button type="submit" disabled={creating || !newTitle.trim()}>
              {creating ? t.creating : t.createBtn}
            </button>
          </form>
        </section>

        <section className="list">
          <h2>{t.totalLists(peeklists.length)}</h2>

          {peeklists.length === 0 && (
            <p className="empty">{t.noLists}</p>
          )}

          <ul>
            {peeklists.map((p) => {
              const cover = p.custom_cover_url || p.cover_url;
              return (
                <li key={p.id} className="row">
                  <Link href={`/my-peeklists/${p.id}`} className="rowLink">
                    <div
                      className="cover"
                      style={
                        cover
                          ? { backgroundImage: `url(${cover})` }
                          : undefined
                      }
                    >
                      {!cover && <span>📋</span>}
                    </div>
                    <div className="meta">
                      <div className="title">{p.title || t.untitled}</div>
                      <div className="muted">
                        {t.itemsCount(p.item_count ?? 0)} ·{" "}
                        {p.visibility === "private"
                          ? t.visPrivate
                          : t.visPublic}
                        {p.list_type === "top5" ? ` · ${t.top5Badge}` : ""}
                      </div>
                      {p.description && (
                        <div className="desc">{p.description}</div>
                      )}
                    </div>
                  </Link>
                  <button
                    type="button"
                    className="del"
                    onClick={() => handleDelete(p.id, p.title)}
                    title="Delete peeklist"
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <style jsx>{`
        .page {
          min-height: 100vh;
          background: #08080d;
          color: #fff;
          padding: 32px 16px 96px;
        }
        .container {
          max-width: 760px;
          margin: 0 auto;
        }
        .hdr {
          margin-bottom: 24px;
        }
        h1 {
          font-size: 28px;
          font-weight: 900;
          margin: 0 0 6px;
        }
        .sub {
          color: #fff8;
          font-size: 14px;
          margin: 0;
        }
        h2 {
          font-size: 16px;
          font-weight: 700;
          margin: 0 0 14px;
          color: #fff;
        }
        .error {
          background: #4a0820;
          border: 1px solid #ff4080;
          color: #ffd0e0;
          padding: 10px 12px;
          border-radius: 8px;
          margin-bottom: 16px;
          font-size: 13px;
        }
        .card {
          background: #11121a;
          border: 1px solid #ffffff14;
          border-radius: 14px;
          padding: 18px;
          margin-bottom: 28px;
        }
        .form {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .lbl {
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 13px;
          color: #fffa;
          font-weight: 600;
        }
        input[type="text"],
        textarea {
          background: #0a0a10;
          border: 1px solid #ffffff22;
          border-radius: 8px;
          color: #fff;
          padding: 10px 12px;
          font-size: 14px;
          font-family: inherit;
          resize: vertical;
        }
        input[type="text"]:focus,
        textarea:focus {
          outline: none;
          border-color: ${BRAND};
        }
        .visrow {
          display: flex;
          gap: 16px;
        }
        .visrow label {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          color: #fff;
          cursor: pointer;
        }
        button {
          background: ${BRAND};
          color: #fff;
          border: 0;
          border-radius: 10px;
          padding: 10px 16px;
          font-weight: 800;
          cursor: pointer;
          font-size: 14px;
          align-self: flex-start;
        }
        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .list {
          background: transparent;
        }
        .empty {
          color: #fff6;
          font-size: 14px;
        }
        ul {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .row {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #11121a;
          border: 1px solid #ffffff14;
          border-radius: 12px;
          padding: 10px;
          transition: border-color 0.15s;
        }
        .row:hover {
          border-color: #ffffff30;
        }
        .rowLink {
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 1;
          min-width: 0;
          text-decoration: none;
          color: inherit;
        }
        .cover {
          width: 56px;
          height: 56px;
          border-radius: 8px;
          background: #ffffff10 center/cover no-repeat;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          color: #fff8;
        }
        .meta {
          flex: 1;
          min-width: 0;
        }
        .title {
          font-weight: 700;
          font-size: 15px;
          color: #fff;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .muted {
          color: #fff6;
          font-size: 12px;
          margin-top: 2px;
        }
        .desc {
          color: #fff8;
          font-size: 12px;
          margin-top: 4px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .del {
          background: transparent;
          color: #ff6080;
          border: 1px solid #ff608030;
          width: 32px;
          height: 32px;
          padding: 0;
          border-radius: 8px;
          font-size: 14px;
          flex-shrink: 0;
        }
        .del:hover {
          background: #ff608020;
        }
      `}</style>
    </main>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#08080d",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 14,
      }}
    >
      {children}
    </div>
  );
}
