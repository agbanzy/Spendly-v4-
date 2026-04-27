import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { Pool } from "pg";
import * as fs from "node:fs";
import * as path from "node:path";

// AUD-PR-009 — shared setup for integration tests.
//
// Boots a real Postgres via testcontainers, runs the project's
// `migrations/*.sql` files in order against it (mirroring the
// production migration runner in scripts/run-migration.cjs), and
// returns a pg.Pool configured for the container.

export interface IntegrationTestEnv {
  container: StartedPostgreSqlContainer;
  pool: Pool;
  connectionString: string;
}

/**
 * Boot a Postgres container, run migrations, return the env. Each
 * integration test file should call this in beforeAll() and stop it
 * in afterAll().
 *
 * Usage:
 *   let env: IntegrationTestEnv;
 *   beforeAll(async () => { env = await bootIntegrationDb(); }, 60_000);
 *   afterAll(async () => { await teardownIntegrationDb(env); });
 */
export async function bootIntegrationDb(): Promise<IntegrationTestEnv> {
  const container = await new PostgreSqlContainer("postgres:16-alpine")
    .withDatabase("spendly_int_test")
    .withUsername("test")
    .withPassword("test")
    .start();

  const connectionString = container.getConnectionUri();
  const pool = new Pool({ connectionString });

  await applyMigrations(pool);

  return { container, pool, connectionString };
}

export async function teardownIntegrationDb(env: IntegrationTestEnv): Promise<void> {
  await env.pool.end();
  await env.container.stop();
}

/**
 * Apply migrations/*.sql in lexicographic order. Mirrors the production
 * runner in scripts/run-migration.cjs but kept inline here so the
 * integration test can run from a single dependency-light entry point.
 *
 * Skips `migrations-deferred/` (the production runner skips it too).
 *
 * Each .sql file may contain plain SQL OR Drizzle-style
 * `--> statement-breakpoint` delimiters. Both are handled.
 */
async function applyMigrations(pool: Pool): Promise<void> {
  const migrationsDir = path.join(__dirname, "..", "..", "..", "migrations");
  const files = fs.readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const raw = fs.readFileSync(filePath, "utf-8");

    let statements: string[];
    if (raw.includes("--> statement-breakpoint")) {
      statements = raw
        .split(/-->\s*statement-breakpoint/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith("--"));
    } else {
      // For DO $$ ... END $$; blocks, split on semicolons that are NOT
      // inside dollar-quoted blocks. Same logic as run-migration.cjs.
      const out: string[] = [];
      let current = "";
      let inDollarBlock = false;
      for (const line of raw.split("\n")) {
        current += line + "\n";
        const dollarCount = (line.match(/\$\$/g) || []).length;
        if (dollarCount % 2 === 1) {
          inDollarBlock = !inDollarBlock;
        }
        if (!inDollarBlock && line.trim().endsWith(";")) {
          out.push(current.trim());
          current = "";
        }
      }
      if (current.trim()) out.push(current.trim());
      statements = out.filter((s) => s.length > 0);
    }

    for (const stmt of statements) {
      // Skip pure-comment statements.
      const code = stmt.replace(/--.*$/gm, "").trim();
      if (!code) continue;
      try {
        await pool.query(stmt);
      } catch (err: any) {
        throw new Error(
          `Migration ${file} failed at statement:\n${stmt.slice(0, 200)}...\n\nError: ${err.message}`,
        );
      }
    }
  }
}

/**
 * Reset DB state between tests without rebooting the container. Faster
 * than re-running migrations. Only truncates tables that integration
 * tests are likely to dirty; expand this list as new tests are added.
 */
export async function resetIntegrationDb(pool: Pool): Promise<void> {
  await pool.query(`
    TRUNCATE TABLE
      payouts, payroll_entries, transactions, wallet_transactions,
      audit_logs, payment_intent_index
    RESTART IDENTITY CASCADE;
  `);
}
