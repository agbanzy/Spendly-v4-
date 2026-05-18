import { storage } from "../storage";
import { logger as baseLogger } from "./logger";

// LU-DD-1 / AUD-DD-MT-004
// Lightweight feature-flag accessor backed by `system_settings`. Caches
// reads for 60 seconds to avoid hitting the database on every admin
// request.
//
// This is intentionally minimal — for richer flagging (per-user, per-tenant
// overrides, percentage rollout) introduce GrowthBook or LaunchDarkly per
// PRD §18.
//
// All flags supported here are stored as `value: 'true' | 'false'` strings
// in the `system_settings.value` column. Anything else is treated as
// `false`. A missing key defaults to `false` UNLESS the caller passes
// `opts.defaultValue: true` — used for security flags where the SAFE
// default is enabled (e.g. `admin_per_company`, where missing the row
// silently selects the legacy global-role path).

const logger = baseLogger.child({ module: "feature-flags" });

const CACHE_TTL_MS = 60_000;

type CacheEntry = { value: boolean; expiresAt: number };
const cache = new Map<string, CacheEntry>();

/**
 * Read a boolean feature flag from system_settings with a 60s cache.
 * Returns `false` for missing or non-`'true'` values by default; pass
 * `opts.defaultValue: true` to invert that for security flags where
 * the safe default is enabled.
 *
 * @param key - the flag's `system_settings.key`
 * @param opts.bypassCache - skip the in-process cache for this read (used
 *   in tests and the rare "force-refresh" case after an ops update).
 * @param opts.defaultValue - returned when the row is missing OR an error
 *   occurs during lookup. Defaults to `false`. Pass `true` for security
 *   flags like `admin_per_company` where the safe default is the
 *   tenant-scoped path.
 */
export async function isFeatureFlagOn(
  key: string,
  opts: { bypassCache?: boolean; defaultValue?: boolean } = {},
): Promise<boolean> {
  const defaultValue = opts.defaultValue === true;
  if (!opts.bypassCache) {
    const hit = cache.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.value;
  }

  try {
    const all = await storage.getSystemSettings();
    const row = all.find((s: any) => s.key === key);
    if (!row) {
      // Missing row → honour caller's defaultValue. Cache the result
      // for the TTL window so we don't hammer the DB on every call.
      cache.set(key, { value: defaultValue, expiresAt: Date.now() + CACHE_TTL_MS });
      return defaultValue;
    }
    const value = (row as any).value === "true";
    cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    return value;
  } catch (err) {
    logger.warn(
      { err, key, defaultValue },
      "Feature-flag lookup failed; returning defaultValue",
    );
    return defaultValue;
  }
}

/**
 * Test/ops helper — invalidate the cache for a specific key (or all keys
 * if `key` is omitted). Useful when an operator just flipped a flag in
 * the database and wants the change visible immediately rather than after
 * the cache TTL.
 */
export function invalidateFeatureFlagCache(key?: string): void {
  if (key) cache.delete(key);
  else cache.clear();
}

/**
 * Test helper — pre-seed the cache with a known value, bypassing the DB
 * lookup. Only intended for unit tests; calling it from production code
 * is a code smell.
 */
export function _setFeatureFlagForTesting(key: string, value: boolean): void {
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}
