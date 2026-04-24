import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import * as schema from "@db/schema";
import * as relations from "@db/relations";

const fullSchema = { ...schema, ...relations };

const dbPath = process.env.DATABASE_URL?.replace("sqlite:", "") || "./data/wordflash.db";

// 确保数据库目录存在
const dbDir = dirname(dbPath);
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

let instance: ReturnType<typeof drizzle>;

export function getDb() {
  if (!instance) {
    const sqlite = new Database(dbPath);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    instance = drizzle(sqlite, { schema: fullSchema });
  }
  return instance;
}
