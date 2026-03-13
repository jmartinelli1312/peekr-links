"use client";

import { useRef } from "react";

export default function HorizontalScroller({
  children,
}: {
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function scrollLeft() {
    if (!ref.current) return;
    ref.current.scrollBy({ left: -400, behavior: "smooth" });
  }

  function scrollRight() {
    if (!ref.current) return;
    ref.current.scrollBy({ left: 400, behavior: "smooth" });
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={scrollLeft}
        style={{
          position: "absolute",
          left: -10,
          top: "40%",
          zIndex: 2,
          background: "rgba(0,0,0,0.7)",
          border: "none",
          color: "#fff",
          width: 36,
          height: 36,
          borderRadius: 8,
          cursor: "pointer",
        }}
      >
        ‹
      </button>

      <div
        ref={ref}
        style={{
          display: "flex",
          gap: 16,
          overflowX: "auto",
          scrollBehavior: "smooth",
          paddingBottom: 10,
        }}
      >
        {children}
      </div>

      <button
        onClick={scrollRight}
        style={{
          position: "absolute",
          right: -10,
          top: "40%",
          zIndex: 2,
          background: "rgba(0,0,0,0.7)",
          border: "none",
          color: "#fff",
          width: 36,
          height: 36,
          borderRadius: 8,
          cursor: "pointer",
        }}
      >
        ›
      </button>
    </div>
  );
}
