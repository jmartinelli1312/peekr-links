import "./globals.css";
import { Analytics } from "@vercel/analytics/next";

export const metadata = {
  title: "Peekr",
  description: "The social network for movies and series",
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
          background: "#0B0B0F",
          color: "white",
          fontFamily:
            "-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif",
        }}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}
