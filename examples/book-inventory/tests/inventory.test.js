import { test } from "node:test";
import assert from "node:assert/strict";
import { balanceByIsbn } from "../src/inventory.js";

test("adds what comes in and subtracts what goes out", () => {
  assert.deepEqual(balanceByIsbn("isbn,type,quantity\n111,in,10\n111,out,3"), { "111": 7 });
});
