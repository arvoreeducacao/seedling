import { and, count, eq, isNull } from "drizzle-orm";
import { Sidebar } from "@/components/sidebar";
import { Hotkey } from "@/components/hotkey";
import { MotionProvider } from "@/components/motion";
import { requireAdmin } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { monthSpend } from "@/lib/gateway";
import { displayName, initials, money } from "@/lib/format";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const [[sessions], [challenges], [live], spent] = await Promise.all([
    db.select({ n: count() }).from(schema.sessions).where(isNull(schema.sessions.practiceOf)),
    db.select({ n: count() }).from(schema.challenges),
    db.select({ n: count() }).from(schema.sessions).where(and(eq(schema.sessions.status, "running"), isNull(schema.sessions.practiceOf))),
    monthSpend(),
  ]);
  return (
    <MotionProvider>
      <div style={{ display: "flex", minHeight: "100vh" }}>
        <Hotkey keyName="c" href="/sessions/new" />
        <Sidebar
          email={admin.email}
          name={displayName(admin.email, admin.name)}
          org={env.orgName}
          initials={initials(admin.name ?? admin.email)}
          live={live.n}
          spent={`${money(spent)} of $${env.monthlyBudgetUsd}`}
          budgetPct={(spent / env.monthlyBudgetUsd) * 100}
          counts={{ sessions: sessions.n, challenges: challenges.n }}
        />
        <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>{children}</main>
      </div>
    </MotionProvider>
  );
}
