import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { createClient } from "@supabase/supabase-js";

// Supabase 连接配置
const supabaseUrl = "https://ltlugfdpgqdlddpgrtjl.supabase.co";
const supabaseKey = "Woshiyouqianren";

// Supabase 客户端（用于知识库 API）
export const supabase = createClient(supabaseUrl, supabaseKey);

// 使用全局存储来保持跨请求的连接池
const globalForDb = globalThis as typeof globalThis & {
  __readInsightPgPool?: Pool;
  __db?: ReturnType<typeof drizzle>;
};

// 获取或创建数据库连接池（延迟初始化）
function getPool(): Pool {
  if (!globalForDb.__readInsightPgPool) {
    // Supabase 连接池地址
    const connectionString = `postgresql://postgres.ltlugfdpgqdlddpgrtjl:Woshiyouqianren@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres`;
    globalForDb.__readInsightPgPool = new Pool({
      connectionString,
      max: 10,
    });
  }
  return globalForDb.__readInsightPgPool;
}

// 获取或创建 drizzle 实例（延迟初始化）
function createDb(): ReturnType<typeof drizzle> {
  if (!globalForDb.__db) {
    globalForDb.__db = drizzle(getPool());
  }
  return globalForDb.__db;
}

// 使用 getter 模式实现延迟访问，保持 db 的对象语义
let _db: ReturnType<typeof drizzle> | null = null;
const dbProxy = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop, receiver) {
    if (!_db) {
      _db = createDb();
    }
    return Reflect.get(_db, prop, receiver);
  },
});

// 仅在生产环境持久化到 global（开发环境每个热更新会重新创建）
if (process.env.NODE_ENV === "production") {
  globalForDb.__db = dbProxy as ReturnType<typeof drizzle>;
}

export const db = dbProxy;
export { getPool };
