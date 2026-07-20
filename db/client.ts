import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/db/schema";

if (!process.env.DATABASE_URL) {
  config({ path: ".env.local" });
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

const globalForDb = globalThis as typeof globalThis & {
  stitchTalkPool?: Pool;
};

export const pool =
  globalForDb.stitchTalkPool ??
  new Pool({
    connectionString,
    max: process.env.NODE_ENV === "production" ? 10 : 4,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.stitchTalkPool = pool;
}

export const db = drizzle(pool, { schema });
