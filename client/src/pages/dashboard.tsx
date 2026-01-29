import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
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
  TrendingUp,
  Wallet,
  CreditCard,
  Send,
  Plus,
  ArrowRight,
  Zap,
  AlertCircle,
  CheckCircle,
  Loader2,
  DollarSign,
  Building,
  Shield,
  Sparkles,
  Globe,
  Copy,
  Eye,
  EyeOff,
  RefreshCw,
  BadgeCheck,
} from "lucide-react";
import { Link } from "wouter";
import type { Expense, Transaction, CompanyBalances, AIInsight } from "@shared/schema";

interface Bank {
  code: string;
  name: string;
}

export default function Dashboard() {
  const { toast } = useToast();
  const [isFundingOpen, setIsFundingOpen] = useState(false);
  const [isWithdrawalOpen, setIsWithdrawalOpen] = useState(false);
  const [isSendMoneyOpen, setIsSendMoneyOpen] = useState(false);
  const [fundingAmount, setFundingAmount] = useState("");
  const [withdrawalAmount, setWithdrawalAmount] = useState("");
  const [sendMoneyData, setSendMoneyData] = useState({ recipient: "", amount: "", note: "", bankCode: "" });
  const [accountValidation, setAccountValidation] = useState<{ name: string; validated: boolean } | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [showBalance, setShowBalance] = useState(true);
  const [fundingMethod, setFundingMethod] = useState<"card" | "bank" | "crypto">("card");

  const { data: balances, isLoading: balancesLoading } = useQuery<CompanyBalances>({
    queryKey: ["/api/balances"],
  });

  const { data: transactions, isLoading: transactionsLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
  });

  const { data: insights } = useQuery<AIInsight[]>({
    queryKey: ["/api/insights"],
  });

  const { data: banks } = useQuery<Bank[]>({
    queryKey: ["/api/payment/banks", "NG"],
    queryFn: async () => {
      const res = await fetch("/api/payment/banks/NG");
      return res.json();
    },
  });

  const fundWalletMutation = useMutation({
    mutationFn: async (amount: string) => {
      return apiRequest("POST", "/api/balances/fund", { amount });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/balances"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      toast({ title: "Wallet funded successfully", description: `$${fundingAmount} has been added to your wallet.` });
      setIsFundingOpen(false);
      setFundingAmount("");
    },
    onError: () => {
      toast({ title: "Failed to fund wallet", variant: "destructive" });
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: async (amount: string) => {
      return apiRequest("POST", "/api/balances/withdraw", { amount });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/balances"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      toast({ title: "Withdrawal initiated successfully", description: "Funds will arrive in 1-3 business days." });
      setIsWithdrawalOpen(false);
      setWithdrawalAmount("");
    },
    onError: () => {
      toast({ title: "Failed to withdraw", variant: "destructive" });
    },
  });

  const sendMoneyMutation = useMutation({
    mutationFn: async (data: typeof sendMoneyData) => {
      return apiRequest("POST", "/api/balances/send", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/balances"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      toast({ title: "Money sent successfully", description: `$${sendMoneyData.amount} sent to ${accountValidation?.name || sendMoneyData.recipient}` });
      setIsSendMoneyOpen(false);
      setSendMoneyData({ recipient: "", amount: "", note: "", bankCode: "" });
      setAccountValidation(null);
    },
    onError: () => {
      toast({ title: "Failed to send money", variant: "destructive" });
    },
  });

  const validateAccount = async () => {
    if (!sendMoneyData.recipient || !sendMoneyData.bankCode) {
      toast({ title: "Please enter account number and select bank", variant: "destructive" });
      return;
    }
    
    setIsValidating(true);
    try {
      const res = await apiRequest("POST", "/api/payment/validate-account", {
        accountNumber: sendMoneyData.recipient,
        bankCode: sendMoneyData.bankCode,
        countryCode: "NG",
      });
      const data = await res.json();
      if (data.success) {
        setAccountValidation({ name: data.accountName, validated: true });
        toast({ title: "Account validated", description: `Account belongs to: ${data.accountName}` });
      } else {
        toast({ title: "Validation failed", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Could not validate account", variant: "destructive" });
    } finally {
      setIsValidating(false);
    }
  };

  const totalBalance = balances ? balances.local + balances.usd : 0;
  const recentTransactions = transactions?.slice(0, 5) || [];

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 texture-mesh min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="secondary" className="text-xs font-bold uppercase tracking-widest bg-primary/10 text-primary">
              <Sparkles className="h-3 w-3 mr-1" />HQ
            </Badge>
            <Badge variant="outline" className="text-xs font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800">
              <BadgeCheck className="h-3 w-3 mr-1" />Verified
            </Badge>
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight" data-testid="text-dashboard-title">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome back! Here's your financial overview.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setIsFundingOpen(true)} className="gap-2" data-testid="button-add-funds">
            <Plus className="h-4 w-4" />Add Funds
          </Button>
          <Button onClick={() => setIsSendMoneyOpen(true)} className="gap-2" data-testid="button-send-money">
            <Send className="h-4 w-4" />Send Money
          </Button>
        </div>
      </div>

      <Card className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-white border-0 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 rounded-full blur-[80px]" />
        <CardContent className="p-8 md:p-12">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <p className="text-xs font-bold text-primary uppercase tracking-widest">Total Balance (USD)</p>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6 text-slate-400 hover:text-white"
                  onClick={() => setShowBalance(!showBalance)}
                >
                  {showBalance ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </Button>
              </div>
              {balancesLoading ? <Skeleton className="h-14 w-64 bg-slate-800" /> : (
                <h2 className="text-4xl md:text-6xl font-black tracking-tight" data-testid="text-total-balance">
                  {showBalance 
                    ? `$${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : "••••••••"
                  }
                </h2>
              )}
              <div className="flex items-center gap-4 pt-2">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />Active
                </span>
                <span className="text-xs text-slate-400">Updated just now</span>
              </div>
            </div>
            <div className="flex gap-3">
              <Button size="lg" variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20" onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/balances"] })}>
                <RefreshCw className="h-4 w-4 mr-2" />Refresh
              </Button>
              <Button size="lg" className="bg-white text-slate-900 hover:bg-slate-100" onClick={() => setIsWithdrawalOpen(true)} data-testid="button-withdraw">
                <Wallet className="h-4 w-4 mr-2" />Withdraw
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass card-hover">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Local Balance</p>
              <div className="p-2 bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl">
                <Wallet className="h-4 w-4 text-primary" />
              </div>
            </div>
            {balancesLoading ? <Skeleton className="h-8 w-32" /> : (
              <p className="text-2xl font-black" data-testid="text-local-balance">
                {showBalance ? `$${balances?.local.toLocaleString() || '0'}` : "••••"}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">{balances?.localCurrency || 'USD'}</p>
          </CardContent>
        </Card>

        <Card className="glass card-hover">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">USD Treasury</p>
              <div className="p-2 bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 rounded-xl">
                <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            {balancesLoading ? <Skeleton className="h-8 w-32" /> : (
              <p className="text-2xl font-black" data-testid="text-usd-balance">
                {showBalance ? `$${balances?.usd.toLocaleString() || '0'}` : "••••"}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">Global Treasury</p>
          </CardContent>
        </Card>

        <Card className="glass card-hover">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Escrow</p>
              <div className="p-2 bg-gradient-to-br from-amber-500/20 to-amber-500/5 rounded-xl">
                <Shield className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
            {balancesLoading ? <Skeleton className="h-8 w-32" /> : (
              <p className="text-2xl font-black" data-testid="text-escrow-balance">
                {showBalance ? `$${balances?.escrow.toLocaleString() || '0'}` : "••••"}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">Pending settlements</p>
          </CardContent>
        </Card>
      </div>

      {insights && insights.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            AI Insights
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {insights.map((insight, idx) => (
              <Card key={idx} className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-white border-0 overflow-hidden relative group card-hover">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-colors" />
                <CardContent className="p-6 relative z-10">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${
                      insight.type === 'saving' ? 'bg-gradient-to-br from-emerald-500 to-emerald-600' : insight.type === 'warning' ? 'bg-gradient-to-br from-amber-500 to-amber-600' : 'bg-gradient-to-br from-primary to-indigo-600'
                    }`}>
                      {insight.type === 'saving' ? <CheckCircle className="h-6 w-6" /> : insight.type === 'warning' ? <AlertCircle className="h-6 w-6" /> : <Zap className="h-6 w-6" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1">{insight.type}</p>
                      <h4 className="text-sm font-bold text-white truncate">{insight.title}</h4>
                      <p className="text-xs text-slate-400 mt-2 leading-relaxed">{insight.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Card className="glass overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4 bg-muted/30">
          <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
            <ArrowUpRight className="h-4 w-4 text-primary" />
            Recent Activity
          </CardTitle>
          <Link href="/transactions">
            <Button variant="ghost" size="sm" className="text-xs font-bold text-primary gap-1" data-testid="link-view-all-transactions">
              View All <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {transactionsLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-12 w-12 rounded-xl" />
                    <div><Skeleton className="h-4 w-32 mb-2" /><Skeleton className="h-3 w-20" /></div>
                  </div>
                  <Skeleton className="h-5 w-20" />
                </div>
              ))}
            </div>
          ) : recentTransactions.length > 0 ? (
            <div className="divide-y divide-border">
              {recentTransactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors" data-testid={`transaction-item-${tx.id}`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      tx.type === 'Deposit' || tx.type === 'Funding'
                        ? 'bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 text-emerald-600 dark:text-emerald-400'
                        : 'bg-gradient-to-br from-slate-500/20 to-slate-500/5 text-slate-600 dark:text-slate-400'
                    }`}>
                      {tx.type === 'Deposit' || tx.type === 'Funding' ? <ArrowDownRight className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">{tx.type}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${tx.type === 'Deposit' || tx.type === 'Funding' ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
                      {tx.type === 'Deposit' || tx.type === 'Funding' ? '+' : '-'}${tx.amount.toLocaleString()}
                    </p>
                    <Badge variant="secondary" className={`text-xs ${
                      tx.status === 'Completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : tx.status === 'Processing' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : ''
                    }`}>{tx.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto mb-4">
                <ArrowUpRight className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-bold mb-1">No transactions yet</h3>
              <p className="text-sm text-muted-foreground">Start by funding your wallet.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isFundingOpen} onOpenChange={setIsFundingOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Add Funds
            </DialogTitle>
            <DialogDescription>Fund your wallet to make payments and transfers.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl border border-primary/20">
              <p className="text-xs text-muted-foreground mb-1">Current Balance</p>
              <p className="text-2xl font-bold">${balances?.local.toLocaleString() || '0'}</p>
            </div>
            
            <div className="space-y-2">
              <Label>Funding Method</Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "card", label: "Card", icon: CreditCard },
                  { id: "bank", label: "Bank", icon: Building },
                  { id: "crypto", label: "Crypto", icon: Globe },
                ].map((method) => (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => setFundingMethod(method.id as typeof fundingMethod)}
                    className={`p-3 rounded-xl border-2 text-center transition-all ${
                      fundingMethod === method.id 
                        ? "border-primary bg-primary/10" 
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <method.icon className="h-5 w-5 mx-auto mb-1" />
                    <p className="text-xs font-medium">{method.label}</p>
                  </button>
                ))}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="funding-amount">Amount to Add ($)</Label>
              <Input 
                id="funding-amount" 
                type="number" 
                value={fundingAmount} 
                onChange={(e) => setFundingAmount(e.target.value)} 
                placeholder="0.00" 
                className="text-lg font-bold bg-muted/50"
                data-testid="input-funding-amount" 
              />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[100, 500, 1000, 5000].map((amount) => (
                <Button key={amount} variant="outline" size="sm" onClick={() => setFundingAmount(String(amount))} className="text-xs font-bold">
                  ${amount}
                </Button>
              ))}
            </div>
            
            {fundingMethod === "bank" && (
              <div className="p-4 bg-muted/50 rounded-xl space-y-3">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Bank Transfer Details</p>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Bank Name</span>
                    <span className="text-sm font-bold">Spendly Bank</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Account Number</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold">1234567890</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard("1234567890")}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Reference</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold">SPD-{Date.now().toString().slice(-6)}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(`SPD-${Date.now().toString().slice(-6)}`)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950 rounded-xl text-emerald-800 dark:text-emerald-200 text-sm flex items-start gap-2">
              <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>Instant funding with zero fees.</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFundingOpen(false)}>Cancel</Button>
            <Button onClick={() => fundWalletMutation.mutate(fundingAmount)} disabled={!fundingAmount || fundWalletMutation.isPending} data-testid="button-confirm-funding">
              {fundWalletMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Add ${fundingAmount || '0'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isWithdrawalOpen} onOpenChange={setIsWithdrawalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              Withdraw Funds
            </DialogTitle>
            <DialogDescription>Transfer funds to your bank account.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl border border-primary/20">
              <p className="text-xs text-muted-foreground mb-1">Available Balance</p>
              <p className="text-2xl font-bold">${balances?.local.toLocaleString() || '0'}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="withdrawal-amount">Amount to Withdraw ($)</Label>
              <Input 
                id="withdrawal-amount" 
                type="number" 
                value={withdrawalAmount} 
                onChange={(e) => setWithdrawalAmount(e.target.value)} 
                placeholder="0.00" 
                max={balances?.local} 
                className="text-lg font-bold bg-muted/50"
                data-testid="input-withdrawal-amount" 
              />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[100, 500, 1000, "All"].map((amount) => (
                <Button key={amount} variant="outline" size="sm" onClick={() => setWithdrawalAmount(amount === "All" ? String(balances?.local || 0) : String(amount))} className="text-xs font-bold">
                  {amount === "All" ? "All" : `$${amount}`}
                </Button>
              ))}
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-950 rounded-xl text-amber-800 dark:text-amber-200 text-sm flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>Withdrawals are typically processed within 1-3 business days.</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsWithdrawalOpen(false)}>Cancel</Button>
            <Button onClick={() => withdrawMutation.mutate(withdrawalAmount)} disabled={!withdrawalAmount || withdrawMutation.isPending || parseFloat(withdrawalAmount) > (balances?.local || 0)} data-testid="button-confirm-withdrawal">
              {withdrawMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Withdraw ${withdrawalAmount || '0'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isSendMoneyOpen} onOpenChange={setIsSendMoneyOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              Send Money
            </DialogTitle>
            <DialogDescription>Transfer funds to a recipient with account validation.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl border border-primary/20">
              <p className="text-xs text-muted-foreground mb-1">Available Balance</p>
              <p className="text-2xl font-bold">${balances?.local.toLocaleString() || '0'}</p>
            </div>
            
            <div className="space-y-2">
              <Label>Select Bank</Label>
              <Select value={sendMoneyData.bankCode} onValueChange={(value) => {
                setSendMoneyData({ ...sendMoneyData, bankCode: value });
                setAccountValidation(null);
              }}>
                <SelectTrigger className="bg-muted/50" data-testid="select-bank">
                  <SelectValue placeholder="Choose a bank" />
                </SelectTrigger>
                <SelectContent>
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
              <Label htmlFor="recipient">Account Number</Label>
              <div className="flex gap-2">
                <Input 
                  id="recipient" 
                  value={sendMoneyData.recipient} 
                  onChange={(e) => {
                    setSendMoneyData({ ...sendMoneyData, recipient: e.target.value });
                    setAccountValidation(null);
                  }} 
                  placeholder="Enter 10-digit account number" 
                  className="bg-muted/50"
                  data-testid="input-recipient" 
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={validateAccount} 
                  disabled={isValidating || !sendMoneyData.recipient || !sendMoneyData.bankCode}
                  className="shrink-0"
                >
                  {isValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
                </Button>
              </div>
            </div>
            
            {accountValidation && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950 rounded-xl border border-emerald-200 dark:border-emerald-800">
                <div className="flex items-center gap-2">
                  <BadgeCheck className="h-5 w-5 text-emerald-600" />
                  <div>
                    <p className="text-xs text-muted-foreground">Account Name</p>
                    <p className="font-bold text-emerald-700 dark:text-emerald-400">{accountValidation.name}</p>
                  </div>
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="send-amount">Amount ($)</Label>
              <Input 
                id="send-amount" 
                type="number" 
                value={sendMoneyData.amount} 
                onChange={(e) => setSendMoneyData({ ...sendMoneyData, amount: e.target.value })} 
                placeholder="0.00" 
                className="text-lg font-bold bg-muted/50"
                data-testid="input-send-amount" 
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="note">Note (optional)</Label>
              <Input 
                id="note" 
                value={sendMoneyData.note} 
                onChange={(e) => setSendMoneyData({ ...sendMoneyData, note: e.target.value })} 
                placeholder="Add a note for the recipient" 
                className="bg-muted/50"
                data-testid="input-send-note" 
              />
            </div>
            
            {sendMoneyData.amount && (
              <div className="p-4 bg-muted/50 rounded-xl space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-bold">${parseFloat(sendMoneyData.amount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Fee</span>
                  <span className="font-bold text-emerald-600">$0.00</span>
                </div>
                <div className="border-t pt-2 flex justify-between">
                  <span className="font-bold">Total</span>
                  <span className="font-bold text-primary">${parseFloat(sendMoneyData.amount).toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSendMoneyOpen(false)}>Cancel</Button>
            <Button 
              onClick={() => sendMoneyMutation.mutate(sendMoneyData)} 
              disabled={!sendMoneyData.recipient || !sendMoneyData.amount || sendMoneyMutation.isPending} 
              data-testid="button-confirm-send"
            >
              {sendMoneyMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Send ${sendMoneyData.amount || '0'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
