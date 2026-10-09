import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { balanceByIsbn } from "../src/inventory.js";

const csv = fs.readFileSync(new URL("../data/movements.csv", import.meta.url), "utf8");

test("ignores the empty line at the end of the file", () => {
  assert.equal(Object.keys(balanceByIsbn("isbn,type,quantity\n111,in,1\n")).length, 1);
});

test("an ISBN with hyphens is the same book", () => {
  assert.equal(balanceByIsbn(csv)["9788500000028"], 3);
});

test("an uppercase type counts", () => {
  assert.equal(balanceByIsbn(csv)["9788500000035"], 3);
});

test("a quantity with a space counts", () => {
  assert.equal(balanceByIsbn(csv)["9788500000042"], 7);
});
