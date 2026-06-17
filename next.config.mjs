import createNextIntlPlugin from "next-intl/plugin";

// Point the plugin at our request config module.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/**
 * Security headers applied to every response.
 *
 *   X-Frame-Options DENY            — block embedding in iframes (clickjacking)
 *   X-Content-Type-Options nosniff  — disable MIME sniffing
 *   Referrer-Policy                 — only send origin to cross-site
 *   Permissions-Policy              — drop powerful APIs we don't use
 *   Strict-Transport-Security       — only emitted in production
 *
 * CSP is intentionally NOT enforced yet — Next.js still ships inline
 * scripts for hydration and we'd need a nonce-based pipeline to avoid
 * breaking the app. Worth revisiting once we move to fully static
 * server components or accept the nonce overhead.
 */
const securityHeaders = [
  { key: "X-Frame-Options",         value: "DENY" },
  { key: "X-Content-Type-Options",  value: "nosniff" },
  { key: "Referrer-Policy",         value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
];

if (process.env.NODE_ENV === "production") {
  securityHeaders.push({
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  });
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "placehold.co" },
      { protocol: "https", hostname: "dummyimage.com" },
    ],
  },
  experimental: {
    // Cover 6 MB image uploads + form overhead. Default in Next.js is
    // 1 MB which silently truncated multipart bodies and made the
    // announcement/news upload forms hang on `pending` without ever
    // reaching the server action handler.
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
  async headers() {
    return [
      // Security headers on every response.
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      // Static assets bundled by Next.js are content-hashed in the URL,
      // so we can safely tell CDNs and browsers to keep them forever.
      {
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      // Repo-shipped images in /public/images/ (logos, backgrounds, etc.)
      // don't change between deploys, so 1 year cache + immutable.
      {
        source: "/images/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
