-- LU-DD-2 / AUD-DD-MT-005 — Server-issued companyId index for payment intents
--
-- Webhook handlers previously read `companyId` from the provider's metadata
-- bag, which is client-supplied at intent-creation time. The signature on
-- the webhook proves Stripe/Paystack sent the message, but does not prove
-- the metadata.companyId field wasn't tampered with at creation. A replay
-- or forged-metadata attack could credit the wrong company's wallet.
--
-- This migration adds `payment_intent_index`: a server-issued mapping from
-- (provider, provider_intent_id) → (companyId, userId, kind). The intent-
-- creation code path writes this row server-side at the moment of intent
-- creation; the webhook handler then reads companyId from this index
-- instead of trusting the metadata bag.
--
-- Rollout strategy: writes happen now; reads add a fallback to the legacy
-- metadata path if the index row is missing (with WARN log) so in-flight
-- payments created before this migration still settle correctly. After a
-- soak window the fallback can be removed.
--
-- See docs/audit-2026-04-26/AUDIT_DEEP_DIVE_2026_04_26.md §10 LU-DD-2.

CREATE TABLE IF NOT EXISTS payment_intent_index (
  id                   text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  provider             text NOT NULL,             -- 'stripe' | 'paystack'
  provider_intent_id   text NOT NULL,             -- Stripe pi.id / Paystack reference / Paystack transfer_code
  kind                 text NOT NULL,             -- 'payment_intent' | 'charge' | 'transfer' | 'payout'
  company_id           text REFERENCES companies(id) ON DELETE SET NULL,
  user_id              text,                      -- Cognito sub at the time of creation, when known
  metadata_company_id  text,                      -- The companyId the CALLER asserted in metadata; kept for forensic comparison
  metadata             jsonb DEFAULT '{}'::jsonb, -- Full original metadata bag (for debugging)
  created_at           text NOT NULL DEFAULT now()::text,
  CONSTRAINT payment_intent_index_provider_id_unique UNIQUE (provider, provider_intent_id)
);

CREATE INDEX IF NOT EXISTS payment_intent_index_company_id_idx
  ON payment_intent_index (company_id);

CREATE INDEX IF NOT EXISTS payment_intent_index_kind_created_at_idx
  ON payment_intent_index (kind, created_at DESC);
