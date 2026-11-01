import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

/** Origen de la API (se incrusta al compilar): el navegador solo puede hablar con la tienda y con ella. */
const apiOrigin = new URL(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").origin;

/**
 * Política de contenido. `'unsafe-inline'` en scripts es el costo de las páginas pre-renderizadas de Next
 * (sus scripts de arranque van en línea): usar nonces obligaría a renderizar todo en cada pedido. A cambio,
 * se cierra todo lo demás: sin plugins, sin iframes ajenos, sin formularios hacia afuera, sin <base>.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProduction ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${apiOrigin}`,
  "font-src 'self' data:",
  `connect-src 'self' ${apiOrigin}`,
  "media-src 'self' blob:", // vista previa de la cámara al escanear códigos
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isProduction && apiOrigin.startsWith("https://") ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // La cámara se usa para fotografiar productos y leer códigos de barras; nada más que la tienda la puede pedir.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(isProduction ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
];

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone", // imagen de producción mínima (ver Dockerfile)
  poweredByHeader: false,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // El service worker nunca debe quedar cacheado, o las actualizaciones no llegan a los dispositivos.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
