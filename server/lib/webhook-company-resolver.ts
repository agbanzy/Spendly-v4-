import { storage } from "../storage";
import { logger as baseLogger } from "./logger";

// LU-DD-2 / AUD-DD-MT-005
//
// Webhook handlers used to read companyId directly from metadata that the
// CALLER supplied at intent-creation time. The webhook signature verifies
// "Stripe / Paystack sent this", but does not verify "the metadata bag
// wasn't tampered with by the caller". A replayed or forged metadata
// field could credit the wrong company's wallet.
//
// This resolver looks up companyId from the server-issued
// `payment_intent_index` table by (provider, provider_intent_id), which is
// written authoritatively at intent-creation time. The metadata.companyId
// becomes a fallback for in-flight payments created before this code shipped
// (transient backwards-compat) and is ALWAYS compared against the index value
// when both are available — a mismatch is logged as a security alert.
//
// After the index has been writing for one full retention window
// (~30 days), the metadata fallback can be removed by deleting the
// `metadataCompanyId` parameter from callers and treating "no index row"
// as a hard webhook failure.

const logger = baseLogger.child({ module: "webhook-company-resolver" });

export type Provider = "stripe" | "paystack";

export interface CompanyResolution {
  /** The companyId to use for downstream credits/debits (may be null). */
  companyId: string | null;
  /** How the value was determined — useful for ops dashboards / log queries. */
  source: "index" | "metadata-fallback" | "none";
  /** True if the index value and metadata value were both present and disagreed. */
  mismatch: boolean;
  /** The raw index row, when one was found. */
  indexRow?: { companyId: string | null; userId: string | null; kind: string };
}

/**
 * Resolve the authoritative companyId for an inbound webhook event.
 *
 * @param provider - "stripe" or "paystack"
 * @param providerIntentId - the provider's intent identifier the webhook
 *   refers to (Stripe payment_intent.id, Paystack reference, Paystack
 *   transfer_code, etc.)
 * @param metadataCompanyId - the companyId read from the inbound webhook's
 *   metadata bag. Used only as a fallback and as a forensic comparison.
 *   Pass `undefined` if the event has no metadata.
 */
export async function resolveCompanyForWebhook(
  provider: Provider,
  providerIntentId: string,
  metadataCompanyId?: string | null,
): Promise<CompanyResolution> {
  if (!providerIntentId) {
    logger.warn({ provider }, "resolveCompanyForWebhook called with no providerIntentId");
    return {
      companyId: metadataCompanyId ?? null,
      source: metadataCompanyId ? "metadata-fallback" : "none",
      mismatch: false,
    };
  }

  let indexRow;
  try {
    indexRow = await storage.getPaymentIntentIndex(provider, providerIntentId);
  } catch (err) {
    logger.error({ err, provider, providerIntentId }, "payment_intent_index lookup failed");
    indexRow = undefined;
  }

  if (indexRow) {
    const indexCompanyId = indexRow.companyId ?? null;
    const mismatch =
      Boolean(metadataCompanyId) &&
      Boolean(indexCompanyId) &&
      metadataCompanyId !== indexCompanyId;

    if (mismatch) {
      // Security alert — the inbound metadata claims a different company
      // than the index says. Possible tampering, replay, or a code bug.
      // We trust the index (server-issued) and log the discrepancy.
      logger.warn(
        {
          provider,
          providerIntentId,
          indexCompanyId,
          metadataCompanyId,
          alert: "webhook_company_mismatch",
        },
        "Webhook metadata.companyId differs from server-issued index — using index value",
      );
    }

    return {
      companyId: indexCompanyId,
      source: "index",
      mismatch,
      indexRow: {
        companyId: indexCompanyId,
        userId: (indexRow as any).userId ?? null,
        kind: (indexRow as any).kind,
      },
    };
  }

  // No index row exists — either created before LU-DD-2 shipped, or via a
  // legacy code path that bypassed paymentService. Fall back to metadata
  // with a WARN log so ops can spot the gap.
  logger.warn(
    {
      provider,
      providerIntentId,
      metadataCompanyId: metadataCompanyId ?? null,
      alert: "webhook_index_miss",
    },
    "No payment_intent_index row — falling back to metadata.companyId",
  );

  return {
    companyId: metadataCompanyId ?? null,
    source: metadataCompanyId ? "metadata-fallback" : "none",
    mismatch: false,
  };
}
