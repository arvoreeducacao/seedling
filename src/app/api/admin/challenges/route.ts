import { NextResponse } from "next/server";
import { audit, currentAdmin } from "@/lib/auth";
import { importZip, runChecks } from "@/lib/challenges/store";

export async function POST(req: Request) {
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "upload a .zip file" }, { status: 400 });
  if (file.size > 60 * 1024 * 1024) return NextResponse.json({ error: "the .zip is over 60 MB" }, { status: 400 });
  try {
    const id = await importZip(Buffer.from(await file.arrayBuffer()), admin.email);
    await audit(admin.email, "imported challenge", id);
    void runChecks(id);
    return NextResponse.json({ id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "could not read the .zip" }, { status: 400 });
  }
}
