import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const globalForDb = globalThis as typeof globalThis & {
  __readInsightPgPool?: Pool;
};

const pool =
  globalForDb.__readInsightPgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__readInsightPgPool = pool;
}

export const db = drizzle(pool);

export { pool };
