import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getCurrencySymbol, formatCurrencyAmount, isPaystackRegion, PAYMENT_LIMITS } from "@/lib/constants";
import { PinVerificationDialog, usePinVerification } from "@/components/pin-verification-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Download,
  Plus,
  Loader2,
  Wallet,
  Send,
  CreditCard,
  Building,
  Receipt,
  RefreshCw,
  BadgeCheck,
  AlertCircle,
  CheckCircle,
  ArrowRightLeft,
  Banknote,
  FileText,
  Filter,
  TrendingUp,
  TrendingDown,
  Clock,
} from "lucide-react";
import {
  PageWrapper,
  PageHeader,
  MetricCard,
  StatusBadge,
  AnimatedListItem,
  EmptyState,
  SectionLabel,
  GlassCard,
} from "@/components/ui-extended";
import type { Transaction, CompanySettings, CompanyBalances } from "@shared/schema";

interface Bank {
  code: string;
  name: string;
}

type QuickAction = {
  id: string;
  label: string;
  description: string;
  icon: typeof Wallet;
  gradient: string;
  iconColor: string;
};

const QUICK_ACTIONS: QuickAction[] = [
  { id: "fund", label: "Fund Wallet", description: "Add money to your wallet", icon: Plus, gradient: "from-emerald-500/15 to-emerald-600/5", iconColor: "text-emerald-600 dark:text-emerald-400" },
  { id: "transfer", label: "Send Money", description: "Transfer to any account", icon: Send, gradient: "from-blue-500/15 to-blue-600/5", iconColor: "text-blue-600 dark:text-blue-400" },
  { id: "withdraw", label: "Withdraw", description: "Cash out to bank", icon: Banknote, gradient: "from-amber-500/15 to-amber-600/5", iconColor: "text-amber-600 dark:text-amber-400" },
  { id: "bill", label: "Pay Bill", description: "Utilities & subscriptions", icon: Receipt, gradient: "from-purple-500/15 to-purple-600/5", iconColor: "text-purple-600 dark:text-purple-400" },
  { id: "payout", label: "Payout", description: "Vendor & salary payouts", icon: ArrowUpRight, gradient: "from-rose-500/15 to-rose-600/5", iconColor: "text-rose-600 dark:text-rose-400" },
  { id: "record", label: "Record", description: "Log a manual transaction", icon: FileText, gradient: "from-slate-500/15 to-slate-600/5", iconColor: "text-slate-600 dark:text-slate-400" },
];

const INFLOW_TYPES = ["Deposit", "Funding", "Refund"];

export default function Transactions() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [isFundOpen, setIsFundOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [isRecordOpen, setIsRecordOpen] = useState(false);

  const [fundingAmount, setFundingAmount] = useState("");
  const [fundingMethod, setFundingMethod] = useState<"card" | "bank">("card");

  const [transferData, setTransferData] = useState({ recipient: "", amount: "", note: "", bankCode: "" });
  const [transferValidation, setTransferValidation] = useState<{ name: string; validated: boolean } | null>(null);
  const [isValidatingTransfer, setIsValidatingTransfer] = useState(false);

  const [withdrawData, setWithdrawData] = useState({ accountNumber: "", bankCode: "", accountName: "" });
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawValidation, setWithdrawValidation] = useState<{ name: string; validated: boolean } | null>(null);
  const [isValidatingWithdraw, setIsValidatingWithdraw] = useState(false);

  const [recordForm, setRecordForm] = useState({ type: "Deposit", amount: "", description: "" });

  const searchParams = useSearch();
  const { isPinRequired, isPinDialogOpen, setIsPinDialogOpen, requirePin, handlePinVerified } = usePinVerification();

  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    const paymentStatus = params.get("payment");
    const sessionId = params.get("session_id");

    const handlePaymentCallback = async () => {
      if (paymentStatus === "success" && sessionId) {
        try {
          const res = await apiRequest("POST", "/api/stripe/confirm-payment", { sessionId });
          const data = await res.json();
          if (data.success) {
            toast({ title: "Payment successful!", description: `${getCurrencySymbol(currency)}${data.amount} has been added to your wallet.` });
            queryClient.invalidateQueries({ queryKey: ["/api/balances"] });
            queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
          }
        } catch {
          toast({ title: "Payment verification failed", variant: "destructive" });
        }
        window.history.replaceState({}, "", "/transactions");
      } else if (paymentStatus === "success") {
        toast({ title: "Payment successful!", description: "Your wallet has been funded." });
        queryClient.invalidateQueries({ queryKey: ["/api/balances"] });
        queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
        window.history.replaceState({}, "", "/transactions");
      } else if (paymentStatus === "cancelled") {
        toast({ title: "Payment cancelled", variant: "destructive" });
        window.history.replaceState({}, "", "/transactions");
      } else if (paymentStatus === "failed") {
        toast({ title: "Payment failed", description: "Please try again.", variant: "destructive" });
        window.history.replaceState({}, "", "/transactions");
      }
    };

    if (paymentStatus) handlePaymentCallback();
  }, [searchParams, toast]);

  const { data: settings } = useQuery<CompanySettings>({ queryKey: ["/api/settings"] });
  const { data: balances } = useQuery<CompanyBalances>({ queryKey: ["/api/balances"] });
  const { data: transactions, isLoading } = useQuery<Transaction[]>({ queryKey: ["/api/transactions"] });

  const countryCode = settings?.countryCode || "US";
  const isPaystack = isPaystackRegion(countryCode);
  const currency = settings?.currency || "USD";
  const currencySymbol = getCurrencySymbol(currency);

  const { data: banks } = useQuery<Bank[]>({
    queryKey: ["/api/payment/banks", countryCode],
    queryFn: async () => {
      const res = await fetch(`/api/payment/banks/${countryCode}`);
      return res.json();
    },
    enabled: isPaystack,
  });

  const filteredTransactions = transactions?.filter((tx) => {
    const matchesSearch = tx.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "all" || tx.type.toLowerCase() === typeFilter.toLowerCase();
    const matchesStatus = statusFilter === "all" || tx.status.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesType && matchesStatus;
  })?.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalInflow = transactions?.filter(tx => INFLOW_TYPES.includes(tx.type)).reduce((sum, tx) => sum + Number(tx.amount), 0) || 0;
  const totalOutflow = transactions?.filter(tx => !INFLOW_TYPES.includes(tx.type)).reduce((sum, tx) => sum + Number(tx.amount), 0) || 0;
  const pendingCount = transactions?.filter(tx => tx.status === "Processing" || tx.status === "Pending").length || 0;

  const fundWalletMutation = useMutation({
    mutationFn: async (amount: string) => {
      const numAmount = parseFloat(amount);
      if (!numAmount || numAmount <= 0) throw new Error("Enter a valid amount");
      const limits = PAYMENT_LIMITS[currency];
      if (limits && (numAmount < limits.min || numAmount > limits.max)) {
        throw new Error(`Amount must be between ${formatCurrencyAmount(limits.min, currency)} and ${formatCurrencyAmount(limits.max, currency)}`);
      }

      if (fundingMethod === "card") {
        if (isPaystack) {
          const res = await apiRequest("POST", "/api/payment/create-intent", {
            amount: numAmount,
            currency,
            countryCode,
            email: user?.email || "",
            metadata: { type: "wallet_funding" }
          });
          const data = await res.json();
          if (data.authorizationUrl) {
            window.location.href = data.authorizationUrl;
          }
          return data;
        } else {
          const res = await apiRequest("POST", "/api/stripe/checkout-session", {
            amount: numAmount,
            currency,
            countryCode,
            successUrl: `${window.location.origin}/transactions?payment=success&session_id={CHECKOUT_SESSION_ID}`,
            cancelUrl: `${window.location.origin}/transactions?payment=cancelled`,
            metadata: { type: "wallet_funding" }
          });
          const data = await res.json();
          if (data.url) {
            window.location.href = data.url;
          }
          return data;
        }
      } else {
        return apiRequest("POST", "/api/balances/fund", { amount: numAmount });
      }
    },
    onSuccess: (data) => {
      if (fundingMethod !== "card" || !(data?.url || data?.authorizationUrl)) {
        queryClient.invalidateQueries({ queryKey: ["/api/balances"] });
        queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
        toast({ title: "Wallet funded successfully", description: `${currencySymbol}${fundingAmount} added to your wallet.` });
        setIsFundOpen(false);
        setFundingAmount("");
      }
    },
    onError: (error: any) => {
      toast({ title: "Failed to fund wallet", description: error.message, variant: "destructive" });
    },
  });

  const sendTransferMutation = useMutation({
    mutationFn: async (data: typeof transferData) => {
      const numAmount = parseFloat(data.amount);
      const limits = PAYMENT_LIMITS[currency];
      if (limits && (numAmount < limits.min || numAmount > limits.max)) {
        throw new Error(`Amount must be between ${formatCurrencyAmount(limits.min, currency)} and ${formatCurrencyAmount(limits.max, currency)}`);
      }
      return apiRequest("POST", "/api/payment/transfer", {
        amount: numAmount,
        countryCode,
        reason: data.note || "Money transfer",
        recipientDetails: {
          accountNumber: data.recipient,
          bankCode: data.bankCode,
          accountName: transferValidation?.name || "Recipient",
          currency,
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/balances"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      toast({ title: "Transfer sent successfully", description: `${currencySymbol}${transferData.amount} sent to ${transferValidation?.name || transferData.recipient}` });
      setIsTransferOpen(false);
      setTransferData({ recipient: "", amount: "", note: "", bankCode: "" });
      setTransferValidation(null);
    },
    onError: (error: any) => {
      toast({ title: "Transfer failed", description: error.message, variant: "destructive" });
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: async (amount: string) => {
      const numAmount = parseFloat(amount);
      if (!numAmount || numAmount <= 0) throw new Error("Enter a valid amount");
      if (!withdrawValidation?.validated || !withdrawData.accountNumber || !withdrawData.bankCode) {
        throw new Error("Please verify the bank account first");
      }
      return apiRequest("POST", "/api/wallet/payout", {
        amount: numAmount,
        countryCode,
        recipientDetails: {
          accountNumber: withdrawData.accountNumber,
          bankCode: withdrawData.bankCode,
          accountName: withdrawValidation.name || withdrawData.accountName,
        },
        reason: "Wallet withdrawal"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/balances"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      toast({ title: "Withdrawal initiated", description: "Funds will arrive in 1-3 business days." });
      setIsWithdrawOpen(false);
      setWithdrawAmount("");
      setWithdrawData({ accountNumber: "", bankCode: "", accountName: "" });
      setWithdrawValidation(null);
    },
    onError: (error: any) => {
      toast({ title: "Withdrawal failed", description: error.message, variant: "destructive" });
    },
  });

  const recordMutation = useMutation({
    mutationFn: async (data: typeof recordForm) => {
      return apiRequest("POST", "/api/transactions", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/balances"] });
      toast({ title: "Transaction recorded successfully" });
      setIsRecordOpen(false);
      setRecordForm({ type: "Deposit", amount: "", description: "" });
    },
    onError: () => {
      toast({ title: "Failed to record transaction", variant: "destructive" });
    },
  });

  const validateTransferAccount = async () => {
    if (!transferData.recipient || !transferData.bankCode) return;
    setIsValidatingTransfer(true);
    try {
      const res = await apiRequest("POST", "/api/payment/validate-account", {
        accountNumber: transferData.recipient,
        bankCode: transferData.bankCode,
      });
      const data = await res.json();
      if (data.accountName) {
        setTransferValidation({ name: data.accountName, validated: true });
        toast({ title: "Account verified", description: data.accountName });
      } else {
        toast({ title: "Could not verify account", variant: "destructive" });
      }
    } catch {
      toast({ title: "Account verification failed", variant: "destructive" });
    } finally {
      setIsValidatingTransfer(false);
    }
  };

  const validateWithdrawAccount = async () => {
    if (!withdrawData.accountNumber || !withdrawData.bankCode) return;
    setIsValidatingWithdraw(true);
    try {
      const res = await apiRequest("POST", "/api/payment/validate-account", {
        accountNumber: withdrawData.accountNumber,
        bankCode: withdrawData.bankCode,
      });
      const data = await res.json();
      if (data.accountName) {
        setWithdrawValidation({ name: data.accountName, validated: true });
        toast({ title: "Account verified", description: data.accountName });
      } else {
        toast({ title: "Could not verify account", variant: "destructive" });
      }
    } catch {
      toast({ title: "Account verification failed", variant: "destructive" });
    } finally {
      setIsValidatingWithdraw(false);
    }
  };

  const handleQuickAction = (actionId: string) => {
    switch (actionId) {
      case "fund": setIsFundOpen(true); break;
      case "transfer": setIsTransferOpen(true); break;
      case "withdraw": setIsWithdrawOpen(true); break;
      case "bill": setLocation("/bills"); break;
      case "payout": setLocation("/payroll"); break;
      case "record": setIsRecordOpen(true); break;
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "Deposit": case "Funding": return ArrowDownRight;
      case "Payout": case "Withdrawal": return ArrowUpRight;
      case "Transfer": return ArrowRightLeft;
      case "Bill": return Receipt;
      case "Fee": return CreditCard;
      case "Refund": return RefreshCw;
      default: return ArrowRightLeft;
    }
  };

  const getTransactionIconColor = (type: string) => {
    if (INFLOW_TYPES.includes(type)) return "from-emerald-500/20 to-emerald-600/10 text-emerald-600 dark:text-emerald-400";
    if (type === "Transfer") return "from-blue-500/20 to-blue-600/10 text-blue-600 dark:text-blue-400";
    if (type === "Bill") return "from-purple-500/20 to-purple-600/10 text-purple-600 dark:text-purple-400";
    if (type === "Withdrawal" || type === "Payout") return "from-amber-500/20 to-amber-600/10 text-amber-600 dark:text-amber-400";
    return "from-slate-500/20 to-slate-600/10 text-slate-600 dark:text-slate-400";
  };

  const getStatusColor = (status: string): "emerald" | "amber" | "rose" | "slate" | "cyan" | "primary" => {
    switch (status?.toLowerCase()) {
      case "completed": return "emerald";
      case "processing": case "pending": return "amber";
      case "failed": return "rose";
      default: return "slate";
    }
  };

  const exportTransactions = () => {
    if (!filteredTransactions?.length) {
      toast({ title: "No transactions to export", variant: "destructive" });
      return;
    }
    const headers = ["Date", "Type", "Description", "Amount", "Currency", "Status", "Fee"];
    const rows = filteredTransactions.map(tx => [
      new Date(tx.date).toLocaleDateString(),
      tx.type,
      `"${tx.description}"`,
      tx.amount,
      tx.currency || currency,
      tx.status,
      tx.fee || "0",
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Transactions exported" });
  };

  return (
    <PageWrapper>
      <PageHeader
        title="Transactions"
        subtitle="View and manage all your financial transactions."
        actions={
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={exportTransactions} data-testid="button-export-transactions">
              <Download className="h-4 w-4 mr-2" />Export
            </Button>
            <Button onClick={() => setIsRecordOpen(true)} data-testid="button-add-transaction">
              <Plus className="h-4 w-4 mr-2" />Record Transaction
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          title="Total Transactions"
          value={isLoading ? "..." : String(transactions?.length || 0)}
          subtitle="All time"
          icon={ArrowRightLeft}
          color="primary"
        />
        <MetricCard
          title="Total Inflow"
          value={isLoading ? "..." : `+${formatCurrencyAmount(totalInflow, currency)}`}
          subtitle="Money received"
          icon={TrendingUp}
          color="emerald"
        />
        <MetricCard
          title="Total Outflow"
          value={isLoading ? "..." : `-${formatCurrencyAmount(totalOutflow, currency)}`}
          subtitle="Money spent"
          icon={TrendingDown}
          color="rose"
        />
        <MetricCard
          title="Pending"
          value={isLoading ? "..." : String(pendingCount)}
          subtitle="Processing"
          icon={Clock}
          color="amber"
        />
      </div>

      <div>
        <SectionLabel>Quick Actions</SectionLabel>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mt-3">
          {QUICK_ACTIONS.map((action) => (
            <Card
              key={action.id}
              className="hover-elevate active-elevate-2 cursor-pointer border transition-all"
              onClick={() => handleQuickAction(action.id)}
              data-testid={`button-quick-${action.id}`}
            >
              <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                <div className={`p-3 rounded-xl bg-gradient-to-br ${action.gradient}`}>
                  <action.icon className={`h-5 w-5 ${action.iconColor}`} />
                </div>
                <div>
                  <p className="text-sm font-bold">{action.label}</p>
                  <p className="text-xs text-muted-foreground leading-tight mt-0.5">{action.description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <GlassCard>
        <div className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search transactions..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search-transactions"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full md:w-[180px]" data-testid="select-transaction-type">
                <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="deposit">Deposit</SelectItem>
                <SelectItem value="funding">Funding</SelectItem>
                <SelectItem value="transfer">Transfer</SelectItem>
                <SelectItem value="payout">Payout</SelectItem>
                <SelectItem value="withdrawal">Withdrawal</SelectItem>
                <SelectItem value="bill">Bill</SelectItem>
                <SelectItem value="fee">Fee</SelectItem>
                <SelectItem value="refund">Refund</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px]" data-testid="select-transaction-status">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <div>
          <div className="px-6 py-4 border-b">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <SectionLabel>All Transactions</SectionLabel>
              {filteredTransactions && (
                <span className="text-xs text-muted-foreground">{filteredTransactions.length} result{filteredTransactions.length !== 1 ? "s" : ""}</span>
              )}
            </div>
          </div>
          <div className="divide-y">
            {isLoading ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-11 w-11 rounded-xl" />
                      <div>
                        <Skeleton className="h-4 w-48 mb-2" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                    <div className="text-right">
                      <Skeleton className="h-5 w-24 mb-2" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredTransactions && filteredTransactions.length > 0 ? (
              <div className="divide-y">
                {filteredTransactions.map((tx, index) => {
                  const TxIcon = getTransactionIcon(tx.type);
                  const iconColors = getTransactionIconColor(tx.type);
                  const isInflow = INFLOW_TYPES.includes(tx.type);
                  return (
                    <AnimatedListItem key={tx.id} delay={index * 0.03} data-testid={`transaction-row-${tx.id}`}>
                      <div className="flex items-center justify-between p-4 hover-elevate transition-all duration-200">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br ${iconColors.split(" ").slice(0, 2).join(" ")}`}>
                            <TxIcon className={`h-5 w-5 ${iconColors.split(" ").slice(2).join(" ")}`} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold truncate">{tx.description}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <Badge variant="secondary" className="text-xs">{tx.type}</Badge>
                              <span className="text-xs text-muted-foreground">
                                {new Date(tx.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                              </span>
                              {tx.currency && tx.currency !== currency && (
                                <Badge variant="outline" className="text-xs">{tx.currency}</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-4">
                          <p className={`text-base font-bold ${isInflow ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
                            {isInflow ? "+" : "-"}{formatCurrencyAmount(Number(tx.amount), tx.currency || currency)}
                          </p>
                          <div className="mt-1">
                            <StatusBadge
                              status={tx.status as "Completed" | "Processing" | "Failed"}
                              color={getStatusColor(tx.status)}
                            />
                          </div>
                        </div>
                      </div>
                    </AnimatedListItem>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={ArrowRightLeft}
                title="No transactions found"
                description={
                  searchQuery || typeFilter !== "all" || statusFilter !== "all"
                    ? "Try adjusting your filters."
                    : "Your transaction history will appear here. Use the quick actions above to get started."
                }
              />
            )}
          </div>
        </div>
      </GlassCard>

      <Dialog open={isFundOpen} onOpenChange={setIsFundOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-emerald-600" />
              Fund Wallet
            </DialogTitle>
            <DialogDescription>Add money to your wallet to make payments and transfers.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl border border-primary/20">
              <p className="text-xs text-muted-foreground mb-1">Current Balance</p>
              <p className="text-2xl font-bold" data-testid="text-fund-balance">{formatCurrencyAmount(balances?.local || 0, currency)}</p>
            </div>

            <div className="space-y-2">
              <Label>Funding Method</Label>
              <div className="grid grid-cols-2 gap-2">
                {[{ id: "card" as const, label: "Card", icon: CreditCard }, { id: "bank" as const, label: "Bank Transfer", icon: Building }].map((method) => (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => setFundingMethod(method.id)}
                    className={`p-3 rounded-xl border-2 text-center transition-all ${fundingMethod === method.id ? "border-primary bg-primary/10" : "border-border"}`}
                    data-testid={`button-fund-method-${method.id}`}
                  >
                    <method.icon className="h-5 w-5 mx-auto mb-1" />
                    <p className="text-xs font-medium">{method.label}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Amount ({currencySymbol})</Label>
              <Input
                type="number"
                value={fundingAmount}
                onChange={(e) => setFundingAmount(e.target.value)}
                placeholder="0.00"
                className="text-lg font-bold"
                data-testid="input-fund-amount"
              />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[100, 500, 1000, 5000].map((amt) => (
                <Button key={amt} variant="outline" size="sm" onClick={() => setFundingAmount(String(amt))} className="text-xs font-bold">
                  {currencySymbol}{amt.toLocaleString()}
                </Button>
              ))}
            </div>

            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 rounded-xl text-emerald-800 dark:text-emerald-200 text-sm flex items-start gap-2">
              <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>Instant funding with zero fees.</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFundOpen(false)}>Cancel</Button>
            <Button onClick={() => fundWalletMutation.mutate(fundingAmount)} disabled={!fundingAmount || fundWalletMutation.isPending} data-testid="button-confirm-fund">
              {fundWalletMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Add {currencySymbol}{fundingAmount || "0"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isTransferOpen} onOpenChange={setIsTransferOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-blue-600" />
              Send Money
            </DialogTitle>
            <DialogDescription>Transfer funds to a bank account.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl border border-primary/20">
              <p className="text-xs text-muted-foreground mb-1">Available Balance</p>
              <p className="text-2xl font-bold">{formatCurrencyAmount(balances?.local || 0, currency)}</p>
            </div>

            <div className="space-y-2">
              <Label>Select Bank</Label>
              <Select value={transferData.bankCode} onValueChange={(v) => { setTransferData({ ...transferData, bankCode: v }); setTransferValidation(null); }}>
                <SelectTrigger data-testid="select-transfer-bank"><SelectValue placeholder="Choose a bank" /></SelectTrigger>
                <SelectContent className="max-h-60">
                  {banks?.map((bank) => (
                    <SelectItem key={bank.code} value={bank.code}>{bank.name}</SelectItem>
                  )) || (
                    <>
                      <SelectItem value="044">Access Bank</SelectItem>
                      <SelectItem value="058">GTBank</SelectItem>
                      <SelectItem value="033">UBA</SelectItem>
                      <SelectItem value="011">First Bank</SelectItem>
                      <SelectItem value="057">Zenith Bank</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Account Number</Label>
              <div className="flex gap-2">
                <Input
                  value={transferData.recipient}
                  onChange={(e) => { setTransferData({ ...transferData, recipient: e.target.value }); setTransferValidation(null); }}
                  placeholder="Enter 10-digit account number"
                  className="flex-1"
                  data-testid="input-transfer-account"
                />
                <Button variant="outline" onClick={validateTransferAccount} disabled={isValidatingTransfer || !transferData.recipient || !transferData.bankCode} data-testid="button-verify-transfer">
                  {isValidatingTransfer ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
                </Button>
              </div>
            </div>

            {transferValidation?.validated && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center gap-2">
                <BadgeCheck className="h-5 w-5 text-emerald-600 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Account Name</p>
                  <p className="font-bold text-emerald-700 dark:text-emerald-400">{transferValidation.name}</p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Amount ({currencySymbol})</Label>
              <Input
                type="number"
                value={transferData.amount}
                onChange={(e) => setTransferData({ ...transferData, amount: e.target.value })}
                placeholder="0.00"
                className="text-lg font-bold"
                data-testid="input-transfer-amount"
              />
            </div>

            <div className="space-y-2">
              <Label>Note (optional)</Label>
              <Input
                value={transferData.note}
                onChange={(e) => setTransferData({ ...transferData, note: e.target.value })}
                placeholder="Add a note for the recipient"
                data-testid="input-transfer-note"
              />
            </div>

            {transferData.amount && (
              <div className="p-4 bg-muted/50 rounded-xl space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-bold">{currencySymbol}{parseFloat(transferData.amount || "0").toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Fee</span>
                  <span className="font-bold text-emerald-600">{currencySymbol}0.00</span>
                </div>
                <div className="border-t pt-2 flex justify-between">
                  <span className="font-bold">Total</span>
                  <span className="font-bold text-primary">{currencySymbol}{parseFloat(transferData.amount || "0").toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTransferOpen(false)}>Cancel</Button>
            <Button
              onClick={() => requirePin(() => sendTransferMutation.mutate(transferData))}
              disabled={!transferData.recipient || !transferData.amount || sendTransferMutation.isPending}
              data-testid="button-confirm-transfer"
            >
              {sendTransferMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Send {currencySymbol}{transferData.amount || "0"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isWithdrawOpen} onOpenChange={setIsWithdrawOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-amber-600" />
              Withdraw Funds
            </DialogTitle>
            <DialogDescription>Transfer funds to your bank account.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl border border-primary/20">
              <p className="text-xs text-muted-foreground mb-1">Available Balance</p>
              <p className="text-2xl font-bold">{formatCurrencyAmount(balances?.local || 0, currency)}</p>
            </div>

            <div className="space-y-2">
              <Label>Select Bank</Label>
              <Select value={withdrawData.bankCode} onValueChange={(v) => { setWithdrawData({ ...withdrawData, bankCode: v }); setWithdrawValidation(null); }}>
                <SelectTrigger data-testid="select-withdraw-bank"><SelectValue placeholder="Select your bank" /></SelectTrigger>
                <SelectContent className="max-h-60">
                  {banks?.map((bank) => (
                    <SelectItem key={bank.code} value={bank.code}>{bank.name}</SelectItem>
                  )) || (
                    <>
                      <SelectItem value="044">Access Bank</SelectItem>
                      <SelectItem value="058">GTBank</SelectItem>
                      <SelectItem value="033">UBA</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Account Number</Label>
              <div className="flex gap-2">
                <Input
                  value={withdrawData.accountNumber}
                  onChange={(e) => { setWithdrawData({ ...withdrawData, accountNumber: e.target.value }); setWithdrawValidation(null); }}
                  placeholder="Enter account number"
                  className="flex-1"
                  data-testid="input-withdraw-account"
                />
                <Button variant="outline" onClick={validateWithdrawAccount} disabled={isValidatingWithdraw || !withdrawData.accountNumber || !withdrawData.bankCode} data-testid="button-verify-withdraw">
                  {isValidatingWithdraw ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {withdrawValidation?.validated && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 rounded-xl text-emerald-800 dark:text-emerald-200 text-sm flex items-center gap-2">
                <CheckCircle className="h-4 w-4 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Account Name</p>
                  <p className="font-bold">{withdrawValidation.name}</p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Amount ({currencySymbol})</Label>
              <Input
                type="number"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="0.00"
                className="text-lg font-bold"
                max={String(balances?.local)}
                data-testid="input-withdraw-amount"
              />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[100, 500, 1000, "All"].map((amt) => (
                <Button key={String(amt)} variant="outline" size="sm" onClick={() => setWithdrawAmount(amt === "All" ? String(balances?.local || 0) : String(amt))} className="text-xs font-bold">
                  {amt === "All" ? "All" : `${currencySymbol}${amt}`}
                </Button>
              ))}
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/50 rounded-xl text-amber-800 dark:text-amber-200 text-sm flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>Withdrawals are typically processed within 1-3 business days.</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsWithdrawOpen(false)}>Cancel</Button>
            <Button
              onClick={() => requirePin(() => withdrawMutation.mutate(withdrawAmount))}
              disabled={!withdrawAmount || !withdrawValidation?.validated || withdrawMutation.isPending || parseFloat(withdrawAmount) > parseFloat(String(balances?.local || 0))}
              data-testid="button-confirm-withdraw"
            >
              {withdrawMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Withdraw {currencySymbol}{withdrawAmount || "0"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isRecordOpen} onOpenChange={setIsRecordOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Record Transaction
            </DialogTitle>
            <DialogDescription>Manually log a financial transaction.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Transaction Type</Label>
              <Select value={recordForm.type} onValueChange={(v) => setRecordForm({ ...recordForm, type: v })}>
                <SelectTrigger data-testid="select-record-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Deposit"><div className="flex items-center gap-2"><ArrowDownRight className="h-4 w-4 text-emerald-600" />Deposit</div></SelectItem>
                  <SelectItem value="Funding"><div className="flex items-center gap-2"><Plus className="h-4 w-4 text-emerald-600" />Funding</div></SelectItem>
                  <SelectItem value="Withdrawal"><div className="flex items-center gap-2"><Banknote className="h-4 w-4 text-amber-600" />Withdrawal</div></SelectItem>
                  <SelectItem value="Payout"><div className="flex items-center gap-2"><ArrowUpRight className="h-4 w-4 text-rose-600" />Payout</div></SelectItem>
                  <SelectItem value="Transfer"><div className="flex items-center gap-2"><ArrowRightLeft className="h-4 w-4 text-blue-600" />Transfer</div></SelectItem>
                  <SelectItem value="Bill"><div className="flex items-center gap-2"><Receipt className="h-4 w-4 text-purple-600" />Bill Payment</div></SelectItem>
                  <SelectItem value="Fee"><div className="flex items-center gap-2"><CreditCard className="h-4 w-4" />Fee</div></SelectItem>
                  <SelectItem value="Refund"><div className="flex items-center gap-2"><RefreshCw className="h-4 w-4 text-emerald-600" />Refund</div></SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Amount ({currencySymbol})</Label>
              <Input
                type="number"
                value={recordForm.amount}
                onChange={(e) => setRecordForm({ ...recordForm, amount: e.target.value })}
                placeholder="0.00"
                data-testid="input-record-amount"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={recordForm.description}
                onChange={(e) => setRecordForm({ ...recordForm, description: e.target.value })}
                placeholder="Transaction description"
                data-testid="input-record-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRecordOpen(false)}>Cancel</Button>
            <Button
              onClick={() => recordMutation.mutate(recordForm)}
              disabled={recordMutation.isPending || !recordForm.amount || !recordForm.description}
              data-testid="button-submit-record"
            >
              {recordMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Record Transaction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PinVerificationDialog
        open={isPinDialogOpen}
        onOpenChange={setIsPinDialogOpen}
        onVerified={handlePinVerified}
      />
    </PageWrapper>
  );
}
