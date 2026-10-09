export function parseListening(procNetTcp: string) {
  const ports = new Set<number>();
  for (const line of procNetTcp.split("\n")) {
    const fields = line.trim().split(/\s+/);
    if (fields.length < 4 || fields[3] !== "0A") continue;
    const port = parseInt(fields[1].split(":").pop() ?? "", 16);
    if (Number.isInteger(port) && port > 0) ports.add(port);
  }
  return [...ports].sort((a, b) => a - b);
}
