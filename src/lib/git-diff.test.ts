import { describe, expect, it } from "vitest";
import { parseUnifiedDiff } from "./git-diff";

const sample = `diff --git a/src/inventory.js b/src/inventory.js
index 1111111..2222222 100644
--- a/src/inventory.js
+++ b/src/inventory.js
@@ -1,3 +1,4 @@
 export function balanceByIsbn(lines) {
-  const balance = {};
+  const balance = new Map();
+  const seen = new Set();
   for (const line of lines) {
diff --git a/src/isbn.js b/src/isbn.js
new file mode 100644
index 0000000..3333333
--- /dev/null
+++ b/src/isbn.js
@@ -0,0 +1,2 @@
+export const clean = (v) => v.trim();
+export default clean;
diff --git a/old.txt b/old.txt
deleted file mode 100644
--- a/old.txt
+++ /dev/null
@@ -1 +0,0 @@
-bye
diff --git a/logo.png b/logo.png
new file mode 100644
Binary files /dev/null and b/logo.png differ
diff --git "a/docs/my notes.md" "b/docs/my notes.md"
new file mode 100644
--- /dev/null
+++ "b/docs/my notes.md"
@@ -0,0 +1 @@
+hi
`;

describe("parseUnifiedDiff", () => {
  it("reads modified, added, deleted, binary and quoted paths", () => {
    const files = parseUnifiedDiff(sample);
    expect(files.map((f) => [f.path, f.status, f.added, f.removed, f.skipped])).toEqual([
      ["src/inventory.js", "modified", 2, 1, null],
      ["src/isbn.js", "added", 2, 0, null],
      ["old.txt", "deleted", 0, 1, null],
      ["logo.png", "added", 0, 0, "binary"],
      ["docs/my notes.md", "added", 1, 0, null],
    ]);
    expect(files[0].hunks[0].lines.map((l) => [l.kind, l.oldNo, l.newNo])).toEqual([
      ["context", 1, 1],
      ["del", 2, null],
      ["add", null, 2],
      ["add", null, 3],
      ["context", 3, 4],
    ]);
  });

  it("returns nothing for an empty diff", () => {
    expect(parseUnifiedDiff("")).toEqual([]);
  });
});
