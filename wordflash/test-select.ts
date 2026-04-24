import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import Database from "better-sqlite3";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

const sqlite = new Database(":memory:");
const db = drizzle(sqlite);
const t = sqliteTable("t", { id: integer("id").primaryKey({ autoIncrement: true }), name: text("name") });
sqlite.exec("CREATE TABLE t(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)");

async function main() {
  await db.insert(t).values({ name: "hello" });

  const r = await db.select().from(t).where(eq(t.name, "hello"));
  console.log("found result:", JSON.stringify(r));
  console.log("found length:", r?.length);

  const r2 = await db.select().from(t).where(eq(t.name, "nonexist"));
  console.log("empty result:", JSON.stringify(r2));
  console.log("empty length:", r2?.length);
}
main().catch(console.error);
