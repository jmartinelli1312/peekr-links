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
      <body style={{ background: "#000000", color: "#ffffff", margin: 0 }}>

        {/* NAVBAR */}
        <header
          style={{
            width: "100%",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            background: "#000000",
          }}
        >
          <div
            style={{
              maxWidth: "1200px",
              margin: "0 auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "20px",
            }}
          >
            {/* LOGO */}
            <Link
              href="/"
              style={{
                fontSize: "24px",
                fontWeight: "700",
                color: "#ff2bd6",
                textDecoration: "none",
              }}
            >
              Peekr
            </Link>

            {/* NAV */}
            <nav
              style={{
                display: "flex",
                gap: "24px",
                fontSize: "14px",
              }}
            >
              <Link href="/explore" style={{ color: "#ffffff", textDecoration: "none" }}>
                Explore
              </Link>

              <Link href="/trending" style={{ color: "#ffffff", textDecoration: "none" }}>
                Trending
              </Link>

              <Link href="/top" style={{ color: "#ffffff", textDecoration: "none" }}>
                Top
              </Link>
            </nav>
          </div>
        </header>

        {/* PAGE */}
        <main
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            padding: "40px 20px",
          }}
        >
          {children}
        </main>

      </body>
    </html>
  );
}
