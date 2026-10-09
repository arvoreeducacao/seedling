import fs from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { env } from "@/lib/env";
import * as schema from "./schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;

const globalForDb = globalThis as unknown as { seedlingDb?: Db; seedlingMigrated?: Promise<void> };

function connect(): Db {
  if (env.databaseUrl.startsWith("file:")) {
    fs.mkdirSync(path.dirname(env.databaseUrl.slice(5)), { recursive: true });
  }
  const client = createClient({ url: env.databaseUrl, authToken: process.env.DATABASE_AUTH_TOKEN });
  return drizzle(client, { schema });
}

export const db: Db = globalForDb.seedlingDb ?? connect();
globalForDb.seedlingDb = db;

export function ready() {
  globalForDb.seedlingMigrated ??= migrate(db, { migrationsFolder: path.resolve("drizzle") });
  return globalForDb.seedlingMigrated;
}

export { schema };
