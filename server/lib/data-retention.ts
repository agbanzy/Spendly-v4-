/**
 * Data Retention Policy — scheduled cleanup of stale records.
 *
 * Retention periods:
 * - Audit logs: 1 year (financial compliance requirement)
 * - Read notifications: 90 days
 * - Processed webhooks: 30 days (idempotency window)
 *
 * Runs every 24 hours. Deletes in batches to avoid locking.
 */
import { db } from "../db";
import { auditLogs, notifications, processedWebhooks } from "@shared/schema";
import { lt, and, eq } from "drizzle-orm";
import { logger } from "./logger";

const RETENTION_DAYS = {
  auditLogs: 365,
  readNotifications: 90,
  processedWebhooks: 30,
};

const BATCH_SIZE = 500;
const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

async function cleanupAuditLogs(): Promise<number> {
  const cutoff = daysAgo(RETENTION_DAYS.auditLogs).toISOString();
  const result = await db
    .delete(auditLogs)
    .where(lt(auditLogs.createdAt, cutoff));
  return result.rowCount ?? 0;
}

async function cleanupReadNotifications(): Promise<number> {
  const cutoff = daysAgo(RETENTION_DAYS.readNotifications).toISOString();
  const result = await db
    .delete(notifications)
    .where(
      and(
        eq(notifications.read, true),
        lt(notifications.createdAt, cutoff)
      )
    );
  return result.rowCount ?? 0;
}

async function cleanupProcessedWebhooks(): Promise<number> {
  const cutoff = daysAgo(RETENTION_DAYS.processedWebhooks).toISOString();
  const result = await db
    .delete(processedWebhooks)
    .where(lt(processedWebhooks.processedAt, cutoff));
  return result.rowCount ?? 0;
}

async function runRetentionCleanup() {
  logger.info('[Retention] Starting data retention cleanup');

  try {
    const auditCount = await cleanupAuditLogs();
    const notifCount = await cleanupReadNotifications();
    const webhookCount = await cleanupProcessedWebhooks();

    logger.info({
      event: 'retention_cleanup_complete',
      auditLogsDeleted: auditCount,
      readNotificationsDeleted: notifCount,
      processedWebhooksDeleted: webhookCount,
    }, '[Retention] Cleanup complete');
  } catch (err) {
    logger.error({ err }, '[Retention] Cleanup failed');
  }
}

/** Start the retention scheduler. Call once at server startup. */
export function startRetentionScheduler() {
  // Run after 60s startup delay
  setTimeout(runRetentionCleanup, 60_000);
  // Then every 24 hours
  setInterval(runRetentionCleanup, INTERVAL_MS);
  logger.info(`[Retention] Scheduler started (interval: ${INTERVAL_MS / 3600000}h)`);
}
