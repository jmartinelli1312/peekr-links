"use client";

// Premium upsell — mirrors lib/widgets/premium_waitlist_modal.dart. Shown
// when a free user hits the 3-custom-peeklist cap and tries to create a
// 4th list. The "joining" state writes one row into premium_waitlist
// keyed on user_id (PK).

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase";
import type { ActionTexts } from "./i18n";

type Props = {
  open: boolean;
  onClose: () => void;
  texts: ActionTexts;
};

export default function PremiumWaitlistModal({ open, onClose, texts }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [alreadyJoined, setAlreadyJoined] = useState<boolean | null>(null);
  const [joining, setJoining] = useState(false);
  const [justJoined, setJustJoined] = useState(false);

  useEffect(() => setMounted(true), []);

  // Check if the viewer is already on the waitlist whenever the modal opens.
  useEffect(() => {
    if (!open) {
      setAlreadyJoined(null);
      setJustJoined(false);
      return;
    }
    (async () => {
      const { data: userResp } = await supabase.auth.getUser();
      const uid = userResp.user?.id;
      if (!uid) {
        setAlreadyJoined(false);
        return;
      }
      const { data } = await supabase
        .from("premium_waitlist")
        .select("user_id")
        .eq("user_id", uid)
        .maybeSingle();
      setAlreadyJoined(Boolean(data));
    })();
  }, [open]);

  // Scroll lock + Escape — same pattern as the other modals.
  useEffect(() => {
    if (!open) return;
    const scrollY = window.scrollY;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    return () => {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && !joining && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose, joining]);

  async function join() {
    if (joining) return;
    const { data: userResp } = await supabase.auth.getUser();
    const uid = userResp.user?.id;
    if (!uid) return;
    setJoining(true);
    try {
      const { error } = await supabase
        .from("premium_waitlist")
        .upsert({ user_id: uid }, { onConflict: "user_id" });
      if (error) {
        console.error("[PremiumWaitlist] join error", error);
        setJoining(false);
        return;
      }
      setAlreadyJoined(true);
      setJustJoined(true);
    } finally {
      setJoining(false);
    }
  }

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="pw-overlay"
      ref={overlayRef}
      onClick={e => e.target === overlayRef.current && !joining && onClose()}
      role="dialog"
      aria-modal="true"
    >
      <div className="pw-panel">
        <div className="pw-drag-handle" aria-hidden />

        <div className="pw-crown" aria-hidden>👑</div>

        <h2 className="pw-title">{texts.premiumTitle}</h2>
        <p className="pw-sub">{texts.premiumComingSoon}</p>

        <ul className="pw-benefits">
          <li><span aria-hidden>∞</span> {texts.premiumBenefitLists}</li>
          <li><span aria-hidden>📺</span> {texts.premiumBenefitPlatforms}</li>
          <li><span aria-hidden>✓</span> {texts.premiumBenefitBadge}</li>
        </ul>

        {alreadyJoined === null ? (
          <div className="pw-cta-loading" />
        ) : alreadyJoined ? (
          <div className="pw-already">
            ✓ {texts.premiumAlreadyJoined}
          </div>
        ) : (
          <button
            type="button"
            className="pw-cta"
            disabled={joining}
            onClick={join}
          >
            {joining ? "…" : texts.premiumJoin}
          </button>
        )}

        {justJoined && (
          <p className="pw-success">{texts.premiumJoinSuccess}</p>
        )}
      </div>

      <style>{`
        .pw-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,.75);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          z-index: 10001;
          display: flex; align-items: flex-end; justify-content: center;
        }
        @media (min-width: 640px) {
          .pw-overlay { align-items: center; padding: 24px; }
        }
        .pw-panel {
          background: #0E0B14;
          width: 100%; max-width: 460px;
          padding: 12px 24px 28px;
          border-radius: 24px 24px 0 0;
          color: #fff;
          display: flex; flex-direction: column; align-items: center;
        }
        @media (min-width: 640px) {
          .pw-panel { border-radius: 22px; }
        }
        .pw-drag-handle {
          width: 42px; height: 4px; border-radius: 99px;
          background: rgba(255,255,255,.22);
          margin: 0 auto 18px;
        }
        .pw-crown {
          width: 64px; height: 64px; border-radius: 50%;
          background: rgba(250,0,130,.14);
          display: flex; align-items: center; justify-content: center;
          font-size: 28px;
        }
        .pw-title {
          margin: 16px 0 4px; font-size: 22px; font-weight: 800;
        }
        .pw-sub {
          color: #FA0082; font-weight: 600; margin: 0 0 20px;
        }
        .pw-benefits {
          list-style: none; padding: 0; margin: 0 0 28px;
          width: 100%;
          display: flex; flex-direction: column; gap: 10px;
          font-size: 14px; color: rgba(255,255,255,.82);
        }
        .pw-benefits li {
          display: flex; align-items: center; gap: 12px;
          padding: 8px 12px;
          background: rgba(255,255,255,.04);
          border-radius: 10px;
        }
        .pw-benefits li span {
          color: #FA0082; font-weight: 700; min-width: 22px;
        }
        .pw-cta {
          width: 100%; padding: 14px;
          background: #FA0082; color: #fff;
          border: 0; border-radius: 14px;
          font-size: 15px; font-weight: 700;
          cursor: pointer;
        }
        .pw-cta:disabled { background: rgba(255,255,255,.12); cursor: not-allowed; }
        .pw-cta-loading {
          height: 48px; width: 100%;
        }
        .pw-already {
          display: flex; align-items: center; justify-content: center; gap: 6px;
          color: #FA0082; font-weight: 600; font-size: 15px;
          padding: 12px 0;
        }
        .pw-success {
          color: rgba(255,255,255,.55); font-size: 13px; text-align: center;
          margin: 12px 0 0;
        }
      `}</style>
    </div>,
    document.body
  );
}
