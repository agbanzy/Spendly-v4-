/**
 * Payment Utilities Module
 * Provides safe money arithmetic, error mapping, structured logging, and currency validation
 * for payment processing operations.
 */

// ============================================================================
// 1. MONEY UTILITY - Safe integer arithmetic in cents/kobo
// ============================================================================

/**
 * Money utility class for safe monetary arithmetic using minor units (cents/kobo).
 * All internal calculations use integers to avoid floating-point precision issues.
 */
export class Money {
  /**
   * Convert major units (dollars/naira) to minor units (cents/kobo)
   * @param amount The amount in major units
   * @returns Amount in minor units (multiplied by 100)
   */
  static toMinor(amount: number | string): number {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return Math.round(num * 100);
  }

  /**
   * Convert minor units (cents/kobo) to major units (dollars/naira)
   * @param amountInMinor The amount in minor units
   * @returns Amount in major units (divided by 100)
   */
  static toMajor(amountInMinor: number): number {
    return amountInMinor / 100;
  }

  /**
   * Safe addition in minor units, returns result in major units
   * @param a First amount (major units)
   * @param b Second amount (major units)
   * @returns Sum in major units
   */
  static add(a: number | string, b: number | string): number {
    return Money.toMajor(Money.toMinor(a) + Money.toMinor(b));
  }

  /**
   * Safe subtraction in minor units, returns result in major units
   * @param a First amount (major units)
   * @param b Second amount to subtract (major units)
   * @returns Difference in major units
   */
  static subtract(a: number | string, b: number | string): number {
    return Money.toMajor(Money.toMinor(a) - Money.toMinor(b));
  }

  /**
   * Compare two amounts
   * @param a First amount
   * @param b Second amount
   * @returns -1 if a < b, 0 if a === b, 1 if a > b
   */
  static compare(a: number | string, b: number | string): number {
    const diff = Money.toMinor(a) - Money.toMinor(b);
    return diff < 0 ? -1 : diff > 0 ? 1 : 0;
  }

  /**
   * Format amount for display with currency symbol
   * @param amount The amount in major units
   * @param currency ISO 4217 currency code (default: USD)
   * @returns Formatted string with currency symbol
   */
  static format(amount: number | string, currency: string = 'USD'): string {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    const symbols: Record<string, string> = {
      USD: '$',
      GBP: '£',
      EUR: '€',
      NGN: '₦',
      GHS: 'GH₵',
      ZAR: 'R',
      KES: 'KSh',
    };
    const symbol = symbols[currency] || currency + ' ';
    return `${symbol}${num.toFixed(2)}`;
  }

  /**
   * Validate that amount is positive, finite, and within safe range
   * @param amount The amount to validate
   * @returns True if amount is valid, false otherwise
   */
  static isValid(amount: number | string): boolean {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return !isNaN(num) && num > 0 && num <= 1_000_000_000 && isFinite(num);
  }
}

// ============================================================================
// 2. PAYMENT ERROR MAPPER - Map errors to user-friendly messages
// ============================================================================

/**
 * Normalized payment error response sent to clients
 * Never exposes internal system details
 */
export interface PaymentError {
  /** User-friendly error message */
  userMessage: string;
  /** HTTP status code to return */
  statusCode: number;
  /** Unique identifier for this error occurrence (for support reference) */
  correlationId: string;
  /** Payment provider that generated the error (if applicable) */
  provider?: string;
}

/**
 * Map internal payment errors to user-friendly PaymentError responses
 * Logs full error details internally while exposing only safe messages to users
 * @param error The error object from payment provider or internal code
 * @param provider Optional identifier for the payment provider
 * @returns Normalized PaymentError safe for client response
 */
export function mapPaymentError(error: any, provider?: string): PaymentError {
  const correlationId = generateCorrelationId();

  // Log full error internally with correlation ID for debugging
  paymentLogger.error('payment_error', {
    correlationId,
    provider,
    internalMessage: error.message,
    stack: error.stack?.split('\n')[0],
  });

  // Map to user-friendly messages based on error type
  const message = error.message?.toLowerCase() || '';

  if (message.includes('insufficient') || message.includes('balance')) {
    return {
      userMessage: 'Insufficient funds for this transaction.',
      statusCode: 400,
      correlationId,
      provider,
    };
  }

  if (message.includes('invalid') && message.includes('account')) {
    return {
      userMessage: 'The recipient account details are invalid. Please check and try again.',
      statusCode: 400,
      correlationId,
      provider,
    };
  }

  if (message.includes('duplicate') || message.includes('idempotent')) {
    return {
      userMessage: 'This transaction has already been processed.',
      statusCode: 409,
      correlationId,
      provider,
    };
  }

  if (message.includes('rate') || message.includes('limit') || message.includes('throttl')) {
    return {
      userMessage: 'Too many requests. Please wait a moment and try again.',
      statusCode: 429,
      correlationId,
      provider,
    };
  }

  if (
    message.includes('authentication') ||
    message.includes('unauthorized') ||
    message.includes('api key')
  ) {
    return {
      userMessage: 'Payment service temporarily unavailable. Please try again later.',
      statusCode: 503,
      correlationId,
      provider,
    };
  }

  if (
    message.includes('timeout') ||
    message.includes('ECONNREFUSED') ||
    message.includes('network')
  ) {
    return {
      userMessage: 'Payment service is temporarily unreachable. Please try again in a few minutes.',
      statusCode: 503,
      correlationId,
      provider,
    };
  }

  if (
    message.includes('currency') &&
    (message.includes('not supported') || message.includes('invalid'))
  ) {
    return {
      userMessage: 'This currency is not supported for the selected country.',
      statusCode: 400,
      correlationId,
      provider,
    };
  }

  // Default: generic error that doesn't leak internal details
  return {
    userMessage: 'An error occurred processing your payment. Please try again or contact support.',
    statusCode: 500,
    correlationId,
    provider,
  };
}

/**
 * Generate a unique correlation ID for error tracking
 * @returns Unique correlation ID string
 */
function generateCorrelationId(): string {
  return `pay_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

// ============================================================================
// 3. STRUCTURED PAYMENT LOGGER - JSON logging for payment operations
// ============================================================================

/**
 * Structured payment logger for payment operations
 * All logs are emitted as JSON for easy parsing and aggregation
 */
export const paymentLogger = {
  /**
   * Log an informational message about a payment operation
   * @param operation Name of the operation
   * @param data Additional context data to log
   */
  info(operation: string, data: Record<string, any> = {}): void {
    console.log(
      JSON.stringify({
        level: 'info',
        service: 'payment',
        operation,
        timestamp: new Date().toISOString(),
        ...data,
      })
    );
  },

  /**
   * Log a warning about a payment operation
   * @param operation Name of the operation
   * @param data Additional context data to log
   */
  warn(operation: string, data: Record<string, any> = {}): void {
    console.warn(
      JSON.stringify({
        level: 'warn',
        service: 'payment',
        operation,
        timestamp: new Date().toISOString(),
        ...data,
      })
    );
  },

  /**
   * Log an error from a payment operation
   * @param operation Name of the operation
   * @param data Additional context data to log
   */
  error(operation: string, data: Record<string, any> = {}): void {
    console.error(
      JSON.stringify({
        level: 'error',
        service: 'payment',
        operation,
        timestamp: new Date().toISOString(),
        ...data,
      })
    );
  },

  /**
   * Track an async payment operation with timing and automatic error logging
   * Logs operation start, completion, and any failures with duration
   * @param operation Name of the operation
   * @param metadata Additional context to include in all operation logs
   * @param fn Async function to execute
   * @returns Result from the function
   * @throws Re-throws any error from fn after logging
   */
  async trackOperation<T>(
    operation: string,
    metadata: Record<string, any>,
    fn: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    const correlationId = generateCorrelationId();

    paymentLogger.info(`${operation}_started`, {
      correlationId,
      ...metadata,
    });

    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      paymentLogger.info(`${operation}_completed`, {
        correlationId,
        duration,
        ...metadata,
      });
      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      paymentLogger.error(`${operation}_failed`, {
        correlationId,
        duration,
        error: error.message,
        ...metadata,
      });
      throw error;
    }
  },
};

// ============================================================================
// 4. CURRENCY VALIDATOR - Validate currency support by provider
// ============================================================================

/**
 * Mapping of payment providers to their supported currencies
 */
const PROVIDER_CURRENCIES: Record<string, string[]> = {
  stripe: [
    'USD',
    'EUR',
    'GBP',
    'CAD',
    'AUD',
    'JPY',
    'CHF',
    'SEK',
    'NOK',
    'DKK',
    'ISK',
  ],
  paystack: [
    'NGN',
    'GHS',
    'ZAR',
    'KES',
    'USD',
    'EGP',
    'XOF',
    'RWF',
  ],
};

/**
 * Validation result for currency support
 */
export interface CurrencyValidationResult {
  /** Whether the currency is supported */
  valid: boolean;
  /** Error message if currency is not supported */
  message?: string;
}

/**
 * Validate that a currency is supported by the specified payment provider
 * @param currency ISO 4217 currency code
 * @param provider Payment provider identifier
 * @returns Validation result with message if invalid
 */
export function validateCurrencyForProvider(
  currency: string,
  provider: 'stripe' | 'paystack'
): CurrencyValidationResult {
  const supported = PROVIDER_CURRENCIES[provider];

  if (!supported) {
    return {
      valid: false,
      message: `Unknown payment provider: ${provider}`,
    };
  }

  const currencyUpper = currency.toUpperCase();
  if (!supported.includes(currencyUpper)) {
    return {
      valid: false,
      message: `Currency ${currency} is not supported by ${provider}. Supported: ${supported.join(', ')}`,
    };
  }

  return { valid: true };
}
