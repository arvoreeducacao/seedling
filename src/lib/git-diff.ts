import type { FileChange } from "@/lib/changes";
import type { DiffLine, Hunk } from "@/lib/diff";

function unquote(path: string) {
  if (!path.startsWith('"')) return path;
  try {
    return JSON.parse(path) as string;
  } catch {
    return path.slice(1, -1);
  }
}

function stripPrefix(path: string) {
  return unquote(path).replace(/^[ab]\//, "");
}

export function parseUnifiedDiff(text: string, maxLines = 4000): FileChange[] {
  const files: FileChange[] = [];
  let current: FileChange | null = null;
  let hunk: Hunk | null = null;
  let oldNo = 0;
  let newNo = 0;
  let budget = maxLines;
  for (const line of text.split("\n")) {
    if (line.startsWith("diff --git ")) {
      const match = line.match(/^diff --git (\S+|"[^"]+") (\S+|"[^"]+")$/);
      current = { path: match ? stripPrefix(match[2]) : line.slice(11), status: "modified", added: 0, removed: 0, hunks: [], skipped: null };
      files.push(current);
      hunk = null;
      continue;
    }
    if (!current) continue;
    if (line.startsWith("new file mode")) current.status = "added";
    else if (line.startsWith("deleted file mode")) current.status = "deleted";
    else if (line.startsWith("rename to ")) current.path = unquote(line.slice(10));
    else if (line.startsWith("+++ ") && line !== "+++ /dev/null") current.path = stripPrefix(line.slice(4));
    else if (line.startsWith("+++ ") || line.startsWith("--- ") || line.startsWith("index ") || line.startsWith("similarity index") || line.startsWith("rename from") || line.startsWith("old mode") || line.startsWith("new mode")) continue;
    else if (/^Binary files .* differ$/.test(line)) current.skipped = "binary";
    else if (line.startsWith("@@")) {
      const match = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      oldNo = match ? Number(match[1]) : 0;
      newNo = match ? Number(match[2]) : 0;
      hunk = { lines: [] };
      current.hunks.push(hunk);
    } else if (hunk && (line.startsWith("+") || line.startsWith("-") || line.startsWith(" "))) {
      const kind: DiffLine["kind"] = line[0] === "+" ? "add" : line[0] === "-" ? "del" : "context";
      if (kind === "add") current.added++;
      if (kind === "del") current.removed++;
      if (budget-- > 0) hunk.lines.push({ kind, text: line.slice(1), oldNo: kind === "add" ? null : oldNo, newNo: kind === "del" ? null : newNo });
      if (kind !== "add") oldNo++;
      if (kind !== "del") newNo++;
    }
  }
  return files.filter((f) => f.skipped || f.hunks.length || f.status !== "modified");
}
