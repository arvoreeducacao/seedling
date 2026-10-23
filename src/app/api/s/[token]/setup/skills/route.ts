import { addSkills } from "@/lib/setup/store";
import { attempt, denied, setupAccess } from "@/lib/setup/access";
import { SETUP_LIMITS, SetupError, pastedSkill } from "@/lib/setup/validate";
import { readSkillZip } from "@/lib/setup/zip";

export const dynamic = "force-dynamic";

async function skillsFrom(req: Request) {
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("multipart/form-data")) {
    const length = Number(req.headers.get("content-length") ?? 0);
    if (length > SETUP_LIMITS.zipBytes + 64 * 1024) throw new SetupError("setup.zipTooBig", { mb: SETUP_LIMITS.zipBytes / 1024 / 1024 });
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!file || typeof file === "string") throw new SetupError("setup.zipChooseFile");
    if (file.size > SETUP_LIMITS.zipBytes) throw new SetupError("setup.zipTooBig", { mb: SETUP_LIMITS.zipBytes / 1024 / 1024 });
    return readSkillZip(Buffer.from(await file.arrayBuffer()), file.name);
  }
  const body = (await req.json().catch(() => null)) as { name?: unknown; content?: unknown } | null;
  if (!body) throw new SetupError("setup.zipOrSkillMd");
  return { skills: [pastedSkill(body.name, body.content)], skipped: [] };
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const access = await setupAccess((await params).token);
  if (!access) return denied();
  return attempt(access, async () => {
    const { skills, skipped } = await skillsFrom(req);
    await addSkills(access.session.id, skills);
    return { skipped };
  });
}
