import { countTokens } from "@/lib/gateway";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return countTokens(req);
}
