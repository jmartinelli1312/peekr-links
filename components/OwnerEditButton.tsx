"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Renders an "Edit" link to /my-peeklists/[id] only when the currently
 * logged-in user matches `ownerId`. Used on the public peeklist viewer
 * page so the owner gets a one-tap shortcut to the editor.
 *
 * Server-side knows the owner uuid (peeklists.created_by) but not who's
 * viewing — that's resolved here client-side via supabase.auth.getUser().
 */
export default function OwnerEditButton({
  peeklistId,
  ownerId,
  label,
  className,
}: {
  peeklistId: string;
  ownerId: string | null | undefined;
  label: string;
  className?: string;
}) {
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!ownerId) return;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      setIsOwner(!!user && user.id === ownerId);
    })();
    return () => {
      cancelled = true;
    };
  }, [ownerId]);

  if (!isOwner) return null;

  return (
    <Link href={`/my-peeklists/${peeklistId}`} className={className}>
      {label}
    </Link>
  );
}
