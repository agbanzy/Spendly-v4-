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
        const email = metadata?.email || 'customer@example.com';
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
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Money.toMinor(amount),
          currency: currency.toLowerCase(),
          metadata,
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
          const transfer = await stripe.transfers.create({
            amount: Money.toMinor(amount),
            currency: recipientDetails.currency || currency.toLowerCase(),
            destination: recipientDetails.stripeAccountId,
            description: reason,
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

  /**
   * Known Paystack biller codes for common providers.
   * In production, call listBillers() to fetch dynamically and cache.
   */
  BILLER_CODES: {
    // Nigerian telecom billers
    'mtn': { billerCode: 'BIL099', itemCode: 'MD136' },
    'glo': { billerCode: 'BIL102', itemCode: 'MD139' },
    'airtel': { billerCode: 'BIL100', itemCode: 'MD137' },
    '9mobile': { billerCode: 'BIL103', itemCode: 'MD140' },
    // Data
    'mtn-data': { billerCode: 'BIL099', itemCode: 'MD136' },
    'glo-data': { billerCode: 'BIL102', itemCode: 'MD139' },
    'airtel-data': { billerCode: 'BIL100', itemCode: 'MD137' },
    '9mobile-data': { billerCode: 'BIL103', itemCode: 'MD140' },
    // Electricity
    'eko': { billerCode: 'BIL112', itemCode: 'MD151' },
    'ikeja': { billerCode: 'BIL113', itemCode: 'MD152' },
    'abuja': { billerCode: 'BIL114', itemCode: 'MD153' },
    'ibadan': { billerCode: 'BIL115', itemCode: 'MD154' },
    // Cable TV
    'dstv': { billerCode: 'BIL121', itemCode: 'MD161' },
    'gotv': { billerCode: 'BIL122', itemCode: 'MD162' },
    'startimes': { billerCode: 'BIL123', itemCode: 'MD163' },
    // Internet
    'spectranet': { billerCode: 'BIL130', itemCode: 'MD170' },
    'smile': { billerCode: 'BIL131', itemCode: 'MD171' },
  } as Record<string, { billerCode: string; itemCode: string }>,

  /**
   * Process a utility payment (airtime, data, electricity, cable, internet).
   * Uses Paystack's bill payment API for African countries.
   * For non-African countries, initiates a generic charge via Stripe.
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

    return paymentLogger.trackOperation('utility_payment', {
      type: params.type,
      provider: params.provider,
      amount: params.amount,
      countryCode: params.countryCode,
      paymentProvider: paymentProviderType,
    }, async () => {
      if (paymentProviderType === 'paystack') {
        // --- PAYSTACK BILL PAYMENT ---
        const providerKey = params.provider.toLowerCase();
        const billerInfo = this.BILLER_CODES[providerKey];

        if (billerInfo) {
          // Use known biller codes for direct payment
          try {
            // 1. Validate customer first
            const validation = await paystackClient.validateBillCustomer(
              billerInfo.itemCode,
              billerInfo.billerCode,
              params.customer
            );

            if (!validation.status) {
              paymentLogger.warn('bill_customer_validation_failed', {
                customer: params.customer,
                provider: params.provider,
              });
              // Continue anyway — some billers don't support pre-validation
            }

            // 2. Create the bill payment order
            const order = await paystackClient.createBillPayment(
              params.amount,
              billerInfo.billerCode,
              billerInfo.itemCode,
              params.customer,
              {
                ...params.metadata,
                utility_type: params.type,
                provider_name: params.provider,
                country_code: params.countryCode,
              }
            );

            return {
              success: true,
              provider: 'paystack',
              orderId: order.data?.id || order.data?.reference,
              reference: order.data?.reference || `UTIL-${Date.now()}`,
              status: order.data?.status || 'pending',
              message: order.message || `${params.type} payment submitted to ${params.provider}`,
            };
          } catch (billerErr: any) {
            paymentLogger.warn('biller_order_failed', { error: billerErr.message, provider: params.provider });
            throw new Error(`${params.type} payment failed: ${billerErr.message}`);
          }
        } else {
          // Unknown biller — try fetching billers dynamically
          try {
            const billers = await paystackClient.listBillers(params.type);
            const matchedBiller = (billers.data || []).find(
              (b: any) => b.name?.toLowerCase().includes(providerKey) || b.slug?.includes(providerKey)
            );

            if (matchedBiller) {
              const order = await paystackClient.createBillPayment(
                params.amount,
                matchedBiller.biller_code,
                matchedBiller.item_code || matchedBiller.items?.[0]?.item_code,
                params.customer,
                { utility_type: params.type, provider_name: params.provider }
              );
              return {
                success: true,
                provider: 'paystack',
                orderId: order.data?.id,
                reference: order.data?.reference || `UTIL-${Date.now()}`,
                status: order.data?.status || 'pending',
                message: `${params.type} payment submitted`,
              };
            }

            throw new Error(`Provider "${params.provider}" not found for ${params.type} in ${params.countryCode}`);
          } catch (fetchErr: any) {
            throw new Error(`Utility payment failed: ${fetchErr.message}`);
          }
        }
      } else {
        // --- NON-AFRICAN (STRIPE) ---
        // For non-African countries, utility payments are typically handled via
        // the provider's own platform. We create a payment intent that can be
        // used for the user to complete payment on the utility's site, or we
        // process it as a generic charge.
        const stripe = await getUncachableStripeClient();
        const { currency } = getCurrencyForCountry(params.countryCode);

        const paymentIntent = await stripe.paymentIntents.create({
          amount: Money.toMinor(params.amount),
          currency: currency.toLowerCase(),
          metadata: {
            type: 'utility_payment',
            utility_type: params.type,
            provider: params.provider,
            customer_ref: params.customer,
            country: params.countryCode,
          },
          description: `${params.type} - ${params.provider} (${params.customer})`,
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
   * List available billers/providers for a utility category in a given country.
   */
  async listUtilityProviders(type: string, countryCode: string) {
    const paymentProviderType = getPaymentProvider(countryCode);

    if (paymentProviderType === 'paystack') {
      try {
        const billers = await paystackClient.listBillers(type);
        return {
          provider: 'paystack',
          billers: (billers.data || []).map((b: any) => ({
            name: b.name,
            slug: b.slug,
            billerCode: b.biller_code,
            itemCode: b.item_code,
            country: b.country,
          })),
        };
      } catch (err: any) {
        paymentLogger.warn('list_billers_failed', { type, error: err.message });
        return { provider: 'paystack', billers: [], error: err.message };
      }
    }

    // For non-African countries, return static list
    const staticProviders: Record<string, string[]> = {
      airtime: ['Verizon', 'T-Mobile', 'AT&T', 'Vodafone', 'EE', 'O2'],
      data: ['Verizon Data', 'T-Mobile Data', 'AT&T Data'],
      electricity: ['PG&E', 'ConEd', 'Duke Energy', 'EDF', 'British Gas'],
      cable: ['Netflix', 'Hulu', 'HBO', 'Disney+', 'Sky'],
      internet: ['Xfinity', 'Spectrum', 'AT&T Fiber', 'Virgin Media', 'BT'],
    };

    return {
      provider: 'stripe',
      billers: (staticProviders[type] || []).map(name => ({
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
