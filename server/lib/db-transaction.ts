import { db } from '../db';

/**
 * Execute a callback within a database transaction.
 * If the callback throws, the transaction is automatically rolled back.
 * If it succeeds, the transaction is committed.
 *
 * Usage:
 *   const result = await withTransaction(async (tx) => {
 *     await tx.update(wallets).set({ balance: newBalance }).where(...);
 *     await tx.insert(transactions).values({ ... });
 *     return { success: true };
 *   });
 */
export async function withTransaction<T>(
  callback: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<T>
): Promise<T> {
  return db.transaction(callback);
}

export type DrizzleTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
