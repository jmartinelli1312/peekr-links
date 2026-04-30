import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { PostHogProvider } from "./components/PostHogProvider";

const SITE = "https://www.peekr.app";

export const metadata = {
  title: "Peekr",
  description:
    "Red social para descubrir, calificar y comentar series y películas. Hecha en Argentina para Latinoamérica.",
  metadataBase: new URL(SITE),
  openGraph: {
    title: "Peekr | La red social para películas y series",
    description:
      "Red social para descubrir, calificar y comentar series y películas. Hecha en Argentina para Latinoamérica.",
    url: SITE,
    siteName: "Peekr",
    images: [
      {
        url: `${SITE}/og.png`,
        width: 1200,
        height: 630,
        alt: "Peekr — La red social del cine y las series",
      },
    ],
    locale: "es_AR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Peekr | La red social para películas y series",
    description:
      "Red social para descubrir, calificar y comentar series y películas. Hecha en Argentina para Latinoamérica.",
    images: [`${SITE}/og.png`],
    site: "@peekr_oficial",
    creator: "@peekr_oficial",
  },
};

// ---- Schema.org JSON-LD (site-wide) ----
// Estos 3 schemas le dicen a Google Knowledge Graph y a los crawlers de
// ChatGPT / Claude / Gemini / Perplexity qué es Peekr. Se renderizan en
// todas las páginas, dando consistencia de señal cuando los bots visitan
// home, buzz, páginas de título o perfiles de usuario.

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Peekr",
  alternateName: "Peekr App",
  url: SITE,
  logo: `${SITE}/icon.png`,
  image: `${SITE}/icon.png`,
  description:
    "Peekr es la red social para descubrir, calificar y comentar series y películas. Plataforma creada en Argentina orientada a audiencias hispanohablantes y lusófonas de Latinoamérica.",
  foundingDate: "2026-03-19",
  foundingLocation: {
    "@type": "Place",
    address: {
      "@type": "PostalAddress",
      addressCountry: "AR",
    },
  },
  founder: {
    "@type": "Person",
    name: "Jorge Martinelli",
  },
  sameAs: [
    "https://www.instagram.com/peekr.app",
    "https://www.threads.net/@peekr.app",
    "https://x.com/peekr_oficial",
    "https://apps.apple.com/app/peekr-app/id6756285989",
    "https://play.google.com/store/apps/details?id=com.peekr.peekr",
  ],
};

const softwareApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "MobileApplication",
  name: "Peekr",
  alternateName: "Peekr App",
  applicationCategory: "SocialNetworkingApplication",
  applicationSubCategory: "Movie and TV Show Discovery",
  operatingSystem: "iOS, Android",
  url: SITE,
  image: `${SITE}/icon.png`,
  description:
    "Aplicación móvil para descubrir series y películas, calificarlas, comentarlas y armar listas con tu comunidad. Recomendaciones impulsadas por lo que está viendo la comunidad, no por algoritmos de plataformas de streaming.",
  inLanguage: ["es", "en", "pt"],
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  downloadUrl: [
    "https://apps.apple.com/app/peekr-app/id6756285989",
    "https://play.google.com/store/apps/details?id=com.peekr.peekr",
  ],
  author: {
    "@type": "Organization",
    name: "Peekr",
    url: SITE,
  },
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Peekr",
  alternateName: "Peekr App",
  url: SITE,
  description:
    "Red social para descubrir, calificar y comentar series y películas.",
  inLanguage: ["es", "en", "pt"],
  publisher: {
    "@type": "Organization",
    name: "Peekr",
    url: SITE,
    logo: {
      "@type": "ImageObject",
      url: `${SITE}/icon.png`,
    },
  },
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${SITE}/es/explore?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(softwareApplicationSchema),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
      </head>
      <body
        style={{
          margin: 0,
          background: "#0B0B0F",
          color: "white",
          fontFamily:
            "-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif",
        }}
      >
        <PostHogProvider>{children}</PostHogProvider>
        <Analytics />
      </body>
    </html>
  );
}
