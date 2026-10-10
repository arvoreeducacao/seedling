import { NextResponse } from "next/server";
import { audit, currentAdmin } from "@/lib/auth";
import { importZip, runChecks } from "@/lib/challenges/store";
import { messageOf } from "@/lib/i18n";
import { i18nFromRequest } from "@/lib/i18n/server";

export async function POST(req: Request) {
  const { t } = i18nFromRequest(req);
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ error: t("error.unauthorized") }, { status: 401 });
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: t("challenges.zipRequired") }, { status: 400 });
  if (file.size > 60 * 1024 * 1024) return NextResponse.json({ error: t("challenges.zipOverLimit") }, { status: 400 });
  try {
    const id = await importZip(Buffer.from(await file.arrayBuffer()), admin.email);
    await audit(admin.email, "challenges.audit.imported", id);
    void runChecks(id);
    return NextResponse.json({ id });
  } catch (error) {
    return NextResponse.json({ error: messageOf(error, t, "challenges.zipUnreadable") }, { status: 400 });
  }
}
