"use client";

import { useEffect } from "react";
import { Sprout } from "@/components/brand";
import ui from "@/components/workspace/ui.module.css";

export default function WorkspaceError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className={`${ui.root} ${ui.loading}`}>
      <div style={{ maxWidth: 420, display: "flex", flexDirection: "column", gap: 10 }}>
        <Sprout mood="worried" size={96} />
        <div className={ui.modalTitle} style={{ fontSize: 17 }}>Something went wrong on this screen</div>
        <p className={ui.muted} style={{ margin: 0, lineHeight: 1.6 }}>Your files and your timer are safe in the sandbox. Reload to reconnect.</p>
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <button type="button" className={`${ui.btn} ${ui.btnPrimary}`} onClick={() => location.reload()}>Reload</button>
          <button type="button" className={`${ui.btn} ${ui.btnGhost}`} onClick={reset}>Try again</button>
        </div>
      </div>
    </div>
  );
}
