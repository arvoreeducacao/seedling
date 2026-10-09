"use client";

import { useEffect } from "react";
import { Sprout } from "@/components/brand";
import ui from "@/components/workspace/ui.module.css";

export default function LiveError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const updated = /server action|chunk|loading/i.test(error.message);
  return (
    <div className={`${ui.root} ${ui.loading}`}>
      <div style={{ maxWidth: 420, display: "flex", flexDirection: "column", gap: 10 }}>
        <Sprout mood="worried" size={96} />
        <div className={ui.modalTitle} style={{ fontSize: 17 }}>{updated ? "The app was just updated" : "The live view hit an error"}</div>
        <p className={ui.muted} style={{ margin: 0, lineHeight: 1.6 }}>{updated ? "Reload to reconnect. The candidate's session keeps running and nothing they did was lost." : "The candidate's session keeps running. Try again, or reload the page."}</p>
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <button type="button" className={`${ui.btn} ${ui.btnPrimary}`} onClick={() => location.reload()}>Reload</button>
          {!updated && <button type="button" className={`${ui.btn} ${ui.btnGhost}`} onClick={reset}>Try again</button>}
        </div>
      </div>
    </div>
  );
}
