import { getUncachableStripeClient, getStripeClient } from './stripeClient';
import { paystackClient } from './paystackClient';
import { Money, paymentLogger, validateCurrencyForProvider, mapPaymentError } from './utils/paymentUtils';

export interface RegionConfig {
  region: string;
  countries: string[];
  currency: string;
  paymentProvider: 'stripe' | 'paystack';
  currencySymbol: string;
}

export const REGION_CONFIGS: RegionConfig[] = [
  {
    region: 'North America',
    countries: ['US', 'CA'],
    currency: 'USD',
    paymentProvider: 'stripe',
    currencySymbol: '$',
  },
  {
    region: 'Europe',
    countries: ['DE', 'FR', 'ES', 'IT', 'NL', 'BE', 'AT', 'CH', 'SE', 'NO', 'DK', 'FI', 'IE', 'PT'],
    currency: 'EUR',
    paymentProvider: 'stripe',
    currencySymbol: '€',
  },
  {
    region: 'United Kingdom',
    countries: ['GB'],
    currency: 'GBP',
    paymentProvider: 'stripe',
    currencySymbol: '£',
  },
  {
    region: 'Australia',
    countries: ['AU'],
    currency: 'AUD',
    paymentProvider: 'stripe',
    currencySymbol: 'A$',
  },
  {
    region: 'Nigeria',
    countries: ['NG'],
    currency: 'NGN',
    paymentProvider: 'paystack',
    currencySymbol: '₦',
  },
  {
    region: 'Ghana',
    countries: ['GH'],
    currency: 'GHS',
    paymentProvider: 'paystack',
    currencySymbol: 'GH₵',
  },
  {
    region: 'South Africa',
    countries: ['ZA'],
    currency: 'ZAR',
    paymentProvider: 'paystack',
    currencySymbol: 'R',
  },
  {
    region: 'Kenya',
    countries: ['KE'],
    currency: 'KES',
    paymentProvider: 'paystack',
    currencySymbol: 'KSh',
  },
  {
    region: 'Egypt',
    countries: ['EG'],
    currency: 'EGP',
    paymentProvider: 'paystack',
    currencySymbol: 'E£',
  },
  {
    region: 'Rwanda',
    countries: ['RW'],
    currency: 'RWF',
    paymentProvider: 'paystack',
    currencySymbol: 'RF',
  },
  {
    region: 'Côte d\'Ivoire',
    countries: ['CI'],
    currency: 'XOF',
    paymentProvider: 'paystack',
    currencySymbol: 'CFA',
  },
];

export function getRegionConfig(countryCode: string): RegionConfig | undefined {
  return REGION_CONFIGS.find(config => config.countries.includes(countryCode.toUpperCase()));
}

export function getPaymentProvider(countryCode: string): 'stripe' | 'paystack' {
  const config = getRegionConfig(countryCode);
  return config?.paymentProvider || 'stripe';
}

export function getCurrencyForCountry(countryCode: string): { currency: string; symbol: string } {
  const config = getRegionConfig(countryCode);
  return {
    currency: config?.currency || 'USD',
    symbol: config?.currencySymbol || '$',
  };
}

export const paymentService = {
  async createPaymentIntent(amount: number, currency: string, countryCode: string, metadata?: any, callbackUrl?: string) {
    const provider = getPaymentProvider(countryCode);

    // Validate currency for provider
    const currencyCheck = validateCurrencyForProvider(currency, provider);
    if (!currencyCheck.valid) {
      throw new Error(currencyCheck.message);
    }

    // Validate amount
    if (!Money.isValid(amount)) {
      throw new Error('Invalid payment amount');
    }

    return paymentLogger.trackOperation('create_payment_intent', { provider, amount, currency, countryCode }, async () => {
      if (provider === 'paystack') {
        const email = metadata?.email;
        if (!email || typeof email !== 'string' || !email.includes('@')) {
          throw new Error('A valid customer email is required for Paystack transactions');
        }
        const paystackCallback = callbackUrl || (process.env.REPLIT_DOMAINS ?
          `https://${process.env.REPLIT_DOMAINS.split(',')[0]}/api/paystack/callback` :
          undefined);
        const result = await paystackClient.initializeTransaction(email, amount, currency, metadata, paystackCallback);
        return {
          provider: 'paystack' as const,
          authorizationUrl: result.data.authorization_url,
          reference: result.data.reference,
          accessCode: result.data.access_code,
        };
      } else {
        const stripe = await getUncachableStripeClient();
        const idempotencyKey = `pi-${currency}-${amount}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Money.toMinor(amount),
          currency: currency.toLowerCase(),
          automatic_payment_methods: { enabled: true },
          metadata,
        }, {
          idempotencyKey,
        });
        return {
          provider: 'stripe' as const,
          clientSecret: paymentIntent.client_secret,
          paymentIntentId: paymentIntent.id,
        };
      }
    });
  },

  async initiateTransfer(amount: number, recipientDetails: any, countryCode: string, reason: string) {
    const provider = getPaymentProvider(countryCode);
    const { currency } = getCurrencyForCountry(countryCode);

    if (!Money.isValid(amount)) {
      throw new Error('Invalid transfer amount');
    }

    return paymentLogger.trackOperation('initiate_transfer', { provider, amount, currency, countryCode, reason }, async () => {
      if (provider === 'paystack') {
        const { accountNumber, bankCode, accountName } = recipientDetails;
        const recipientResult = await paystackClient.createTransferRecipient(
          accountName,
          accountNumber,
          bankCode,
          currency
        );
        const transfer = await paystackClient.initiateTransfer(
          amount,
          recipientResult.data.recipient_code,
          reason
        );
        return {
          provider: 'paystack' as const,
          transferCode: transfer.data.transfer_code,
          status: transfer.data.status,
          reference: transfer.data.reference,
          currency,
        };
      } else {
        const stripe = await getUncachableStripeClient();

        // If stripeAccountId is provided, use Connect Transfer (marketplace model)
        if (recipientDetails.stripeAccountId) {
          const transferIdempotencyKey = `txfr-${recipientDetails.stripeAccountId}-${amount}-${Date.now()}`;
          const transfer = await stripe.transfers.create({
            amount: Money.toMinor(amount),
            currency: recipientDetails.currency || currency.toLowerCase(),
            destination: recipientDetails.stripeAccountId,
            description: reason,
          }, {
            idempotencyKey: transferIdempotencyKey,
          });
          return {
            provider: 'stripe' as const,
            transferId: transfer.id,
            status: transfer.destination ? 'pending' : 'failed',
            reference: transfer.id,
            currency,
          };
        }

        // For bank account payouts, create external account and payout
        // This supports US (ACH), EU (SEPA), UK (BACS), AU (BECS)
        const bankAccountParams: any = {
          object: 'bank_account',
          country: recipientDetails.country || countryCode,
          currency: recipientDetails.currency || currency.toLowerCase(),
          account_holder_name: recipientDetails.accountName,
          account_holder_type: recipientDetails.accountType || 'individual',
        };

        // Route by country for correct bank details
        const upperCountry = (recipientDetails.country || countryCode).toUpperCase();
        if (['US', 'CA'].includes(upperCountry)) {
          // ACH requires routing number + account number
          bankAccountParams.routing_number = recipientDetails.routingNumber || recipientDetails.bankCode;
          bankAccountParams.account_number = recipientDetails.accountNumber;
        } else if (['GB'].includes(upperCountry)) {
          // BACS requires sort code (6 digits) + account number (8 digits)
          bankAccountParams.routing_number = recipientDetails.sortCode || recipientDetails.bankCode;
          bankAccountParams.account_number = recipientDetails.accountNumber;
        } else if (['AU'].includes(upperCountry)) {
          // BECS requires BSB (6 digits) + account number
          bankAccountParams.routing_number = recipientDetails.bsbNumber || recipientDetails.bankCode;
          bankAccountParams.account_number = recipientDetails.accountNumber;
        } else {
          // SEPA (EU) requires IBAN
          bankAccountParams.account_number = recipientDetails.iban || recipientDetails.accountNumber;
        }

        // For bank transfers, use Stripe Connect with custom accounts
        // First, create or retrieve connected account for the recipient
        // Then transfer to that account's bank
        // Alternative: Use PaymentIntents with bank_transfer payment method

        // Create a bank token for the external account
        let destinationBankAccountId: string | undefined;
        try {
          const token = await stripe.tokens.create({
            bank_account: bankAccountParams as any,
          });

          // For platform-level payouts, attach bank account to platform then payout
          // For now, create payout with destination info in metadata for reconciliation
          destinationBankAccountId = token.id;
        } catch (tokenErr: any) {
          console.error('Failed to create bank token:', tokenErr.message);
        }

        // Create a Stripe payout (requires the platform to have sufficient balance)
        const payout = await stripe.payouts.create({
          amount: Money.toMinor(amount),
          currency: currency.toLowerCase(),
          method: 'standard',
          description: reason,
          ...(destinationBankAccountId ? { destination: destinationBankAccountId } : {}),
          metadata: {
            recipientName: recipientDetails.accountName,
            countryCode,
            recipientAccount: recipientDetails.accountNumber || recipientDetails.iban || '',
            recipientBank: recipientDetails.routingNumber || recipientDetails.sortCode || recipientDetails.bsb || '',
          },
        });

        return {
          provider: 'stripe' as const,
          transferId: payout.id,
          status: payout.status === 'paid' ? 'completed' : payout.status === 'pending' ? 'pending' : 'processing',
          reference: payout.id,
          currency,
        };
      }
    });
  },

  async createVirtualAccount(customerEmail: string, firstName: string, lastName: string, countryCode: string, phone?: string, bvn?: string, bankAccountNumber?: string, bankCode?: string) {
    const provider = getPaymentProvider(countryCode);
    
    if (provider === 'paystack') {
      const safePhone = phone || '';
      const safeLastName = lastName || firstName || 'User';
      
      try {
        const result = await paystackClient.assignDedicatedAccount({
          email: customerEmail,
          firstName: firstName || 'User',
          lastName: safeLastName,
          phone: safePhone,
          preferredBank: 'wema-bank',
          country: countryCode || 'NG',
          bvn,
          accountNumber: bankAccountNumber,
          bankCode,
        });

        const accountData = result.data || {};
        return {
          provider: 'paystack',
          accountNumber: accountData.account_number || '',
          bankName: accountData.bank?.name || 'Wema Bank',
          bankCode: accountData.bank?.slug || 'wema-bank',
          accountName: accountData.account_name || `${firstName} ${safeLastName}`,
          customerCode: accountData.customer?.customer_code || '',
          status: accountData.assignment?.assignee_type ? 'assigned' : 'pending',
        };
      } catch (assignError: any) {
        paymentLogger.warn('dva_assign_failed_trying_two_step', { error: assignError.message, email: customerEmail });
        
        const customer = await paystackClient.createCustomer(customerEmail, firstName || 'User', safeLastName, safePhone);
        const customerCode = customer.data?.customer_code;
        
        if (!customerCode) {
          throw new Error('Failed to create Paystack customer');
        }

        try {
          const account = await paystackClient.createVirtualAccount(customerCode);
          return {
            provider: 'paystack',
            accountNumber: account.data?.account_number || '',
            bankName: account.data?.bank?.name || 'Wema Bank',
            bankCode: account.data?.bank?.slug || 'wema-bank',
            accountName: account.data?.account_name || `${firstName} ${safeLastName}`,
            customerCode,
            status: 'active',
          };
        } catch (dvaError: any) {
          paymentLogger.warn('dva_creation_failed', { error: dvaError.message, customerCode, email: customerEmail });
          return {
            provider: 'paystack',
            accountNumber: '',
            bankName: 'Wema Bank',
            bankCode: 'wema-bank',
            accountName: `${firstName} ${safeLastName}`,
            customerCode,
            status: 'pending_validation',
            message: 'Account pending - customer validation required. Complete BVN verification to get a dedicated NUBAN.',
          };
        }
      }
    } else {
      return {
        provider: 'stripe',
        message: 'Stripe virtual accounts require Financial Connections setup',
        accountType: 'stripe_treasury',
      };
    }
  },

  async verifyPayment(reference: string, provider: 'stripe' | 'paystack') {
    return paymentLogger.trackOperation('verify_payment', { provider, reference }, async () => {
      if (provider === 'paystack') {
        const result = await paystackClient.verifyTransaction(reference);
        return {
          provider: 'paystack' as const,
          status: result.data.status,
          amount: Money.toMajor(result.data.amount),
          currency: result.data.currency,
          paidAt: result.data.paid_at,
          channel: result.data.channel,
        };
      } else {
        const stripe = await getUncachableStripeClient();
        const paymentIntent = await stripe.paymentIntents.retrieve(reference);
        return {
          provider: 'stripe' as const,
          status: paymentIntent.status,
          amount: Money.toMajor(paymentIntent.amount),
          currency: paymentIntent.currency,
        };
      }
    });
  },

  async getBanks(countryCode: string) {
    const provider = getPaymentProvider(countryCode);
    
    if (provider === 'paystack') {
      // Map country codes to country names for Paystack API
      const countryNameMap: Record<string, string> = {
        'NG': 'nigeria',
        'GH': 'ghana',
        'ZA': 'south africa',
        'KE': 'kenya',
        'EG': 'egypt',
        'CI': 'cote d\'ivoire',
        'RW': 'rwanda'
      };
      const countryName = countryNameMap[countryCode.toUpperCase()] || countryCode.toLowerCase();
      const result = await paystackClient.getBanks(countryName);
      return result.data.map((bank: any) => ({
        name: bank.name,
        code: bank.code,
        country: bank.country,
        currency: bank.currency,
        type: bank.type,
      }));
    } else {
      return [];
    }
  },

  async getBalance(countryCode: string) {
    const provider = getPaymentProvider(countryCode);

    return paymentLogger.trackOperation('get_balance', { provider, countryCode }, async () => {
      if (provider === 'paystack') {
        const result = await paystackClient.getBalance();
        return result.data.map((balance: any) => ({
          currency: balance.currency,
          balance: Money.toMajor(balance.balance),
        }));
      } else {
        const stripe = await getUncachableStripeClient();
        const balance = await stripe.balance.retrieve();
        return balance.available.map((b: any) => ({
          currency: b.currency.toUpperCase(),
          balance: Money.toMajor(b.amount),
        }));
      }
    });
  },

  // ==================== STRIPE ISSUING INTEGRATION ====================

  async createCardholder(params: {
    name: string;
    email: string;
    phoneNumber?: string;
    billingAddress: {
      line1: string;
      city: string;
      state?: string;
      postalCode: string;
      country: string;
    };
    type?: 'individual' | 'company';
  }) {
    return paymentLogger.trackOperation('stripe_create_cardholder', { email: params.email }, async () => {
      const stripe = getStripeClient();
      const cardholder = await stripe.issuing.cardholders.create({
        name: params.name,
        email: params.email,
        phone_number: params.phoneNumber,
        type: params.type || 'individual',
        billing: {
          address: {
            line1: params.billingAddress.line1,
            city: params.billingAddress.city,
            state: params.billingAddress.state,
            postal_code: params.billingAddress.postalCode,
            country: params.billingAddress.country,
          },
        },
        status: 'active',
      });
      return cardholder;
    });
  },

  async issueVirtualCard(params: {
    cardholderId: string;
    currency: string;
    spendingLimit?: number;
    spendingLimitInterval?: 'per_authorization' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'all_time';
    merchantCategories?: string[];
    blockedMerchantCategories?: string[];
  }) {
    return paymentLogger.trackOperation('stripe_issue_virtual_card', { cardholderId: params.cardholderId }, async () => {
      const stripe = getStripeClient();
      const spendingControls: any = {};

      if (params.spendingLimit) {
        spendingControls.spending_limits = [{
          amount: Math.round(params.spendingLimit * 100),
          interval: params.spendingLimitInterval || 'monthly',
        }];
      }
      if (params.merchantCategories?.length) {
        spendingControls.allowed_categories = params.merchantCategories;
      }
      if (params.blockedMerchantCategories?.length) {
        spendingControls.blocked_categories = params.blockedMerchantCategories;
      }

      const card = await stripe.issuing.cards.create({
        cardholder: params.cardholderId,
        currency: params.currency.toLowerCase(),
        type: 'virtual',
        spending_controls: Object.keys(spendingControls).length > 0 ? spendingControls : undefined,
        status: 'active',
      });

      return {
        id: card.id,
        last4: card.last4,
        expMonth: card.exp_month,
        expYear: card.exp_year,
        brand: card.brand,
        currency: card.currency,
        status: card.status,
        cardholderId: typeof card.cardholder === 'string' ? card.cardholder : (card.cardholder?.id as string),
        spendingControls: card.spending_controls,
      };
    });
  },

  async getCardDetails(cardId: string) {
    return paymentLogger.trackOperation('stripe_get_card_details', { cardId }, async () => {
      const stripe = getStripeClient();
      const card = await stripe.issuing.cards.retrieve(cardId, {
        expand: ['number', 'cvc'],
      });
      return {
        number: (card as any).number,
        cvc: (card as any).cvc,
        expMonth: card.exp_month,
        expYear: card.exp_year,
        last4: card.last4,
      };
    });
  },

  async updateCardStatus(cardId: string, status: 'active' | 'inactive' | 'canceled') {
    return paymentLogger.trackOperation('stripe_update_card_status', { cardId, status }, async () => {
      const stripe = getStripeClient();
      const card = await stripe.issuing.cards.update(cardId, { status });
      return {
        id: card.id,
        status: card.status,
        last4: card.last4,
      };
    });
  },

  async updateCardSpendingControls(cardId: string, controls: {
    spendingLimit?: number;
    spendingLimitInterval?: string;
    allowedCategories?: string[];
    blockedCategories?: string[];
  }) {
    return paymentLogger.trackOperation('stripe_update_card_spending_controls', { cardId }, async () => {
      const stripe = getStripeClient();
      const spendingControls: any = {};

      if (controls.spendingLimit !== undefined) {
        spendingControls.spending_limits = [{
          amount: Math.round(controls.spendingLimit * 100),
          interval: controls.spendingLimitInterval || 'monthly',
        }];
      }
      if (controls.allowedCategories) {
        spendingControls.allowed_categories = controls.allowedCategories;
      }
      if (controls.blockedCategories) {
        spendingControls.blocked_categories = controls.blockedCategories;
      }

      const card = await stripe.issuing.cards.update(cardId, {
        spending_controls: spendingControls,
      });
      return card;
    });
  },

  async listCardTransactions(cardId: string, limit: number = 25) {
    return paymentLogger.trackOperation('stripe_list_card_transactions', { cardId, limit }, async () => {
      const stripe = getStripeClient();
      const transactions = await stripe.issuing.transactions.list({
        card: cardId,
        limit,
      });
      return transactions.data.map(tx => ({
        id: tx.id,
        amount: tx.amount / 100,
        currency: tx.currency,
        merchantName: tx.merchant_data?.name,
        merchantCategory: tx.merchant_data?.category,
        merchantCity: tx.merchant_data?.city,
        type: tx.type,
        status: tx.type,
        createdAt: new Date(tx.created * 1000).toISOString(),
      }));
    });
  },

  // ==================== STRIPE TREASURY INTEGRATION ====================

  async createStripeFinancialAccount(params: {
    supportedCurrencies: string[];
    features?: string[];
  }) {
    return paymentLogger.trackOperation('stripe_create_financial_account', { currencies: params.supportedCurrencies }, async () => {
      const stripe = getStripeClient();
      const financialAccount = await stripe.treasury.financialAccounts.create({
        supported_currencies: params.supportedCurrencies.map(c => c.toLowerCase()),
        features: {
          card_issuing: { requested: true },
          deposit_insurance: { requested: true },
          financial_addresses: {
            aba: { requested: true },
          },
          inbound_transfers: {
            ach: { requested: true },
          },
          outbound_payments: {
            ach: { requested: true },
            us_domestic_wire: { requested: true },
          },
          outbound_transfers: {
            ach: { requested: true },
            us_domestic_wire: { requested: true },
          },
        },
      });

      return {
        id: financialAccount.id,
        supportedCurrencies: financialAccount.supported_currencies,
        balance: financialAccount.balance,
        financialAddresses: financialAccount.financial_addresses,
        status: financialAccount.status,
        statusDetails: financialAccount.status_details,
      };
    });
  },

  async getFinancialAccountBalance(financialAccountId: string) {
    return paymentLogger.trackOperation('stripe_get_financial_account_balance', { financialAccountId }, async () => {
      const stripe = getStripeClient();
      const account = await stripe.treasury.financialAccounts.retrieve(financialAccountId);
      return {
        cash: account.balance?.cash || {},
        inboundPending: account.balance?.inbound_pending || {},
        outboundPending: account.balance?.outbound_pending || {},
      };
    });
  },

  async createInboundTransfer(params: {
    financialAccountId: string;
    amount: number;
    currency: string;
    originPaymentMethod: string;
    description?: string;
  }) {
    return paymentLogger.trackOperation('stripe_create_inbound_transfer', { financialAccountId: params.financialAccountId, amount: params.amount }, async () => {
      const stripe = getStripeClient();
      const transfer = await stripe.treasury.inboundTransfers.create({
        financial_account: params.financialAccountId,
        amount: Math.round(params.amount * 100),
        currency: params.currency.toLowerCase(),
        origin_payment_method: params.originPaymentMethod,
        description: params.description || 'Account funding',
      });
      return transfer;
    });
  },

  // ==================== UTILITY PAYMENTS (AIRTIME, DATA, BILLS) ====================

  UTILITY_AMOUNT_LIMITS: {
    airtime: { min: 0.5, max: 50000 },
    data: { min: 1, max: 100000 },
    electricity: { min: 5, max: 500000 },
    cable: { min: 1, max: 100000 },
    internet: { min: 5, max: 200000 },
  } as Record<string, { min: number; max: number }>,

  /**
   * Process a utility payment (airtime, data, electricity, cable, internet).
   * For African countries: Uses Paystack Transaction Initialize API to collect payment,
   * then utility fulfillment is tracked via webhook + metadata.
   * For non-African countries: Creates a Stripe PaymentIntent with utility metadata.
   *
   * NOTE: Paystack does NOT have a native bill payment API.
   * The previous /integration/payment/ endpoints were undocumented and non-functional.
   * Utility fulfillment should be handled via a dedicated provider (e.g., Reloadly)
   * after payment confirmation via webhook.
   */
  async processUtilityPayment(params: {
    type: 'airtime' | 'data' | 'electricity' | 'cable' | 'internet';
    provider: string;
    amount: number;
    customer: string;
    countryCode: string;
    email?: string;
    metadata?: any;
  }) {
    const paymentProviderType = getPaymentProvider(params.countryCode);

    const limits = this.UTILITY_AMOUNT_LIMITS[params.type] || { min: 0.5, max: 1000000 };
    if (params.amount < limits.min || params.amount > limits.max) {
      throw new Error(`${params.type} amount must be between ${limits.min} and ${limits.max}`);
    }

    return paymentLogger.trackOperation('utility_payment', {
      type: params.type,
      provider: params.provider,
      amount: params.amount,
      countryCode: params.countryCode,
      paymentProvider: paymentProviderType,
    }, async () => {
      if (paymentProviderType === 'paystack') {
        const email = params.email;
        if (!email || !email.includes('@')) {
          throw new Error('A valid customer email is required for Paystack utility payments');
        }

        const { currency: countryCurrency } = getCurrencyForCountry(params.countryCode);

        try {
          const result = await paystackClient.processUtilityCharge(
            params.amount,
            email,
            params.type,
            params.provider,
            params.customer,
            countryCurrency,
            {
              ...params.metadata,
              country_code: params.countryCode,
            }
          );

          return {
            success: true,
            provider: 'paystack',
            authorizationUrl: result.data?.authorization_url,
            reference: result.data?.reference,
            accessCode: result.data?.access_code,
            status: 'pending',
            message: `${params.type} payment initiated for ${params.provider}. Complete payment via the authorization URL.`,
          };
        } catch (err: any) {
          paymentLogger.warn('utility_charge_failed', { error: err.message, provider: params.provider });
          throw new Error(`${params.type} payment failed: ${err.message}`);
        }
      } else {
        const stripe = await getUncachableStripeClient();
        const { currency } = getCurrencyForCountry(params.countryCode);
        const idempotencyKey = `util-${params.type}-${params.customer}-${Date.now()}`;

        const paymentIntent = await stripe.paymentIntents.create({
          amount: Money.toMinor(params.amount),
          currency: currency.toLowerCase(),
          automatic_payment_methods: { enabled: true },
          metadata: {
            type: 'utility_payment',
            utility_type: params.type,
            provider: params.provider,
            customer_ref: params.customer,
            country: params.countryCode,
          },
          description: `${params.type} - ${params.provider} (${params.customer})`,
        }, {
          idempotencyKey,
        });

        return {
          success: true,
          provider: 'stripe',
          clientSecret: paymentIntent.client_secret,
          paymentIntentId: paymentIntent.id,
          reference: paymentIntent.id,
          status: 'requires_payment_method',
          message: `Payment intent created for ${params.type}. Complete payment using the client secret.`,
        };
      }
    });
  },

  /**
   * List available utility providers for a given category and country.
   * Returns a static curated list since Paystack does not have a biller listing API.
   */
  async listUtilityProviders(type: string, countryCode: string) {
    const paymentProviderType = getPaymentProvider(countryCode);

    const africanProviders: Record<string, Record<string, string[]>> = {
      NG: {
        airtime: ['MTN', 'Glo', 'Airtel', '9mobile'],
        data: ['MTN Data', 'Glo Data', 'Airtel Data', '9mobile Data'],
        electricity: ['Eko Electricity', 'Ikeja Electric', 'Abuja Electricity', 'Ibadan Electricity'],
        cable: ['DSTV', 'GOtv', 'StarTimes'],
        internet: ['Spectranet', 'Smile', 'Swift'],
      },
      GH: {
        airtime: ['MTN Ghana', 'Vodafone Ghana', 'AirtelTigo'],
        data: ['MTN Data Ghana', 'Vodafone Data Ghana'],
        electricity: ['ECG', 'NEDCO'],
        cable: ['DSTV Ghana', 'GOtv Ghana'],
        internet: ['Surfline', 'Busy Internet'],
      },
      KE: {
        airtime: ['Safaricom', 'Airtel Kenya', 'Telkom Kenya'],
        data: ['Safaricom Data', 'Airtel Kenya Data'],
        electricity: ['Kenya Power'],
        cable: ['DSTV Kenya', 'GOtv Kenya', 'StarTimes Kenya'],
        internet: ['Safaricom Home', 'Zuku'],
      },
      ZA: {
        airtime: ['Vodacom', 'MTN SA', 'Cell C', 'Telkom SA'],
        data: ['Vodacom Data', 'MTN SA Data'],
        electricity: ['Eskom', 'City Power'],
        cable: ['DSTV SA', 'GOtv SA'],
        internet: ['Telkom SA Fibre', 'Afrihost'],
      },
    };

    const westernProviders: Record<string, string[]> = {
      airtime: ['Verizon', 'T-Mobile', 'AT&T', 'Vodafone', 'EE', 'O2'],
      data: ['Verizon Data', 'T-Mobile Data', 'AT&T Data'],
      electricity: ['PG&E', 'ConEd', 'Duke Energy', 'EDF', 'British Gas'],
      cable: ['Netflix', 'Hulu', 'HBO', 'Disney+', 'Sky'],
      internet: ['Xfinity', 'Spectrum', 'AT&T Fiber', 'Virgin Media', 'BT'],
    };

    if (paymentProviderType === 'paystack') {
      const countryProviders = africanProviders[countryCode] || {};
      const providers = countryProviders[type] || [];
      return {
        provider: 'paystack',
        billers: providers.map(name => ({
          name,
          slug: name.toLowerCase().replace(/\s+/g, '-'),
        })),
      };
    }

    return {
      provider: 'stripe',
      billers: (westernProviders[type] || []).map(name => ({
        name,
        slug: name.toLowerCase().replace(/\s+/g, '-'),
      })),
    };
  },

  // Expose getProvider for routes
  getProvider(countryCode: string): 'stripe' | 'paystack' {
    return getPaymentProvider(countryCode);
  },
};
