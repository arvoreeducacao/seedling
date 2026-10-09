import fs from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

export const alt = "Seedling: coding interviews for engineers who work with AI agents";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-static";

async function googleFont(family: string) {
  const css = await fetch(`https://fonts.googleapis.com/css2?family=${family}`).then((r) => r.text());
  const url = css.match(/src:\s*url\(([^)]+)\)\s*format\('(?:truetype|opentype)'\)/)?.[1];
  if (!url) return null;
  return fetch(url).then((r) => r.arrayBuffer());
}

const stars = Array.from({ length: 70 }, (_, i) => ({
  x: (i * 173) % 1200,
  y: (i * 97 + (i % 7) * 41) % 630,
  r: i % 9 === 0 ? 3 : i % 3 === 0 ? 2 : 1.4,
  o: 0.25 + ((i * 37) % 60) / 100,
}));

export default async function OpengraphImage() {
  const [font, body, mark] = await Promise.all([
    googleFont("Unbounded:wght@800").catch(() => null),
    googleFont("Inter:wght@500").catch(() => null),
    fs.readFile(path.join(process.cwd(), "src/components/brand/logo-mark.svg"), "utf8"),
  ]);
  const markSrc = `data:image/svg+xml;base64,${Buffer.from(mark).toString("base64")}`;
  const display = font ? "Unbounded" : "sans-serif";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "radial-gradient(circle at 18% 12%, #2d2f7a 0%, #16183a 38%, #0e0f2d 70%)", color: "#ffffff", fontFamily: body ? "Inter" : "sans-serif" }}>
        {stars.map((s, i) => (
          <div key={i} style={{ position: "absolute", left: s.x, top: s.y, width: s.r * 2, height: s.r * 2, borderRadius: 999, background: "#ffffff", opacity: s.o }} />
        ))}
        <div style={{ position: "absolute", right: -120, bottom: -160, width: 620, height: 620, borderRadius: 999, background: "radial-gradient(circle, rgba(51,168,114,0.35) 0%, rgba(14,15,45,0) 70%)" }} />
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px 72px", width: 760 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <img src={markSrc} width={64} height={64} />
            <div style={{ fontFamily: display, fontSize: 40, letterSpacing: -1 }}>seedling</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <div style={{ fontFamily: display, fontSize: 58, lineHeight: 1, letterSpacing: -1.5, textTransform: "uppercase", display: "flex", flexDirection: "column" }}>
              <span>Hire people</span>
              <span>who build</span>
              <span style={{ color: "#8b93ff" }}>with AI agents</span>
            </div>
            <div style={{ fontSize: 26, color: "#babcd9", lineHeight: 1.4, maxWidth: 700 }}>Live coding interviews with Claude Code in the room.</div>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            {["Claude Code sandbox", "Parallel agents", "Live view and replay"].map((t) => (
              <div key={t} style={{ display: "flex", padding: "8px 16px", borderRadius: 999, border: "1px solid rgba(186,188,217,0.35)", color: "#e3e4f4", fontSize: 18, whiteSpace: "nowrap" }}>{t}</div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, paddingRight: 40 }}>
          <img src={markSrc} width={360} height={360} />
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        ...(body ? [{ name: "Inter", data: body, weight: 500 as const, style: "normal" as const }] : []),
        ...(font ? [{ name: "Unbounded", data: font, weight: 800 as const, style: "normal" as const }] : []),
      ],
    },
  );
}
