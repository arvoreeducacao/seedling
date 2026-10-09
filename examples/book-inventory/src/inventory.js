export function balanceByIsbn(lines) {
  const balance = {};
  for (const line of lines.split("\n").slice(1)) {
    const [isbn, type, quantity] = line.split(",");
    balance[isbn] = (balance[isbn] ?? 0) + (type === "in" ? Number(quantity) : -Number(quantity));
  }
  return balance;
}
