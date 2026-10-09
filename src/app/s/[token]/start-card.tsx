"use client";

import { useActionState } from "react";
import { ArrowRight } from "@phosphor-icons/react";
import ui from "@/components/workspace/ui.module.css";
import css from "./landing.module.css";
import { begin } from "./actions";

export function StartCard({ token, expires }: { token: string; expires: string }) {
  const [error, action, pending] = useActionState(begin.bind(null, token), null);
  return (
    <form action={action}>
      <label data-el="consent" className={css.consent}>
        <input type="checkbox" name="consent" required className={ui.check} style={{ marginTop: 2 }} />
        I read the rules and agree to the session being recorded.
      </label>
      {error && <div className={css.error} role="alert">{error}</div>}
      <button data-el="start" className={`${ui.btn} ${ui.btnPrimary} ${css.cta}`} disabled={pending}>
        {pending ? <><span className={ui.spinner} style={{ width: 14, height: 14, borderTopColor: "#fff" }} /> Starting your sandbox…</> : <>Start and begin the clock <ArrowRight size={14} weight="bold" /></>}
      </button>
      <div className={ui.faint} style={{ textAlign: "center", fontSize: 11.5, marginTop: 10 }}>Link valid until {expires} · works in one browser once you start</div>
    </form>
  );
}
