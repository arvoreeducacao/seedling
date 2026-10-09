import type { Kit } from "./kit";

export const PLAYGROUND_TITLE = "Playground";

export const PLAYGROUND_DEFAULTS = { budgetUsd: 1, minutes: 20 } as const;

export const PLAYGROUND_LIMITS = { minBudgetUsd: 0.1, maxBudgetUsd: 20, minMinutes: 5, maxMinutes: 120 } as const;

const README = `# Your playground

This is a free sandbox to get comfortable before the interview. **Nothing here is graded** and the team doesn't review it. They only see that you practiced, for how long and how many prompts you sent.

It works exactly like the interview: Claude Code is already running in the terminal, your files are on the right, and anything you brought in your setup (skills, CLAUDE.md, MCP servers) is installed.

## Ideas to try

- Ask Claude Code to explain \`src/cart.js\` before changing anything.
- Run \`npm test\`. One test fails on purpose: ask the agent to find out why, and read its diff before accepting it.
- Add a feature, like a discount code, and ask for tests first.
- Try plan mode, a subagent, or one of your own skills.

The time and the AI budget are small and separate from your interview. When the budget runs out the agent stops, and when the time runs out the playground closes.
`;

const PACKAGE = `{
  "name": "playground-cart",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test"
  }
}
`;

const CART = `export function createCart() {
  return { items: [] };
}

export function addItem(cart, item, quantity = 1) {
  const existing = cart.items.find((line) => line.sku === item.sku);
  if (existing) {
    existing.quantity = quantity;
    return cart;
  }
  cart.items.push({ sku: item.sku, name: item.name, price: item.price, quantity });
  return cart;
}

export function total(cart) {
  return cart.items.reduce((sum, line) => sum + line.price * line.quantity, 0);
}
`;

const CART_TEST = `import { test } from "node:test";
import assert from "node:assert/strict";
import { addItem, createCart, total } from "../src/cart.js";

const book = { sku: "bk-1", name: "Book", price: 12.5 };
const pen = { sku: "pn-1", name: "Pen", price: 2 };

test("adds different items", () => {
  const cart = addItem(addItem(createCart(), book), pen, 3);
  assert.equal(cart.items.length, 2);
  assert.equal(total(cart), 18.5);
});

test("adding the same item twice sums the quantities", () => {
  const cart = addItem(addItem(createCart(), book, 2), book, 1);
  assert.equal(cart.items[0].quantity, 3);
});
`;

export const PLAYGROUND_FILES: Record<string, string> = {
  "README.md": README,
  "package.json": PACKAGE,
  "src/cart.js": CART,
  "test/cart.test.js": CART_TEST,
};

export const PLAYGROUND_CHALLENGE = {
  title: PLAYGROUND_TITLE,
  kind: "code" as const,
  runtime: "node",
  statement: README,
  visibleTestCommand: "npm test",
  previewPort: null,
  flow: [] as { title: string; description?: string }[],
  states: [] as string[],
};

export function isPlayground(session: { practiceOf: string | null; challengeIds: string[] }) {
  return Boolean(session.practiceOf) && session.challengeIds.length === 0;
}

export type PracticePlan = { kind: "playground"; challengeId: null; minutes: number; budgetUsd: number } | { kind: "challenge"; challengeId: string; minutes: number; budgetUsd: number };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function practicePlan(practice: Kit["practice"]): PracticePlan | null {
  if (!practice.enabled || practice.mode === "off") return null;
  const minutes = clamp(Math.round(practice.minutes), PLAYGROUND_LIMITS.minMinutes, PLAYGROUND_LIMITS.maxMinutes);
  const budgetUsd = clamp(practice.budgetUsd, PLAYGROUND_LIMITS.minBudgetUsd, PLAYGROUND_LIMITS.maxBudgetUsd);
  if (practice.mode === "challenge") return practice.challengeId ? { kind: "challenge", challengeId: practice.challengeId, minutes, budgetUsd } : null;
  return { kind: "playground", challengeId: null, minutes, budgetUsd };
}

export function practiceRoomFree(running: number, maxConcurrent: number) {
  const reserved = maxConcurrent > 1 ? 1 : 0;
  return running < maxConcurrent - reserved;
}
