import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "@db/schema";
import * as relations from "@db/relations";

const fullSchema = { ...schema, ...relations };

let instance: ReturnType<typeof drizzle<typeof fullSchema>>;
let pool: mysql.Pool;

export async function getDb() {
  if (!instance) {
    const connectionString = process.env.DATABASE_URL || "mysql://root:root@192.168.64.1:3306/wordflash";
    
    // 使用连接池而不是单个连接，提高稳定性和性能
    pool = mysql.createPool({
      uri: connectionString,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    });
    
    instance = drizzle(pool, { schema: fullSchema, mode: "default" });
  }
  return instance;
}
