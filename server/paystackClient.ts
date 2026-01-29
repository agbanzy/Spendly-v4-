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

  async createTransferRecipient(name: string, accountNumber: string, bankCode: string) {
    return paystackRequest('/transferrecipient', 'POST', {
      type: 'nuban',
      name,
      account_number: accountNumber,
      bank_code: bankCode,
      currency: 'NGN',
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

  async createCustomer(email: string, firstName: string, lastName: string, phone?: string) {
    return paystackRequest('/customer', 'POST', {
      email,
      first_name: firstName,
      last_name: lastName,
      phone,
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
};
