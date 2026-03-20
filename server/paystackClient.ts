import { validateNUBAN, validateIBAN } from './lib/validators';

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

function getPaystackSecretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) {
    throw new Error('PAYSTACK_SECRET_KEY environment variable is required');
  }
  return key;
}

export function getPaystackPublicKey(): string {
  const key = process.env.VITE_PAYSTACK_PUBLIC_KEY;
  if (!key) {
    throw new Error('VITE_PAYSTACK_PUBLIC_KEY environment variable is required');
  }
  return key;
}

const PAYSTACK_TIMEOUT_MS = 30000; // 30 second request timeout

/**
 * Map country code to Paystack transfer recipient type.
 * Each country has a specific banking/payment rail.
 */
function getRecipientTypeForCountry(countryCode: string): string {
  const recipientTypes: Record<string, string> = {
    NG: 'nuban',         // Nigerian Uniform Bank Account Number
    GH: 'ghipss',        // Ghana Interbank Payment and Settlement System
    ZA: 'basa',          // Banking Association South Africa
    KE: 'mobile_money',  // Kenya (M-Pesa dominant)
    RW: 'mobile_money',  // Rwanda (MTN MoMo dominant)
    CI: 'mobile_money',  // Côte d'Ivoire (Orange Money, MTN MoMo)
    EG: 'nuban',         // Egypt (bank transfers via Paystack)
  };
  return recipientTypes[countryCode.toUpperCase()] || 'nuban';
}

/**
 * Validate bank/mobile details format for a specific country.
 * Returns { valid, message } indicating if the details are acceptable.
 */
export function validateTransferDetails(
  countryCode: string,
  accountNumber: string,
  bankCode: string,
  type?: string
): { valid: boolean; message?: string } {
  const country = countryCode.toUpperCase();
  const recipientType = type || getRecipientTypeForCountry(country);

  if (!accountNumber || accountNumber.trim().length === 0) {
    return { valid: false, message: 'Account number is required' };
  }
  if (!bankCode || bankCode.trim().length === 0) {
    return { valid: false, message: 'Bank code is required' };
  }

  // Country-specific account number validation
  switch (country) {
    case 'NG':
      // NUBAN: exactly 10 digits
      if (!/^\d{10}$/.test(accountNumber)) {
        return { valid: false, message: 'Nigerian account number must be exactly 10 digits' };
      }
      // Bank code: 3 digits
      if (!/^\d{3}$/.test(bankCode)) {
        return { valid: false, message: 'Nigerian bank code must be 3 digits (e.g., 058 for GTBank)' };
      }
      // NUBAN checksum validation (CBN weighted algorithm)
      if (!validateNUBAN(accountNumber, bankCode)) {
        return { valid: false, message: 'Nigerian account number failed NUBAN checksum validation. Please verify the account number and bank code.' };
      }
      break;

    case 'GH':
      // Ghana: variable length, typically 13-16 digits
      if (!/^\d{10,16}$/.test(accountNumber)) {
        return { valid: false, message: 'Ghanaian account number must be 10-16 digits' };
      }
      break;

    case 'ZA':
      // South Africa: typically 10-12 digits
      if (!/^\d{8,12}$/.test(accountNumber)) {
        return { valid: false, message: 'South African account number must be 8-12 digits' };
      }
      // Branch code: 6 digits
      if (!/^\d{6}$/.test(bankCode)) {
        return { valid: false, message: 'South African branch code must be 6 digits' };
      }
      break;

    case 'KE':
      if (recipientType === 'mobile_money') {
        // M-Pesa: starts with 254 or 07/01, 10-12 digits
        if (!/^(254|0)[17]\d{8,9}$/.test(accountNumber)) {
          return { valid: false, message: 'Kenyan mobile number must start with 254, 07, or 01 (e.g., 254712345678)' };
        }
      } else {
        if (!/^\d{8,14}$/.test(accountNumber)) {
          return { valid: false, message: 'Kenyan account number must be 8-14 digits' };
        }
      }
      break;

    case 'RW':
      if (recipientType === 'mobile_money') {
        // Rwanda mobile: starts with 250 or 07, 10-12 digits
        if (!/^(250|07)\d{7,9}$/.test(accountNumber)) {
          return { valid: false, message: 'Rwandan mobile number must start with 250 or 07 (e.g., 250781234567)' };
        }
      }
      break;

    case 'CI':
      if (recipientType === 'mobile_money') {
        // Côte d'Ivoire mobile: starts with 225 or 0, 10-12 digits
        if (!/^(225|0)\d{8,10}$/.test(accountNumber)) {
          return { valid: false, message: 'Ivorian mobile number must start with 225 or 0 (e.g., 2250701234567)' };
        }
      }
      break;

    case 'EG':
      // Egypt: typically 13-29 digit IBAN or account number
      if (!/^\d{10,29}$/.test(accountNumber.replace(/\s/g, ''))) {
        return { valid: false, message: 'Egyptian account number must be 10-29 digits' };
      }
      break;
  }

  return { valid: true };
}

/**
 * Validate bank details for Stripe countries.
 */
export function validateStripeBankDetails(
  countryCode: string,
  details: {
    accountNumber?: string;
    routingNumber?: string;
    sortCode?: string;
    bsbNumber?: string;
    iban?: string;
  }
): { valid: boolean; message?: string } {
  const country = countryCode.toUpperCase();

  switch (country) {
    case 'US':
    case 'CA':
      // ACH: routing number (9 digits) + account number (4-17 digits)
      if (!details.routingNumber || !/^\d{9}$/.test(details.routingNumber)) {
        return { valid: false, message: 'US/CA routing number must be exactly 9 digits' };
      }
      if (!details.accountNumber || !/^\d{4,17}$/.test(details.accountNumber)) {
        return { valid: false, message: 'US/CA account number must be 4-17 digits' };
      }
      break;

    case 'GB':
      // BACS: sort code (6 digits, may have hyphens) + account number (8 digits)
      const sortCode = (details.sortCode || '').replace(/-/g, '');
      if (!/^\d{6}$/.test(sortCode)) {
        return { valid: false, message: 'UK sort code must be 6 digits (e.g., 20-00-00)' };
      }
      if (!details.accountNumber || !/^\d{8}$/.test(details.accountNumber)) {
        return { valid: false, message: 'UK account number must be exactly 8 digits' };
      }
      break;

    case 'AU':
      // BECS: BSB (6 digits) + account number (5-9 digits)
      const bsb = (details.bsbNumber || '').replace(/-/g, '');
      if (!/^\d{6}$/.test(bsb)) {
        return { valid: false, message: 'Australian BSB must be 6 digits (e.g., 062-000)' };
      }
      if (!details.accountNumber || !/^\d{5,9}$/.test(details.accountNumber)) {
        return { valid: false, message: 'Australian account number must be 5-9 digits' };
      }
      break;

    default:
      // EU / SEPA: Full IBAN validation with MOD-97 checksum
      if (details.iban) {
        const ibanResult = validateIBAN(details.iban);
        if (!ibanResult.valid) {
          return { valid: false, message: ibanResult.error || 'Invalid IBAN' };
        }
      } else if (details.accountNumber) {
        // Check if the account number looks like an IBAN (starts with 2 letters)
        if (/^[A-Za-z]{2}\d{2}/.test(details.accountNumber)) {
          const ibanResult = validateIBAN(details.accountNumber);
          if (!ibanResult.valid) {
            return { valid: false, message: ibanResult.error || 'Invalid IBAN format in account number field' };
          }
        } else if (details.accountNumber.length < 5) {
          return { valid: false, message: 'Account number must be at least 5 characters' };
        }
      } else {
        return { valid: false, message: 'IBAN or account number is required for EU transfers' };
      }
      break;
  }

  return { valid: true };
}

const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 1000;

function isRetryable(error: any, statusCode?: number): boolean {
  // Network errors and timeouts
  if (error.name === 'AbortError' || error.code === 'ECONNRESET' || error.code === 'ECONNREFUSED') return true;
  if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) return true;
  // Server errors (5xx) are transient
  if (statusCode && statusCode >= 500) return true;
  return false;
}

async function paystackRequest(endpoint: string, method: string = 'GET', body?: any) {
  const secretKey = getPaystackSecretKey();
  let lastError: any;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PAYSTACK_TIMEOUT_MS);

    try {
      const options: RequestInit = {
        method,
        headers: {
          'Authorization': `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      };

      if (body) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(`${PAYSTACK_BASE_URL}${endpoint}`, options);
      const data = await response.json();

      if (!response.ok) {
        const err = new Error(data.message || `Paystack API error (${response.status})`);
        (err as any).statusCode = response.status;

        // Only retry on 5xx; 4xx errors are permanent
        if (isRetryable(err, response.status) && attempt < MAX_RETRIES) {
          lastError = err;
          const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        throw err;
      }

      return data;
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        lastError = new Error(`Paystack API request to ${endpoint} timed out after ${PAYSTACK_TIMEOUT_MS / 1000}s`);
      } else {
        lastError = error;
      }

      if (isRetryable(error) && attempt < MAX_RETRIES) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      throw lastError;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError;
}

export const paystackClient = {
  async initializeTransaction(email: string, amount: number, currency: string = 'NGN', metadata?: any, callbackUrl?: string) {
    const amountInKobo = Math.round(amount * 100);
    const payload: any = {
      email,
      amount: amountInKobo,
      currency,
      metadata,
    };
    if (callbackUrl) {
      payload.callback_url = callbackUrl;
    }
    return paystackRequest('/transaction/initialize', 'POST', payload);
  },

  /**
   * Create a transfer recipient with country-appropriate account type.
   * - NG: nuban (Nigerian Uniform Bank Account Number)
   * - GH: ghipss (Ghana Interbank Payment and Settlement System)
   * - ZA: basa (Banking Association South Africa)
   * - KE/RW/CI: mobile_money or authorization
   * @param name Recipient name
   * @param accountNumber Bank account or mobile number
   * @param bankCode Bank code (or mobile money provider code)
   * @param currency ISO 4217 currency code
   * @param countryCode ISO 3166-1 alpha-2 country code (default: NG)
   * @param type Override recipient type (e.g., 'mobile_money' for M-Pesa)
   */
  async createTransferRecipient(
    name: string,
    accountNumber: string,
    bankCode: string,
    currency: string = 'NGN',
    countryCode: string = 'NG',
    type?: string
  ) {
    // Determine the correct recipient type based on country
    const recipientType = type || getRecipientTypeForCountry(countryCode);

    const payload: Record<string, any> = {
      type: recipientType,
      name,
      account_number: accountNumber,
      bank_code: bankCode,
      currency,
    };

    // Mobile money recipients need additional metadata
    if (recipientType === 'mobile_money') {
      payload.metadata = {
        country_code: countryCode,
        mobile_provider: bankCode,
      };
    }

    return paystackRequest('/transferrecipient', 'POST', payload);
  },

  async initiateTransfer(amount: number, recipientCode: string, reason: string) {
    const amountInKobo = Math.round(amount * 100);
    return paystackRequest('/transfer', 'POST', {
      source: 'balance',
      amount: amountInKobo,
      recipient: recipientCode,
      reason,
    });
  },

  async getBanks(country: string = 'nigeria') {
    return paystackRequest(`/bank?country=${country}`);
  },

  async createVirtualAccount(customerId: string, preferredBank: string = 'wema-bank') {
    return paystackRequest('/dedicated_account', 'POST', {
      customer: customerId,
      preferred_bank: preferredBank,
    });
  },

  async assignDedicatedAccount(params: {
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
    preferredBank?: string;
    country?: string;
    bvn?: string;
    accountNumber?: string;
    bankCode?: string;
    middleName?: string;
  }) {
    const payload: any = {
      email: params.email,
      first_name: params.firstName,
      last_name: params.lastName,
      phone: params.phone,
      preferred_bank: params.preferredBank || 'wema-bank',
      country: params.country || 'NG',
    };
    if (params.bvn) payload.bvn = params.bvn;
    if (params.accountNumber) payload.account_number = params.accountNumber;
    if (params.bankCode) payload.bank_code = params.bankCode;
    if (params.middleName) payload.middle_name = params.middleName;
    return paystackRequest('/dedicated_account/assign', 'POST', payload);
  },

  async fetchDedicatedAccountProviders() {
    return paystackRequest('/dedicated_account/available_providers');
  },

  async createCustomer(email: string, firstName: string, lastName: string, phone?: string) {
    return paystackRequest('/customer', 'POST', {
      email,
      first_name: firstName,
      last_name: lastName,
      phone,
    });
  },

  async validateCustomer(customerCode: string, params: {
    type: string;
    value: string;
    country: string;
    bvn: string;
    bankCode: string;
    accountNumber: string;
    firstName: string;
    lastName: string;
    middleName?: string;
  }) {
    return paystackRequest(`/customer/${encodeURIComponent(customerCode)}/identification`, 'POST', {
      type: params.type || 'bank_account',
      value: params.value || params.bvn,
      country: params.country || 'NG',
      bvn: params.bvn,
      bank_code: params.bankCode,
      account_number: params.accountNumber,
      first_name: params.firstName,
      last_name: params.lastName,
      middle_name: params.middleName,
    });
  },

  // Alias for fetchBalance (backward compatibility)
  async getBalance() {
    return this.fetchBalance();
  },

  // Alias for resolveAccountNumber (backward compatibility)
  async resolveAccount(accountNumber: string, bankCode: string) {
    return this.resolveAccountNumber(accountNumber, bankCode);
  },

  async createSubscriptionPlan(name: string, amount: number, interval: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'biannually' | 'annually', description?: string) {
    const amountInKobo = Math.round(amount * 100);
    return paystackRequest('/plan', 'POST', {
      name,
      amount: amountInKobo,
      interval,
      description,
      currency: 'NGN',
    });
  },

  async listPlans() {
    return paystackRequest('/plan');
  },

  async getPlan(planId: string) {
    return paystackRequest(`/plan/${planId}`);
  },

  async createSubscription(customerEmail: string, planCode: string, authorizationCode?: string) {
    const payload: any = {
      customer: customerEmail,
      plan: planCode,
    };
    if (authorizationCode) {
      payload.authorization = authorizationCode;
    }
    return paystackRequest('/subscription', 'POST', payload);
  },

  async enableSubscription(subscriptionCode: string, emailToken: string) {
    return paystackRequest('/subscription/enable', 'POST', {
      code: subscriptionCode,
      token: emailToken,
    });
  },

  async disableSubscription(subscriptionCode: string, emailToken: string) {
    return paystackRequest('/subscription/disable', 'POST', {
      code: subscriptionCode,
      token: emailToken,
    });
  },

  async listSubscriptions(perPage: number = 50, page: number = 1) {
    return paystackRequest(`/subscription?perPage=${perPage}&page=${page}`);
  },

  async chargeAuthorization(email: string, amount: number, authorizationCode: string, reference?: string, metadata?: any) {
    const amountInKobo = Math.round(amount * 100);
    const payload: any = {
      email,
      amount: amountInKobo,
      authorization_code: authorizationCode,
      currency: 'NGN',
      metadata,
    };
    if (reference) {
      payload.reference = reference;
    }
    return paystackRequest('/transaction/charge_authorization', 'POST', payload);
  },

  async listAuthorizations(email: string) {
    return paystackRequest(`/customer/${email}`);
  },

  async deactivateAuthorization(authorizationCode: string) {
    return paystackRequest('/customer/deactivate_authorization', 'POST', {
      authorization_code: authorizationCode,
    });
  },

  async requestReauthorization(email: string, authorizationCode: string) {
    return paystackRequest('/transaction/request_reauthorization', 'POST', {
      email,
      authorization_code: authorizationCode,
    });
  },

  // ==================== VIRTUAL CARD & TRANSFER METHODS ====================

  async createManagedAccount(params: {
    customerId: string;
    currency: string;
    name: string;
    type: 'virtual';
  }) {
    return paystackRequest('/subaccount', 'POST', {
      business_name: params.name,
      settlement_bank: 'wema-bank',
      account_number: '',
      percentage_charge: 0,
      description: `Virtual card wallet - ${params.name}`,
      metadata: {
        type: 'virtual_card',
        customerId: params.customerId,
        currency: params.currency,
      },
    });
  },

  async listTransferRecipients(params?: { perPage?: number; page?: number }) {
    const query = new URLSearchParams();
    if (params?.perPage) query.append('perPage', String(params.perPage));
    if (params?.page) query.append('page', String(params.page));
    return paystackRequest(`/transferrecipient?${query.toString()}`, 'GET');
  },

  async fetchTransfer(transferCode: string) {
    return paystackRequest(`/transfer/${encodeURIComponent(transferCode)}`, 'GET');
  },

  async verifyTransfer(reference: string) {
    return paystackRequest(`/transfer/verify/${encodeURIComponent(reference)}`, 'GET');
  },

  async finalizeTransfer(transferCode: string, otp: string) {
    return paystackRequest('/transfer/finalize_transfer', 'POST', {
      transfer_code: transferCode,
      otp,
    });
  },

  async bulkTransfer(transfers: Array<{
    amount: number;
    recipient: string;
    reason?: string;
    reference?: string;
  }>) {
    return paystackRequest('/transfer/bulk', 'POST', {
      source: 'balance',
      transfers: transfers.map(t => ({
        amount: Math.round(t.amount * 100),
        recipient: t.recipient,
        reason: t.reason || 'Payout',
        reference: t.reference || `bulk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      })),
    });
  },

  async fetchBalance() {
    return paystackRequest('/balance', 'GET');
  },

  async fetchSettlements(params?: { perPage?: number; page?: number; from?: string; to?: string }) {
    const query = new URLSearchParams();
    if (params?.perPage) query.append('perPage', String(params.perPage));
    if (params?.page) query.append('page', String(params.page));
    if (params?.from) query.append('from', params.from);
    if (params?.to) query.append('to', params.to);
    return paystackRequest(`/settlement?${query.toString()}`, 'GET');
  },

  async listBanks(country?: string) {
    const query = country ? `?country=${country}` : '';
    return paystackRequest(`/bank${query}`, 'GET');
  },

  async resolveAccountNumber(accountNumber: string, bankCode: string) {
    return paystackRequest(`/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`, 'GET');
  },

  /**
   * Resolve BVN (Bank Verification Number) via Paystack API.
   * NOTE: This endpoint requires special Paystack approval.
   * If unavailable, the call will fail and KYC goes to pending_review (safe default).
   */
  async resolveBVN(bvn: string) {
    return paystackRequest(`/bank/resolve_bvn/${encodeURIComponent(bvn)}`, 'GET');
  },

  // ==================== BILL PAYMENTS / UTILITIES ====================
  // NOTE: Paystack does NOT have a dedicated bill payment API.
  // The /integration/payment/ endpoints are not documented in the current API.
  // For utility payments (airtime, data, electricity, cable, internet),
  // use the Paystack Charge API (/charge) or integrate a third-party
  // utility payment provider like Reloadly.

  /**
   * Process a utility payment via Paystack's Charge API.
   * Since Paystack has no native bill payment API, this creates a charge
   * with metadata describing the utility payment intent. The actual utility
   * fulfillment must be handled separately (e.g., via Reloadly or provider API).
   *
   * @param amount Amount in major units (naira/cedis). Converted to kobo/pesewas.
   * @param email Customer's valid email address (required by Paystack).
   * @param utilityType Type of utility (airtime, data, electricity, cable, internet).
   * @param provider Provider name (e.g., MTN, DSTV).
   * @param customerRef Customer reference (phone, meter, smartcard number).
   * @param metadata Optional additional metadata.
   */
  async processUtilityCharge(
    amount: number,
    email: string,
    utilityType: string,
    provider: string,
    customerRef: string,
    currency?: string,
    metadata?: Record<string, any>
  ) {
    if (!email || !email.includes('@')) {
      throw new Error('A valid customer email is required for utility payments');
    }
    if (amount <= 0 || amount > 1000000) {
      throw new Error('Utility payment amount must be between 0 and 1,000,000');
    }
    const reference = `UTIL-${utilityType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const payload: Record<string, any> = {
      amount: Math.round(amount * 100),
      email,
      reference,
    };
    if (currency) {
      payload.currency = currency.toUpperCase();
    }
    return paystackRequest('/transaction/initialize', 'POST', {
      ...payload,
      metadata: {
        ...metadata,
        custom_fields: [
          { display_name: 'Utility Type', variable_name: 'utility_type', value: utilityType },
          { display_name: 'Provider', variable_name: 'provider', value: provider },
          { display_name: 'Customer Reference', variable_name: 'customer_ref', value: customerRef },
        ],
        utility_type: utilityType,
        provider_name: provider,
        customer_ref: customerRef,
        is_utility_payment: true,
      },
    });
  },

  /**
   * Verify a Paystack transaction by reference.
   * Use this to confirm payment status after charge completion.
   */
  async verifyTransaction(reference: string) {
    return paystackRequest(`/transaction/verify/${encodeURIComponent(reference)}`, 'GET');
  },

  /**
   * List transactions with optional filters.
   */
  async listTransactions(params?: { perPage?: number; page?: number; from?: string; to?: string; status?: string }) {
    const query = new URLSearchParams();
    if (params?.perPage) query.append('perPage', String(params.perPage));
    if (params?.page) query.append('page', String(params.page));
    if (params?.from) query.append('from', params.from);
    if (params?.to) query.append('to', params.to);
    if (params?.status) query.append('status', params.status);
    return paystackRequest(`/transaction?${query.toString()}`, 'GET');
  },

  // ==================== REFUNDS ====================

  /**
   * Create a refund for a Paystack transaction.
   * @param transactionReference The transaction reference or ID to refund
   * @param amount Optional partial refund amount in major units (naira). Omit for full refund.
   * @param merchantNote Optional internal note about the refund reason.
   * @param customerNote Optional message shown to the customer.
   */
  async createRefund(transactionReference: string, amount?: number, merchantNote?: string, customerNote?: string) {
    const payload: Record<string, any> = {
      transaction: transactionReference,
    };
    if (amount !== undefined && amount > 0) {
      payload.amount = Math.round(amount * 100); // Convert to kobo
    }
    if (merchantNote) payload.merchant_note = merchantNote;
    if (customerNote) payload.customer_note = customerNote;
    return paystackRequest('/refund', 'POST', payload);
  },

  /**
   * Fetch details of a specific refund.
   * @param refundId The Paystack refund ID
   */
  async fetchRefund(refundId: string) {
    return paystackRequest(`/refund/${encodeURIComponent(refundId)}`, 'GET');
  },

  /**
   * List refunds with optional pagination.
   */
  async listRefunds(params?: { perPage?: number; page?: number; from?: string; to?: string }) {
    const query = new URLSearchParams();
    if (params?.perPage) query.append('perPage', String(params.perPage));
    if (params?.page) query.append('page', String(params.page));
    if (params?.from) query.append('from', params.from);
    if (params?.to) query.append('to', params.to);
    return paystackRequest(`/refund?${query.toString()}`, 'GET');
  },
};
