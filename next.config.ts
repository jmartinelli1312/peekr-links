import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/index.html",
        destination: "/",
        permanent: true,
      },
      // Legacy /xx/login and /xx/signup → root (these pages live outside [lang])
      {
        source: "/:lang(es|en|pt)/login",
        destination: "/login",
        permanent: true,
      },
      {
        source: "/:lang(es|en|pt)/signup",
        destination: "/signup",
        permanent: true,
      },
      // Legacy /xx/user/username → /xx/u/username
      {
        source: "/:lang(es|en|pt)/user/:username",
        destination: "/:lang/u/:username",
        permanent: true,
      },
    ];
  },

  async headers() {
    return [
      {
        source: "/apple-app-site-association",
        headers: [
          { key: "Content-Type", value: "application/json" },
          {
            key: "Cache-Control",
            value: "public, max-age=300, must-revalidate",
          },
        ],
      },
      {
        source: "/.well-known/apple-app-site-association",
        headers: [
          { key: "Content-Type", value: "application/json" },
          {
            key: "Cache-Control",
            value: "public, max-age=300, must-revalidate",
          },
        ],
      },
      {
        source: "/.well-known/assetlinks.json",
        headers: [
          { key: "Content-Type", value: "application/json" },
          {
            key: "Cache-Control",
            value: "public, max-age=300, must-revalidate",
          },
        ],
      },
    ];
  },

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
      },
    ],
  },
};

export default nextConfig;
