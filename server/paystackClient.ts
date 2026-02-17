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

async function paystackRequest(endpoint: string, method: string = 'GET', body?: any) {
  const secretKey = getPaystackSecretKey();
  
  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${PAYSTACK_BASE_URL}${endpoint}`, options);
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.message || 'Paystack API error');
  }
  
  return data;
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

  async verifyTransaction(reference: string) {
    return paystackRequest(`/transaction/verify/${reference}`);
  },

  async createTransferRecipient(name: string, accountNumber: string, bankCode: string, currency: string = 'NGN') {
    return paystackRequest('/transferrecipient', 'POST', {
      type: 'nuban',
      name,
      account_number: accountNumber,
      bank_code: bankCode,
      currency,
    });
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
    return paystackRequest(`/customer/${customerCode}/identification`, 'POST', {
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

  async getBalance() {
    return paystackRequest('/balance');
  },

  async listTransactions(perPage: number = 50, page: number = 1) {
    return paystackRequest(`/transaction?perPage=${perPage}&page=${page}`);
  },

  async resolveAccount(accountNumber: string, bankCode: string) {
    return paystackRequest(`/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`);
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
    return paystackRequest(`/transfer/${transferCode}`, 'GET');
  },

  async verifyTransfer(reference: string) {
    return paystackRequest(`/transfer/verify/${reference}`, 'GET');
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

  // ==================== BILL PAYMENTS / UTILITIES ====================

  /**
   * List available bill payment providers (billers) for a category.
   * Paystack charges API (formerly bills API) uses the /integration endpoint
   * to fetch available billers for categories like airtime, data, power, tv, internet.
   */
  async listBillers(category?: string) {
    const query = category ? `?category=${encodeURIComponent(category)}` : '';
    return paystackRequest(`/integration/payment/biller${query}`, 'GET');
  },

  /**
   * Validate a customer reference (phone number, meter number, smartcard number)
   * before making a bill payment.
   */
  async validateBillCustomer(itemCode: string, code: string, customer: string) {
    return paystackRequest('/integration/payment/validate-customer', 'POST', {
      item_code: itemCode,
      code,
      customer,
    });
  },

  /**
   * Create a bill payment order (airtime, data, electricity, cable, internet).
   * This is the core method for all utility payments through Paystack.
   *
   * @param amount Amount in major units (naira). Will be converted to kobo internally by Paystack for some billers.
   * @param billerCode The biller's code from listBillers
   * @param itemCode The specific item/plan code
   * @param customer Customer reference (phone, meter, smartcard number)
   * @param metadata Optional metadata
   */
  async createBillPayment(amount: number, billerCode: string, itemCode: string, customer: string, metadata?: any) {
    return paystackRequest('/integration/payment/create-order', 'POST', {
      amount,
      biller_code: billerCode,
      item_code: itemCode,
      customer,
      metadata,
    });
  },

  /**
   * Purchase airtime directly via Paystack.
   * Simplified wrapper for common airtime purchases.
   */
  async purchaseAirtime(amount: number, phone: string, countryCode: string = 'NG') {
    // Paystack's dedicated airtime endpoint
    return paystackRequest('/charge', 'POST', {
      amount: Math.round(amount * 100), // kobo
      email: `airtime-${phone}@spendly.internal`, // Paystack requires email
      metadata: {
        custom_fields: [
          { display_name: 'Phone Number', variable_name: 'phone', value: phone },
          { display_name: 'Type', variable_name: 'type', value: 'airtime' },
          { display_name: 'Country', variable_name: 'country', value: countryCode },
        ],
      },
    });
  },

  /**
   * Fetch the status of a bill payment order.
   */
  async getBillPaymentStatus(orderId: string) {
    return paystackRequest(`/integration/payment/order/${orderId}`, 'GET');
  },

  /**
   * List bill payment history.
   */
  async listBillPayments(params?: { perPage?: number; page?: number; from?: string; to?: string }) {
    const query = new URLSearchParams();
    if (params?.perPage) query.append('perPage', String(params.perPage));
    if (params?.page) query.append('page', String(params.page));
    if (params?.from) query.append('from', params.from);
    if (params?.to) query.append('to', params.to);
    return paystackRequest(`/integration/payment/orders?${query.toString()}`, 'GET');
  },
};
