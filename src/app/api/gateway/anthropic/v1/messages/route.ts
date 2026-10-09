import { forwardMessages } from "@/lib/gateway";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return forwardMessages(req, "terminal");
}
