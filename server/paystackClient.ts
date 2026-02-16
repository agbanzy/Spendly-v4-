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
};
