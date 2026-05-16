import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Load .env first, then let .env.local win. This avoids accidentally running
// migrations against a stale DATABASE_URL exported in the shell.
config({ path: ".env" });
config({ path: ".env.local", override: true });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env.local and set your PostgreSQL connection string."
  );
}

export default defineConfig({
  schema: "./src/storage/database/shared/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
  strict: true,
  verbose: true,
});
