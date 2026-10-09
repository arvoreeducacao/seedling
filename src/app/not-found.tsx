import Link from "next/link";
import { Sprout, Starfield } from "@/components/brand";

export default function NotFound() {
  return (
    <main className="stage" style={{ overflowX: "clip" }}>
      <Starfield stars={120} aurora />
      <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 20 }}>
        <Sprout mood="worried" size={160} />
        <h1 className="display stage-title" style={{ fontSize: "clamp(40px, 5vw, 72px)" }}>Nothing grows here</h1>
        <p style={{ fontSize: 16, color: "var(--text-2)", maxWidth: 420, lineHeight: 1.6 }}>This page doesn&apos;t exist. If you followed an invite link, it may have expired or already been used.</p>
        <Link href="/" className="btn btn-primary btn-lg">Go home</Link>
      </div>
    </main>
  );
}
