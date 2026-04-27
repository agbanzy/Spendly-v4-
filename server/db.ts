import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

// Build the SSL config for the prod connection.
//
// AWS RDS: standard certs in Node's default CA bundle, plain
//   { rejectUnauthorized: true } works.
// DO Managed Postgres: self-signed CA. DO exposes the CA via the
//   `${db.CA_CERT}` template in the App Platform spec, which we bind to
//   DATABASE_CA_CERT. When that env var is present, pass the cert
//   contents as `ca` so chain verification still passes (we get full
//   TLS verification, not the weakened rejectUnauthorized:false).
function buildSslConfig(): { rejectUnauthorized: boolean; ca?: string } | undefined {
  if (process.env.NODE_ENV !== 'production') return undefined;
  const ca = process.env.DATABASE_CA_CERT;
  if (ca && ca.trim().length > 0) {
    return { rejectUnauthorized: true, ca };
  }
  return { rejectUnauthorized: true };
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // SECURITY: Enforce SSL in production to prevent credential interception
  ssl: buildSslConfig(),
});

export const db = drizzle(pool, { schema });
