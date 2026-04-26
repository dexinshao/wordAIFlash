import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "@db/schema";
import * as relations from "@db/relations";

const fullSchema = { ...schema, ...relations };

let instance: ReturnType<typeof drizzle<typeof fullSchema>>;

export async function getDb() {
  if (!instance) {
    const connectionString = process.env.DATABASE_URL || "mysql://root:root@192.168.64.1:3306/wordflash";
    const connection = await mysql.createConnection(connectionString);
    instance = drizzle(connection, { schema: fullSchema, mode: "default" });
  }
  return instance;
}
