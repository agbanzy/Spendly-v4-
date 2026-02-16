import { getUncachableStripeClient } from './stripeClient';
import { paystackClient } from './paystackClient';

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
    
    if (provider === 'paystack') {
      const email = metadata?.email || 'customer@example.com';
      const paystackCallback = callbackUrl || (process.env.REPLIT_DOMAINS ? 
        `https://${process.env.REPLIT_DOMAINS.split(',')[0]}/api/paystack/callback` : 
        undefined);
      const result = await paystackClient.initializeTransaction(email, amount, currency, metadata, paystackCallback);
      return {
        provider: 'paystack',
        authorizationUrl: result.data.authorization_url,
        reference: result.data.reference,
        accessCode: result.data.access_code,
      };
    } else {
      const stripe = await getUncachableStripeClient();
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency: currency.toLowerCase(),
        metadata,
      });
      return {
        provider: 'stripe',
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      };
    }
  },

  async initiateTransfer(amount: number, recipientDetails: any, countryCode: string, reason: string) {
    const provider = getPaymentProvider(countryCode);
    const { currency } = getCurrencyForCountry(countryCode);

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
        provider: 'paystack',
        transferCode: transfer.data.transfer_code,
        status: transfer.data.status,
        reference: transfer.data.reference,
        currency,
      };
    } else {
      const stripe = await getUncachableStripeClient();
      const transfer = await stripe.transfers.create({
        amount: Math.round(amount * 100),
        currency: recipientDetails.currency || currency.toLowerCase(),
        destination: recipientDetails.stripeAccountId,
        description: reason,
      });
      return {
        provider: 'stripe',
        transferId: transfer.id,
        status: transfer.destination ? 'pending' : 'failed',
        currency,
      };
    }
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
        console.log('Assign dedicated account failed, trying two-step approach:', assignError.message);
        
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
          console.log('DVA creation also failed:', dvaError.message);
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
    if (provider === 'paystack') {
      const result = await paystackClient.verifyTransaction(reference);
      return {
        provider: 'paystack',
        status: result.data.status,
        amount: result.data.amount / 100,
        currency: result.data.currency,
        paidAt: result.data.paid_at,
        channel: result.data.channel,
      };
    } else {
      const stripe = await getUncachableStripeClient();
      const paymentIntent = await stripe.paymentIntents.retrieve(reference);
      return {
        provider: 'stripe',
        status: paymentIntent.status,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
      };
    }
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
    
    if (provider === 'paystack') {
      const result = await paystackClient.getBalance();
      return result.data.map((balance: any) => ({
        currency: balance.currency,
        balance: balance.balance / 100,
      }));
    } else {
      const stripe = await getUncachableStripeClient();
      const balance = await stripe.balance.retrieve();
      return balance.available.map((b: any) => ({
        currency: b.currency.toUpperCase(),
        balance: b.amount / 100,
      }));
    }
  },
};
