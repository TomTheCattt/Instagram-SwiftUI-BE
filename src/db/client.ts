import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const DATABASE_URL = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED;

if (!DATABASE_URL) {
  console.warn("WARNING: DATABASE_URL is not set.");
}

// Create standard PostgreSQL connection pool
const isLocal = !DATABASE_URL || DATABASE_URL.includes("localhost") || DATABASE_URL.includes("127.0.0.1") || DATABASE_URL.includes("@postgres:");

export const pool = new Pool({
  connectionString: DATABASE_URL,
  max: parseInt(process.env.DB_POOL_MAX || "10", 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle PostgreSQL client:", err);
});

// Create Drizzle instance with schema for type safety
export const db = drizzle(pool, { schema });
