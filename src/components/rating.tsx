"use client";

import { useState } from "react";

const words = ["no score", "weak", "ok", "good", "strong"];

export function Rating({ name, label, initial }: { name: string; label: string; initial: number }) {
  const [value, setValue] = useState(initial);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <input type="hidden" name={name} value={value} />
      <span className="muted truncate" style={{ flex: 1 }}>{label}</span>
      <span className="faint" style={{ fontSize: 11.5, width: 44, textAlign: "right" }}>{value ? words[value] : ""}</span>
      <div role="radiogroup" aria-label={label} style={{ display: "flex", gap: 3 }}>
        {[1, 2, 3, 4].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} · ${words[n]}`}
            title={`${n} · ${words[n]}`}
            onClick={() => setValue(value === n ? 0 : n)}
            style={{ width: 22, height: 20, padding: "7px 0", background: "transparent", border: 0, display: "flex" }}
          >
            <span style={{ width: "100%", height: 6, borderRadius: 3, background: n <= value ? "var(--accent)" : "rgba(255,255,255,.1)", transition: "background .12s" }} />
          </button>
        ))}
      </div>
    </div>
  );
}
