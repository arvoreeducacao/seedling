export type DiffLine = { kind: "context" | "add" | "del"; text: string; oldNo: number | null; newNo: number | null };
export type Hunk = { lines: DiffLine[] };

function splitLines(text: string) {
  if (!text) return [];
  const lines = text.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  return lines;
}

export function diffLines(before: string, after: string): DiffLine[] {
  const a = splitLines(before);
  const b = splitLines(after);
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);
  const out: DiffLine[] = [];
  for (let i = 0; i < start; i++) out.push({ kind: "context", text: a[i], oldNo: i + 1, newNo: i + 1 });
  if (midA.length * midB.length > 4_000_000) {
    midA.forEach((text, i) => out.push({ kind: "del", text, oldNo: start + i + 1, newNo: null }));
    midB.forEach((text, i) => out.push({ kind: "add", text, oldNo: null, newNo: start + i + 1 }));
  } else {
    const rows = midA.length;
    const cols = midB.length;
    const table = Array.from({ length: rows + 1 }, () => new Uint32Array(cols + 1));
    for (let i = rows - 1; i >= 0; i--) {
      for (let j = cols - 1; j >= 0; j--) {
        table[i][j] = midA[i] === midB[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
      }
    }
    let i = 0;
    let j = 0;
    while (i < rows || j < cols) {
      if (i < rows && j < cols && midA[i] === midB[j]) {
        out.push({ kind: "context", text: midA[i], oldNo: start + i + 1, newNo: start + j + 1 });
        i++;
        j++;
      } else if (i < rows && (j >= cols || table[i + 1][j] >= table[i][j + 1])) {
        out.push({ kind: "del", text: midA[i], oldNo: start + i + 1, newNo: null });
        i++;
      } else {
        out.push({ kind: "add", text: midB[j], oldNo: null, newNo: start + j + 1 });
        j++;
      }
    }
  }
  const shift = endB - endA;
  for (let k = endA; k < a.length; k++) out.push({ kind: "context", text: a[k], oldNo: k + 1, newNo: k + 1 + shift });
  return out;
}

export function toHunks(lines: DiffLine[], context = 3): Hunk[] {
  const keep = new Array(lines.length).fill(false);
  lines.forEach((line, i) => {
    if (line.kind === "context") return;
    for (let k = Math.max(0, i - context); k <= Math.min(lines.length - 1, i + context); k++) keep[k] = true;
  });
  const hunks: Hunk[] = [];
  let current: Hunk | null = null;
  lines.forEach((line, i) => {
    if (!keep[i]) {
      current = null;
      return;
    }
    if (!current) {
      current = { lines: [] };
      hunks.push(current);
    }
    current.lines.push(line);
  });
  return hunks;
}

export function countChanges(lines: DiffLine[]) {
  return { added: lines.filter((l) => l.kind === "add").length, removed: lines.filter((l) => l.kind === "del").length };
}
