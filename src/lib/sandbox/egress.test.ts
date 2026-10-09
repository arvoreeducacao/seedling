import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

const { isBlockedAddress } = createRequire(import.meta.url)(path.resolve("sandbox/browser/egress.cjs")) as { isBlockedAddress: (ip: string) => boolean };

describe("agent browser egress", () => {
  it("lets public addresses through", () => {
    for (const ip of ["1.1.1.1", "142.250.79.46", "2606:4700:4700::1111", "2a00:1450:4001:82a::200e"]) expect(isBlockedAddress(ip), ip).toBe(false);
  });

  it("blocks private, link-local, metadata, carrier-grade NAT and multicast IPv4", () => {
    for (const ip of ["10.0.0.5", "172.16.0.1", "172.31.255.255", "192.168.1.10", "169.254.169.254", "100.64.0.1", "127.0.0.1", "0.0.0.0", "224.0.0.1", "198.18.0.1"]) expect(isBlockedAddress(ip), ip).toBe(true);
  });

  it("blocks internal IPv6 and IPv4 hidden inside IPv6", () => {
    for (const ip of ["::1", "::", "fd00::1", "fe80::1", "ff02::1", "::ffff:10.0.0.1", "::ffff:a00:1", "::ffff:169.254.169.254", "64:ff9b::a9fe:a9fe", "2002:a00:1::1"]) expect(isBlockedAddress(ip), ip).toBe(true);
    expect(isBlockedAddress("::ffff:8.8.8.8")).toBe(false);
  });

  it("blocks anything that is not an IP", () => {
    expect(isBlockedAddress("internal.local")).toBe(true);
  });
});
