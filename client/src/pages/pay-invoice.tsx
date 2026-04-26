import { useState } from "react";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CURRENCY_SYMBOLS } from "@/lib/constants";
import {
  FileText, Copy, CheckCircle, AlertTriangle,
  CreditCard, Loader2, Banknote
} from "lucide-react";

interface PublicInvoiceData {
  invoice: {
    id: string;
    invoiceNumber: string;
    client: string;
    amount: string;
    subtotal: string | null;
    taxRate: string | null;
    taxAmount: string | null;
    currency: string | null;
    dueDate: string;
    issuedDate: string;
    status: string;
    // Line items can be persisted under several legacy keys: 'rate' (the
    // canonical schema), 'price' (used by the post-LU-009 client), or
    // 'amount' (per-line total written by some older code paths). We
    // accept any and resolve at render time.
    items: { description: string; quantity: number; rate?: number; price?: number; amount?: number }[];
    notes: string | null;
  };
  companyName: string;
  companyLogo: string | null;
  stripePaymentAvailable?: boolean;
  paymentDetails: {
    bankName: string;
    accountNumber: string;
    accountName: string;
    currency: string;
    reference: string;
    instructions: string;
  } | null;
}

export default function PayInvoicePage() {
  const { toast } = useToast();
  const [, params] = useRoute("/pay/:invoiceId");
  const invoiceId = params?.invoiceId || "";
  const [isPayingOnline, setIsPayingOnline] = useState(false);

  // Check URL params for payment status
  const urlParams = new URLSearchParams(window.location.search);
  const paymentStatus = urlParams.get('payment');

  const { data, isLoading, error } = useQuery<PublicInvoiceData>({
    queryKey: ["/api/public/invoices", invoiceId],
    queryFn: async () => {
      const res = await fetch(`/api/public/invoices/${invoiceId}`);
      if (!res.ok) throw new Error("Invoice not found");
      return res.json();
    },
    enabled: !!invoiceId,
    retry: false,
  });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: `${label} copied to clipboard.` });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
          <p className="text-slate-600">Loading invoice...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-900 mb-2">Invoice Not Found</h2>
            <p className="text-slate-600">
              This invoice link may be invalid or the invoice has been removed.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { invoice, companyName, paymentDetails, stripePaymentAvailable } = data;
  const curr = invoice.currency || "USD";
  const sym = CURRENCY_SYMBOLS[curr] || curr + " ";
  const isPaid = invoice.status === "paid" || paymentStatus === 'success';

  const handlePayOnline = async () => {
    setIsPayingOnline(true);
    try {
      // Production-bug fix: the POST was missing X-Requested-With, so the
      // CSRF middleware rejected it with 403 Forbidden ("Payment Error /
      // Forbidden" toast). The header is OWASP's recommended CSRF defense
      // for token-auth APIs and is set by the rest of the app via
      // queryClient.apiRequest. The public pay flow uses raw fetch.
      const res = await fetch(`/api/public/invoices/${invoiceId}/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
      });
      const result = await res.json();
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      } else {
        toast({ title: "Payment Error", description: result.error || "Could not create payment session" });
      }
    } catch {
      toast({ title: "Payment Error", description: "Failed to initiate payment" });
    } finally {
      setIsPayingOnline(false);
    }
  };

  const maskAccountNumber = (num: string) => {
    if (num.length <= 4) return num;
    return "****" + num.slice(-4);
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Company Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-sky-600">{companyName}</h1>
          <p className="text-slate-500">Invoice {invoice.invoiceNumber}</p>
        </div>

        {/* Payment Success from Stripe redirect */}
        {paymentStatus === 'success' && !isPaid && (
          <div className="bg-sky-50 border border-sky-200 rounded-lg p-4 flex items-center gap-3">
            <CheckCircle className="h-6 w-6 text-sky-600" />
            <div>
              <p className="font-semibold text-sky-800">Payment Processing</p>
              <p className="text-sm text-sky-600">Your payment is being processed. The invoice will be updated shortly.</p>
            </div>
          </div>
        )}

        {/* Status Banner */}
        {isPaid && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center gap-3">
            <CheckCircle className="h-6 w-6 text-emerald-600" />
            <div>
              <p className="font-semibold text-emerald-800">Payment Received</p>
              <p className="text-sm text-emerald-600">This invoice has been paid. Thank you!</p>
            </div>
          </div>
        )}

        {/* Invoice Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-sky-600" />
              Invoice Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500">Bill To</p>
                <p className="font-semibold">{invoice.client}</p>
              </div>
              <div>
                <p className="text-slate-500">Status</p>
                <Badge variant={isPaid ? "default" : "secondary"}>
                  {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                </Badge>
              </div>
              <div>
                <p className="text-slate-500">Issued</p>
                <p className="font-medium">{invoice.issuedDate}</p>
              </div>
              <div>
                <p className="text-slate-500">Due Date</p>
                <p className="font-medium">{invoice.dueDate}</p>
              </div>
            </div>

            {/* Line Items Table */}
            {invoice.items && invoice.items.length > 0 && (
              <table className="w-full text-sm border-t border-slate-200 mt-4">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left p-3 font-semibold">Description</th>
                    <th className="text-right p-3 font-semibold">Qty</th>
                    <th className="text-right p-3 font-semibold">Rate</th>
                    <th className="text-right p-3 font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item, idx) => {
                    // Production-bug fix: read the per-line rate from any
                    // of the legacy keys the data layer uses (rate / price
                    // / amount-divided-by-qty). Renders ₦NaN if all are
                    // missing AND quantity is zero, but the calculation
                    // is now safe even when one or more is undefined.
                    const qty = Number(item.quantity) || 0;
                    const rate = Number(
                      item.rate ?? item.price ??
                      (typeof item.amount === 'number' && qty > 0 ? item.amount / qty : 0),
                    ) || 0;
                    const lineTotal = qty * rate;
                    return (
                    <tr key={idx} className="border-b border-slate-100">
                      <td className="p-3">{item.description}</td>
                      <td className="p-3 text-right">{qty}</td>
                      <td className="p-3 text-right">{sym}{rate.toFixed(2)}</td>
                      <td className="p-3 text-right font-medium">{sym}{lineTotal.toFixed(2)}</td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* Totals */}
            <div className="border-t border-slate-200 pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Subtotal</span>
                <span>{sym}{Number(invoice.subtotal || invoice.amount).toFixed(2)}</span>
              </div>
              {Number(invoice.taxRate) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Tax ({invoice.taxRate}%)</span>
                  <span>{sym}{Number(invoice.taxAmount || 0).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold border-t border-slate-200 pt-2">
                <span>Total Due</span>
                <span className="text-sky-600">{sym}{Number(invoice.amount).toFixed(2)}</span>
              </div>
            </div>

            {/* Notes */}
            {invoice.notes && (
              <div className="bg-slate-50 rounded-lg p-4 mt-4">
                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Notes</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{invoice.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pay with Card Button */}
        {!isPaid && stripePaymentAvailable && (
          <Card>
            <CardContent className="pt-6">
              <Button
                className="w-full h-12 text-base font-semibold bg-sky-600 hover:bg-sky-700"
                onClick={handlePayOnline}
                disabled={isPayingOnline}
              >
                {isPayingOnline ? (
                  <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Processing...</>
                ) : (
                  <><CreditCard className="h-5 w-5 mr-2" /> Pay {sym}{Number(invoice.amount).toFixed(2)} with Card</>
                )}
              </Button>
              <p className="text-xs text-center text-slate-500 mt-2">
                Secure payment powered by Stripe
              </p>
            </CardContent>
          </Card>
        )}

        {/* Payment Instructions */}
        {!isPaid && paymentDetails && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Banknote className="h-5 w-5 text-amber-600" />
                Payment Instructions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-600">
                Please transfer the exact amount to the account below:
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-amber-600" />
                  <span className="font-semibold">{paymentDetails.bankName}</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Account Number</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold">{maskAccountNumber(paymentDetails.accountNumber)}</span>
                      <Button
                        variant="ghost" size="icon" className="h-6 w-6"
                        onClick={() => copyToClipboard(paymentDetails.accountNumber, "Account number")}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Account Name</span>
                    <span className="font-semibold">{paymentDetails.accountName}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Reference</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold">{paymentDetails.reference}</span>
                      <Button
                        variant="ghost" size="icon" className="h-6 w-6"
                        onClick={() => copyToClipboard(paymentDetails.reference, "Payment reference")}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-3">
                <p className="text-xs text-cyan-800 font-medium">{paymentDetails.instructions}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-slate-400 pb-4">
          Powered by Financiar
        </div>
      </div>
    </div>
  );
}
