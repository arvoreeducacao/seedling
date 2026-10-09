"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { IconUpload } from "@/components/icons";

export function Uploader() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);

  async function send(file: File) {
    setError(null);
    if (!file.name.toLowerCase().endsWith(".zip")) {
      setError("Upload the challenge folder as a .zip file.");
      return;
    }
    setBusy(true);
    const body = new FormData();
    body.set("file", file);
    const res = await fetch("/api/admin/challenges", { method: "POST", body });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Upload failed. Try again.");
      return;
    }
    router.push(`/challenges/${json.id}`);
  }

  return (
    <div
      data-el="drop-zone"
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const file = e.dataTransfer.files[0];
        if (file) void send(file);
      }}
      style={{ position: "relative", border: `1px dashed ${over ? "var(--accent)" : "var(--border-strong)"}`, borderRadius: "var(--r-lg)", padding: "40px 16px", background: over ? "var(--accent-soft)" : "var(--surface)", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}
    >
      <span className="empty-icon" style={{ marginBottom: 6 }}><IconUpload size={18} /></span>
      <div style={{ color: "var(--text)", fontWeight: 500, fontSize: 13.5 }}>{busy ? "Reading the .zip…" : "Drop the challenge .zip here"}</div>
      <div className="faint" style={{ fontSize: 12 }}>brief, starter code, hidden tests, rubric · up to 50 MB</div>
      <input ref={input} type="file" accept=".zip,application/zip" style={{ position: "absolute", width: 1, height: 1, opacity: 0, overflow: "hidden" }} onChange={(e) => e.target.files?.[0] && send(e.target.files[0])} aria-label="Challenge .zip file" />
      <button type="button" className="btn" disabled={busy} onClick={() => input.current?.click()} style={{ marginTop: 10 }}>
        Choose file
      </button>
      {error && <div className="notice notice-err" role="alert" style={{ marginTop: 8 }}>{error}</div>}
    </div>
  );
}
