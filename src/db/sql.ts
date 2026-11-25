import { pool } from "./client";

/**
 * Standard PostgreSQL tagged template literal helper.
 * Replaces `@neondatabase/serverless` neon() client using the shared connection pool.
 *
 * Example:
 *   const users = await sql`SELECT * FROM users WHERE id = ${userId}`;
 */
export async function sql<T = any>(
  strings: TemplateStringsArray,
  ...values: any[]
): Promise<T[]> {
  let text = "";
  const params: any[] = [];

  for (let i = 0; i < strings.length; i++) {
    text += strings[i];
    if (i < values.length) {
      params.push(values[i]);
      text += `$${params.length}`;
    }
  }

  const result = await pool.query(text, params);
  return result.rows as T[];
}

export default sql;
