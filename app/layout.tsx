import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "Peekr",
  description: "Watch. Rate. Share.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          background: "#000",
          color: "#fff",
          fontFamily:
            "-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif",
        }}
      >
        {/* NAVBAR */}
        <header
          style={{
            position: "sticky",
            top: 0,
            zIndex: 50,
            background: "rgba(0,0,0,0.85)",
            backdropFilter: "blur(10px)",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div
            style={{
              maxWidth: "1200px",
              margin: "0 auto",
              padding: "18px 24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            {/* LOGO */}
            <Link
              href="/"
              style={{
                fontSize: "26px",
                fontWeight: 800,
                letterSpacing: "-0.02em",
                color: "#FA0082",
                textDecoration: "none",
              }}
            >
              Peekr
            </Link>

            {/* NAV LINKS */}
            <nav
              style={{
                display: "flex",
                gap: "28px",
                fontSize: "15px",
                fontWeight: 500,
              }}
            >
              <Link
                href="/explore"
                style={{
                  color: "#fff",
                  textDecoration: "none",
                }}
              >
                Explore
              </Link>

              <Link
                href="/trending"
                style={{
                  color: "#fff",
                  textDecoration: "none",
                }}
              >
                Trending
              </Link>

              <Link
                href="/top"
                style={{
                  color: "#fff",
                  textDecoration: "none",
                }}
              >
                Top
              </Link>
            </nav>
          </div>
        </header>

        {/* PAGE CONTENT */}
        <main
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            padding: "60px 24px",
          }}
        >
          {children}
        </main>
      </body>
    </html>
  );
}
