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
      <body className="bg-black text-white">

        {/* NAVBAR */}
        <header className="w-full border-b border-white/10">
          <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">

            {/* LOGO */}
            <Link href="/" className="text-2xl font-bold tracking-tight">
              Peekr
            </Link>

            {/* NAV LINKS */}
            <nav className="flex gap-6 text-sm text-white/80">
              <Link href="/explore">Explore</Link>
              <Link href="/trending">Trending</Link>
              <Link href="/top">Top</Link>
            </nav>

          </div>
        </header>

        {/* PAGE CONTENT */}
        <main className="max-w-6xl mx-auto px-6 py-10">
          {children}
        </main>

      </body>
    </html>
  );
}
