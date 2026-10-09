"use client";

import Link from "next/link";
import { Sprout } from "@/components/brand";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="shell shell-body" style={{ alignItems: "center", textAlign: "center", paddingTop: 96 }}>
      <Sprout mood="worried" size={160} />
      <div>
        <h1 className="display" style={{ fontSize: 36 }}>Something broke</h1>
        <p className="muted" style={{ marginTop: 12, maxWidth: "52ch", lineHeight: 1.6 }}>This page hit an error on the server. Try again; if it keeps happening, check the server logs{error.digest ? <> for <span className="mono">{error.digest}</span></> : null}.</p>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn btn-primary btn-lg" onClick={reset}>Try again</button>
        <Link href="/" className="btn btn-lg">Back to overview</Link>
      </div>
    </div>
  );
}
