import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getCurrencySymbol, formatCurrencyAmount } from "@/lib/constants";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  PageWrapper,
  PageHeader,
  MetricCard,
  StatusBadge,
  EmptyState,
  fadeUp,
  stagger,
} from "@/components/ui-extended";
import {
  Plus,
  Landmark,
  Copy,
  ArrowDownToLine,
  ArrowUpFromLine,
  Loader2,
  CheckCircle,
  AlertCircle,
  Clock,
  Building,
  Hash,
  Globe,
} from "lucide-react";
import { motion } from "framer-motion";
import type { VirtualAccount, CompanySettings } from "@shared/schema";

export default function VirtualAccounts() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<VirtualAccount | null>(null);
  const [createForm, setCreateForm] = useState({
    name: "",
    currency: "NGN",
    type: "collection",
    countryCode: "NG",
  });

  const { data: settings } = useQuery<CompanySettings>({
    queryKey: ["/api/settings"],
  });

  const { data: accounts, isLoading } = useQuery<VirtualAccount[]>({
    queryKey: ["/api/virtual-accounts"],
  });

  const currency = settings?.currency || "USD";
  const currencySymbol = getCurrencySymbol(currency);

  const balanceByCurrency = accounts?.reduce((acc, a) => {
    const cur = a.currency || "USD";
    const bal = parseFloat(String(a.balance || "0"));
    acc[cur] = (acc[cur] || 0) + bal;
    return acc;
  }, {} as Record<string, number>) || {};
  const balanceCurrencies = Object.keys(balanceByCurrency);
  const activeCount = accounts?.filter(a => a.status === "active").length || 0;
  const pendingCount = accounts?.filter(a => a.status === "pending").length || 0;

  const createMutation = useMutation({
    mutationFn: async (data: typeof createForm) => {
      const res = await apiRequest("POST", "/api/virtual-accounts", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/virtual-accounts"] });
      toast({ title: "Virtual account created", description: "Your dedicated account is being provisioned." });
      setIsCreateOpen(false);
      setCreateForm({ name: "", currency: "NGN", type: "collection", countryCode: "NG" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to create account", description: error.message, variant: "destructive" });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  const openDeposit = (account: VirtualAccount) => {
    setSelectedAccount(account);
    setIsDepositOpen(true);
  };

  const currencyCountryMap: Record<string, string> = {
    NGN: "NG",
    GHS: "GH",
    USD: "US",
    EUR: "EU",
    GBP: "GB",
    KES: "KE",
    ZAR: "ZA",
  };

  const supportedCurrencies = [
    { value: "NGN", label: "Nigerian Naira (NGN)", country: "NG" },
    { value: "GHS", label: "Ghanaian Cedi (GHS)", country: "GH" },
    { value: "USD", label: "US Dollar (USD)", country: "US" },
    { value: "EUR", label: "Euro (EUR)", country: "EU" },
    { value: "GBP", label: "British Pound (GBP)", country: "GB" },
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active": return <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />;
      case "pending": return <Clock className="h-3.5 w-3.5 text-amber-500" />;
      default: return <AlertCircle className="h-3.5 w-3.5 text-red-500" />;
    }
  };

  const getProviderLabel = (provider: string) => {
    if (provider === "paystack") return "Paystack DVA";
    if (provider === "stripe") return "Stripe Treasury";
    return provider;
  };

  if (isLoading) {
    return (
      <PageWrapper>
        <PageHeader title="Virtual Accounts" subtitle="Loading your accounts..." />
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <PageHeader
        title="Virtual Accounts"
        subtitle="Dedicated bank accounts for receiving payments"
        actions={
          <Button onClick={() => setIsCreateOpen(true)} data-testid="button-create-virtual-account">
            <Plus className="h-4 w-4 mr-2" />
            New Account
          </Button>
        }
      />

      <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
        <motion.div variants={fadeUp} className="grid gap-4 md:grid-cols-3">
          <MetricCard
            title="Total Balance"
            value={balanceCurrencies.length === 0 ? formatCurrencyAmount(0, currency) :
              balanceCurrencies.length === 1 ? formatCurrencyAmount(balanceByCurrency[balanceCurrencies[0]], balanceCurrencies[0]) :
              balanceCurrencies.map(c => formatCurrencyAmount(balanceByCurrency[c], c)).join(" + ")}
            icon={Landmark}
          />
          <MetricCard
            title="Active Accounts"
            value={String(activeCount)}
            icon={CheckCircle}
          />
          <MetricCard
            title="Pending Activation"
            value={String(pendingCount)}
            icon={Clock}
          />
        </motion.div>

        {(!accounts || accounts.length === 0) ? (
          <motion.div variants={fadeUp}>
            <EmptyState
              icon={Landmark}
              title="No virtual accounts yet"
              description="Create a dedicated virtual account to receive payments via bank transfer."
              action={
                <Button onClick={() => setIsCreateOpen(true)} data-testid="button-create-first-account">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Virtual Account
                </Button>
              }
            />
          </motion.div>
        ) : (
          <motion.div variants={fadeUp} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {accounts.map((account) => (
              <Card key={account.id} className="hover-elevate" data-testid={`card-virtual-account-${account.id}`}>
                <CardHeader className="flex flex-row items-start justify-between gap-2 pb-3">
                  <div className="space-y-1 min-w-0">
                    <CardTitle className="text-base truncate">{account.name}</CardTitle>
                    <CardDescription className="flex items-center gap-1.5">
                      {getStatusIcon(account.status)}
                      <span className="capitalize">{account.status}</span>
                      <span className="text-muted-foreground/50 mx-1">|</span>
                      <span className="text-xs">{getProviderLabel(account.provider)}</span>
                    </CardDescription>
                  </div>
                  <Badge variant={account.status === "active" ? "default" : "secondary"}>
                    {account.currency}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-2xl font-bold">
                    {formatCurrencyAmount(parseFloat(String(account.balance || "0")), account.currency)}
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <Building className="h-3.5 w-3.5" />
                        Bank
                      </span>
                      <span className="font-medium truncate">{account.bankName}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <Hash className="h-3.5 w-3.5" />
                        Account No.
                      </span>
                      <div className="flex items-center gap-1">
                        {account.accountNumber?.startsWith("pending") || account.accountNumber?.startsWith("PENDING") ? (
                          <span className="text-amber-600 text-xs font-medium">Pending activation</span>
                        ) : (
                          <>
                            <span className="font-mono font-medium">{account.accountNumber}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => copyToClipboard(account.accountNumber)}
                              data-testid={`button-copy-account-${account.id}`}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    {account.accountName && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <Globe className="h-3.5 w-3.5" />
                          Name
                        </span>
                        <span className="font-medium truncate">{account.accountName}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => openDeposit(account)}
                      disabled={account.status !== "active"}
                      data-testid={`button-deposit-${account.id}`}
                    >
                      <ArrowDownToLine className="h-3.5 w-3.5 mr-1.5" />
                      Deposit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      disabled={account.status !== "active" || parseFloat(String(account.balance || "0")) <= 0}
                      data-testid={`button-withdraw-${account.id}`}
                    >
                      <ArrowUpFromLine className="h-3.5 w-3.5 mr-1.5" />
                      Withdraw
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </motion.div>
        )}
      </motion.div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Landmark className="h-5 w-5 text-primary" />
              Create Virtual Account
            </DialogTitle>
            <DialogDescription>
              Set up a dedicated bank account to receive payments. Paystack DVA is available for Nigeria and Ghana.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="account-name">Account Name</Label>
              <Input
                id="account-name"
                placeholder="e.g. Business Collections"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                data-testid="input-account-name"
              />
            </div>

            <div className="space-y-2">
              <Label>Currency</Label>
              <Select
                value={createForm.currency}
                onValueChange={(value) => {
                  const country = currencyCountryMap[value] || "US";
                  setCreateForm({ ...createForm, currency: value, countryCode: country });
                }}
              >
                <SelectTrigger data-testid="select-account-currency">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {supportedCurrencies.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Account Type</Label>
              <Select
                value={createForm.type}
                onValueChange={(value) => setCreateForm({ ...createForm, type: value })}
              >
                <SelectTrigger data-testid="select-account-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="collection">Collection (Receive Payments)</SelectItem>
                  <SelectItem value="settlement">Settlement (Payouts)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(createForm.countryCode === "NG" || createForm.countryCode === "GH") && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-xl text-blue-800 dark:text-blue-200 text-sm flex items-start gap-2">
                <Landmark className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  A Paystack Dedicated Virtual Account (DVA) will be created with a real NUBAN number.
                  {createForm.countryCode === "NG" ? " Bank: Wema Bank." : " Bank: GCB Bank."}
                </span>
              </div>
            )}

            {createForm.countryCode !== "NG" && createForm.countryCode !== "GH" && (
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950 rounded-xl text-indigo-800 dark:text-indigo-200 text-sm flex items-start gap-2">
                <Landmark className="h-4 w-4 mt-0.5 shrink-0" />
                <span>A Stripe Treasury financial account will be created for {createForm.currency} transactions.</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate(createForm)}
              disabled={!createForm.name || createMutation.isPending}
              data-testid="button-confirm-create-account"
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Create Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDepositOpen} onOpenChange={setIsDepositOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowDownToLine className="h-5 w-5 text-primary" />
              Deposit to {selectedAccount?.name}
            </DialogTitle>
            <DialogDescription>
              Transfer funds to this virtual account.
            </DialogDescription>
          </DialogHeader>
          {selectedAccount && (
            <div className="space-y-4 py-2">
              <div className="p-4 bg-muted/50 rounded-xl space-y-3">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Bank Transfer Details</p>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Bank Name</span>
                    <span className="text-sm font-bold">{selectedAccount.bankName}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Account Number</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold font-mono">{selectedAccount.accountNumber}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => copyToClipboard(selectedAccount.accountNumber)}
                        data-testid="button-copy-deposit-account"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Account Name</span>
                    <span className="text-sm font-bold">{selectedAccount.accountName || selectedAccount.name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Currency</span>
                    <span className="text-sm font-bold">{selectedAccount.currency}</span>
                  </div>
                </div>
              </div>
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950 rounded-xl text-emerald-800 dark:text-emerald-200 text-sm flex items-start gap-2">
                <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>Transfer funds to the account details above. Your balance will be credited automatically when the transfer is received.</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDepositOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageWrapper>
  );
}
