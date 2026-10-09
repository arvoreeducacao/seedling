import { Sprout } from "@/components/brand";

export function Empty({ title, text, action, icon, art }: { title: string; text?: string; action?: React.ReactNode; icon?: React.ReactNode; art?: React.ReactNode }) {
  return (
    <div className="empty">
      {art ?? (icon ? <span className="empty-icon">{icon}</span> : <Sprout mood="sleeping" size={112} />)}
      <div className="display" style={{ fontSize: 20, maxWidth: "22ch", marginTop: icon ? 0 : 12 }}>{title}</div>
      {text && <p className="muted" style={{ maxWidth: "48ch", lineHeight: 1.6, marginTop: 8 }}>{text}</p>}
      {action && <div style={{ marginTop: 18, display: "flex", gap: 8 }}>{action}</div>}
    </div>
  );
}
