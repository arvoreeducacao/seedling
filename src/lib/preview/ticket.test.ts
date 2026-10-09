import { describe, expect, it } from "vitest";
import { previewSigner } from "./ticket";

describe("previewSigner", () => {
  const signer = previewSigner("secret-a");

  it("round-trips a ticket and a pass", () => {
    const ticket = signer.sign({ kind: "ticket", session: "s1", expires: 2000 });
    expect(signer.verify(ticket, "ticket", 1000)).toMatchObject({ session: "s1" });
    const pass = signer.sign({ kind: "pass", session: "s1", port: 5173, expires: 2000 });
    expect(signer.verify(pass, "pass", 1000)).toMatchObject({ session: "s1", port: 5173 });
  });

  it("rejects expired, tampered, foreign and mismatched tokens", () => {
    const ticket = signer.sign({ kind: "ticket", session: "s1", expires: 2000 });
    expect(signer.verify(ticket, "ticket", 3000)).toBeNull();
    expect(signer.verify(ticket, "pass", 1000)).toBeNull();
    const [body, mac] = ticket.split(".");
    const forged = Buffer.from(JSON.stringify({ kind: "ticket", session: "s2", expires: 2000 })).toString("base64url");
    expect(signer.verify(`${forged}.${mac}`, "ticket", 1000)).toBeNull();
    expect(signer.verify(`${body}.${mac}x`, "ticket", 1000)).toBeNull();
    expect(previewSigner("secret-b").verify(ticket, "ticket", 1000)).toBeNull();
    expect(signer.verify("", "ticket", 1000)).toBeNull();
  });
});
