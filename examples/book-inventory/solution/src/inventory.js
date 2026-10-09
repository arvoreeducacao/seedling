export function balanceByIsbn(lines) {
  const balance = {};
  for (const line of lines.split(/\r?\n/).slice(1)) {
    if (!line.trim()) continue;
    const [rawIsbn, rawType, rawQuantity] = line.split(",");
    const isbn = rawIsbn.replace(/-/g, "").trim();
    const type = rawType.trim().toLowerCase();
    const quantity = Number(rawQuantity.trim());
    balance[isbn] = (balance[isbn] ?? 0) + (type === "in" ? quantity : -quantity);
  }
  return balance;
}
