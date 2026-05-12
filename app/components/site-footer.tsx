export default function SiteFooter() {
  return (
    <footer
      style={{
        background: "#0B0B0F",
        padding: "48px 20px 56px",
        display: "flex",
        justifyContent: "center",
        borderTop: "1px solid rgba(255,255,255,0.08)",
        marginTop: 64,
      }}
    >
      <div
        style={{
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          border: "1px solid rgb(224, 224, 224)",
          borderRadius: 12,
          padding: 20,
          maxWidth: 500,
          width: "100%",
          background: "rgb(255, 255, 255)",
          boxShadow: "rgba(0, 0, 0, 0.05) 0px 2px 8px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <img
            alt="Peekr on Product Hunt"
            src="https://ph-files.imgix.net/f58a4709-27f6-44cf-bb3d-46a086e7519f.png?auto=format&fit=crop&w=80&h=80"
            style={{
              width: 64,
              height: 64,
              borderRadius: 8,
              objectFit: "cover",
              flexShrink: 0,
            }}
          />
          <div style={{ flex: "1 1 0%", minWidth: 0 }}>
            <h3
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 600,
                color: "rgb(26, 26, 26)",
                lineHeight: 1.3,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              Peekr
            </h3>
            <p
              style={{
                margin: "4px 0 0",
                fontSize: 14,
                color: "rgb(102, 102, 102)",
                lineHeight: 1.4,
                overflow: "hidden",
                textOverflow: "ellipsis",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
              }}
            >
              The social network for movies & series lovers
            </p>
          </div>
        </div>
        <a
          href="https://www.producthunt.com/products/peekr-2?embed=true&utm_source=embed&utm_medium=post_embed"
          target="_blank"
          rel="noopener"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            marginTop: 12,
            padding: "8px 16px",
            background: "rgb(255, 97, 84)",
            color: "rgb(255, 255, 255)",
            textDecoration: "none",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Check it out on Product Hunt →
        </a>
      </div>
    </footer>
  );
}
