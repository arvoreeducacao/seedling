import { displayName, initials } from "@/lib/format";

const tints = ["var(--accent-soft)", "var(--cand-soft)", "var(--warn-soft)", "var(--err-soft)"];
const inks = ["var(--accent-text)", "var(--cand)", "var(--warn)", "var(--err)"];

function hash(text: string) {
  let h = 0;
  for (const c of text) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % tints.length;
}

export function Person({ email, name, sub, avatar, dim }: { email: string; name?: string | null; sub?: React.ReactNode; avatar?: boolean; dim?: boolean }) {
  const label = displayName(email, name);
  const i = hash(email);
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
      {avatar && <span className="avatar" style={{ background: tints[i], color: inks[i] }}>{initials(label)}</span>}
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontWeight: 500, color: dim ? "var(--text-2)" : undefined, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
        {sub && <span className="faint" style={{ display: "block", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</span>}
      </span>
    </span>
  );
}
