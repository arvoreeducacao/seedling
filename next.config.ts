import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: { root: path.resolve(".") },
  serverExternalPackages: ["dockerode", "ssh2", "cpu-features", "@libsql/client", "libsql", "ws", "adm-zip"],
  poweredByHeader: false,
  images: { unoptimized: true },
  async redirects() {
    const moved: [string, string][] = [
      ["/entrar", "/login"],
      ["/sessoes", "/sessions"],
      ["/sessoes/nova", "/sessions/new"],
      ["/sessoes/:id", "/sessions/:id"],
      ["/sessoes/:id/relatorio", "/sessions/:id/report"],
      ["/desafios", "/challenges"],
      ["/desafios/novo", "/challenges/new"],
      ["/desafios/:id", "/challenges/:id"],
      ["/config", "/settings"],
      ["/vagas", "/sessions"],
      ["/vagas/:path*", "/sessions"],
    ];
    return moved.map(([source, destination]) => ({ source, destination, permanent: true }));
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};

export default nextConfig;
