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

// Strip `sslmode=...` from the connection URL so pg-connection-string
// doesn't construct its own ssl config that overrides ours. Without
// this, DO's `?sslmode=require` URL causes pg to ignore our ssl.ca
// and reject the self-signed chain — see DO deploy attempt
// 24985167106 for the exact trace.
function cleanConnectionString(url: string | undefined): string | undefined {
  if (!url) return url;
  // Remove the parameter wherever it appears (?sslmode=... or
  // &sslmode=...) and tidy any leftover ?& or trailing ?.
  return url
    .replace(/[?&]sslmode=[^&]*/gi, (match) => (match.startsWith('?') ? '?' : ''))
    .replace(/\?&/, '?')
    .replace(/\?$/, '');
}

export const pool = new Pool({
  connectionString: cleanConnectionString(process.env.DATABASE_URL),
  // SECURITY: Enforce SSL in production to prevent credential interception
  ssl: buildSslConfig(),
});

export const db = drizzle(pool, { schema });
