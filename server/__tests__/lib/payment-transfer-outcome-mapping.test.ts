import { describe, it, expect } from "vitest";
import type { MoneyOutcome } from "../../lib/money-movement";

// STG3-B-2 (AUDIT_TRANSFERS_PAYOUTS_2026_05_17 §4.4 item 11) — pin the
// contract for how POST /payment/transfer maps each MoneyOutcome to an
// HTTP response. The route went from ~120 lines of inline orchestration
// to a single moneyMovement.process() call + this 5-case switch. The
// behavioural surface of the route (status codes, error codes, the
// reference field, the provider result pass-through) is API contract
// that downstream clients depend on — a regression would break callers
// even though the orchestration is correct.
//
// Pure-function model. Real route is exercised end-to-end in the
// integration test suite (requires DATABASE_URL).

interface RouteResponse {
  status: number;
  body: Record<string, unknown>;
  thrown: boolean;
  thrownProps?: Record<string, unknown>;
}

/**
 * Mirror of POST /payment/transfer's outcome → response mapping
 * (server/routes/payments.routes.ts after STG3-B-2).
 */
function mapOutcomeToResponse(
  outcome: MoneyOutcome,
  transferReference: string,
): RouteResponse {
  if (outcome.kind === 'claim_lost') {
    return {
      status: 409,
      thrown: false,
      body: {
        error:
          'Duplicate transfer reference — this transfer was already initiated. Retry with a new client-side reference.',
        code: 'TRANSFER_CLAIM_LOST',
        reference: transferReference,
      },
    };
  }
  if (outcome.kind === 'compensated') {
    return {
      status: 502, // mapPaymentError translates the thrown statusCode
      thrown: true,
      thrownProps: {
        message: outcome.providerError,
        statusCode: 502,
        compensation: outcome.compensation,
        code: 'TRANSFER_PROVIDER_FAILED',
      },
      body: {}, // not reached — error is thrown
    };
  }
  // succeeded — route then runs createTransaction + notifications +
  // audit log and returns res.json({ ...transferResult, reference: providerRef })
  const transferResult = (outcome.providerResult ?? {}) as Record<string, unknown>;
  return {
    status: 200,
    thrown: false,
    body: { ...transferResult, reference: outcome.providerReference },
  };
}

describe('STG3-B-2 — claim_lost outcome → 409 TRANSFER_CLAIM_LOST', () => {
  it('returns 409 with the canonical error code and original reference', () => {
    const outcome: MoneyOutcome = {
      kind: 'claim_lost',
      reference: 'TRF-u1-1747000000000',
      reason: 'duplicate',
    };
    const res = mapOutcomeToResponse(outcome, 'TRF-u1-1747000000000');
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('TRANSFER_CLAIM_LOST');
    expect(res.body.reference).toBe('TRF-u1-1747000000000');
    expect(res.body.error).toMatch(/Duplicate transfer reference/);
  });

  it('does not throw — the route returns the response directly', () => {
    const outcome: MoneyOutcome = {
      kind: 'claim_lost',
      reference: 'TRF-x',
      reason: 'duplicate',
    };
    expect(mapOutcomeToResponse(outcome, 'TRF-x').thrown).toBe(false);
  });
});

describe('STG3-B-2 — compensated outcome → throws 502 with provider error', () => {
  it('throws with statusCode 502 and the original provider error message', () => {
    const outcome: MoneyOutcome = {
      kind: 'compensated',
      reference: 'TRF-u1-1',
      providerError: 'Paystack 502 — bad gateway',
      compensation: 'in_line',
    };
    const res = mapOutcomeToResponse(outcome, 'TRF-u1-1');
    expect(res.thrown).toBe(true);
    expect(res.thrownProps?.message).toBe('Paystack 502 — bad gateway');
    expect(res.thrownProps?.statusCode).toBe(502);
    expect(res.thrownProps?.code).toBe('TRANSFER_PROVIDER_FAILED');
  });

  it('attaches the compensation strategy (in_line) so ops can correlate logs', () => {
    const outcome: MoneyOutcome = {
      kind: 'compensated',
      reference: 'TRF-1',
      providerError: 'err',
      compensation: 'in_line',
    };
    expect(mapOutcomeToResponse(outcome, 'TRF-1').thrownProps?.compensation).toBe('in_line');
  });

  it('attaches compensation=enqueued when in-line refund failed and queue caught it', () => {
    const outcome: MoneyOutcome = {
      kind: 'compensated',
      reference: 'TRF-1',
      providerError: 'err',
      compensation: 'enqueued',
    };
    expect(mapOutcomeToResponse(outcome, 'TRF-1').thrownProps?.compensation).toBe('enqueued');
  });

  it('attaches compensation=enqueue_failed in the worst case (ops must manually credit-back)', () => {
    const outcome: MoneyOutcome = {
      kind: 'compensated',
      reference: 'TRF-1',
      providerError: 'err',
      compensation: 'enqueue_failed',
    };
    expect(mapOutcomeToResponse(outcome, 'TRF-1').thrownProps?.compensation).toBe('enqueue_failed');
  });
});

describe('STG3-B-2 — succeeded outcome → 200 with providerResult passed through', () => {
  it('passes through the full provider result with reference overridden to providerReference', () => {
    // Paystack-shaped provider result — the client uses these fields
    // (status, transfer_code) and a regression that drops providerResult
    // would silently break integration callers.
    const outcome: MoneyOutcome = {
      kind: 'succeeded',
      reference: 'TRF-u1-1',
      providerReference: 'TRF-pstk-77',
      providerResult: {
        status: 'pending',
        transfer_code: 'TRF-pstk-77',
        amount: 10000,
        currency: 'NGN',
        reason: 'Test',
      },
    };
    const res = mapOutcomeToResponse(outcome, 'TRF-u1-1');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('pending');
    expect(res.body.transfer_code).toBe('TRF-pstk-77');
    expect(res.body.amount).toBe(10000);
    expect(res.body.reference).toBe('TRF-pstk-77');
  });

  it('handles missing providerResult gracefully (only reference + providerReference set)', () => {
    const outcome: MoneyOutcome = {
      kind: 'succeeded',
      reference: 'TRF-u1-1',
      providerReference: 'TRF-pstk-77',
      // providerResult intentionally omitted
    };
    const res = mapOutcomeToResponse(outcome, 'TRF-u1-1');
    expect(res.status).toBe(200);
    expect(res.body.reference).toBe('TRF-pstk-77');
  });

  it('overrides any reference field already on the provider result', () => {
    // Defensive: if the provider returns its own `reference` field with a
    // different value (eg. a normalised one), the route's mapping should
    // pin it to the canonical providerReference for client consistency.
    const outcome: MoneyOutcome = {
      kind: 'succeeded',
      reference: 'TRF-u1-1',
      providerReference: 'TRF-canonical',
      providerResult: { reference: 'TRF-something-else', status: 'ok' },
    };
    const res = mapOutcomeToResponse(outcome, 'TRF-u1-1');
    expect(res.body.reference).toBe('TRF-canonical');
    expect(res.body.status).toBe('ok');
  });
});

describe('STG3-B-2 — outcome→HTTP mapping is exhaustive', () => {
  it('all three outcome kinds are reachable and produce distinct status codes', () => {
    const statuses = new Set<number>();
    statuses.add(
      mapOutcomeToResponse(
        { kind: 'succeeded', reference: 'r', providerReference: 'p' },
        'r',
      ).status,
    );
    statuses.add(
      mapOutcomeToResponse(
        { kind: 'claim_lost', reference: 'r', reason: 'duplicate' },
        'r',
      ).status,
    );
    statuses.add(
      mapOutcomeToResponse(
        {
          kind: 'compensated',
          reference: 'r',
          providerError: 'err',
          compensation: 'in_line',
        },
        'r',
      ).status,
    );
    expect(statuses).toEqual(new Set([200, 409, 502]));
  });
});
