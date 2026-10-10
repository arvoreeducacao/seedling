import { hasKey, type T } from "@/lib/i18n";
import type { ChallengeCheck, ChallengeCheckMessage } from "@/lib/db/schema";

function say(t: T, message: ChallengeCheckMessage) {
  return hasKey(message.key) ? t(message.key, message.params) : message.key;
}

export function checkTitle(t: T, check: ChallengeCheck) {
  if (check.titleMessage) return say(t, check.titleMessage);
  return check.title ?? "";
}

export function checkDetail(t: T, check: ChallengeCheck) {
  if (check.detailFindings?.length) return check.detailFindings.map((finding) => say(t, finding)).join(", ");
  if (check.detailMessage) return say(t, check.detailMessage);
  return check.detail ?? "";
}
