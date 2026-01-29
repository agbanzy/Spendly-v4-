declare global {
  interface Window {
    PaystackPop: {
      setup: (config: PaystackConfig) => PaystackHandler;
    };
  }
}

interface PaystackConfig {
  key: string;
  email: string;
  amount: number;
  currency?: string;
  ref?: string;
  metadata?: Record<string, any>;
  callback: (response: PaystackResponse) => void;
  onClose: () => void;
}

interface PaystackHandler {
  openIframe: () => void;
}

interface PaystackResponse {
  reference: string;
  trans: string;
  status: string;
  message: string;
  transaction: string;
  trxref: string;
}

export const initializePaystack = (config: {
  email: string;
  amount: number;
  currency?: string;
  metadata?: Record<string, any>;
  onSuccess: (response: PaystackResponse) => void;
  onClose: () => void;
}): void => {
  const key = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;
  
  if (!key) {
    console.error("Paystack public key not configured");
    return;
  }

  if (!window.PaystackPop) {
    console.error("Paystack SDK not loaded");
    return;
  }

  const handler = window.PaystackPop.setup({
    key,
    email: config.email,
    amount: config.amount * 100,
    currency: config.currency || "NGN",
    ref: `spendly_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
    metadata: config.metadata,
    callback: config.onSuccess,
    onClose: config.onClose,
  });

  handler.openIframe();
};

export const loadPaystackScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (window.PaystackPop) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://js.paystack.co/v1/inline.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Paystack SDK"));
    document.body.appendChild(script);
  });
};

export type { PaystackResponse, PaystackConfig };
