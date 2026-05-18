export default function SiteFooter() {
  return (
    <footer
      style={{
        background: "#0B0B0F",
        padding: "32px 20px 40px",
        display: "flex",
        justifyContent: "center",
        borderTop: "1px solid rgba(255,255,255,0.08)",
        marginTop: 64,
      }}
    >
      <a
        href="https://www.producthunt.com/products/peekr-2?embed=true&utm_source=embed&utm_medium=footer"
        target="_blank"
        rel="noopener"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 16px",
          borderRadius: 999,
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(255,255,255,0.03)",
          color: "rgba(255,255,255,0.65)",
          fontSize: 13,
          fontWeight: 500,
          textDecoration: "none",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          lineHeight: 1,
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 40 40"
          fill="none"
          aria-hidden="true"
          style={{ flexShrink: 0 }}
        >
          <circle cx="20" cy="20" r="20" fill="#DA552F" />
          <path
            d="M22.668 20H17v-6h5.668c1.838 0 3.332 1.346 3.332 3s-1.494 3-3.332 3zm.332-10H13v20h4v-6h6c3.866 0 7-3.134 7-7s-3.134-7-7-7z"
            fill="#FFFFFF"
          />
        </svg>
        <span>
          Featured on{" "}
          <span style={{ color: "#FFFFFF", fontWeight: 600 }}>Product Hunt</span>
        </span>
        <span style={{ color: "#DA552F", fontWeight: 600 }}>→</span>
      </a>
    </footer>
  );
}
