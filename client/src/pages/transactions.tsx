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
  Search,
  Download,
  Plus,
  Loader2,
  Wallet,
  Send,
} from "lucide-react";
import type { Transaction, CompanySettings } from "@shared/schema";

export default function Transactions() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [formData, setFormData] = useState({
    type: "Deposit",
    amount: "",
    description: "",
  });

  const { data: settings } = useQuery<CompanySettings>({
    queryKey: ["/api/settings"],
  });

  const currencySymbols: Record<string, string> = {
    USD: "$", EUR: "€", GBP: "£", NGN: "₦", KES: "KSh", GHS: "₵", ZAR: "R"
  };
  const currencySymbol = currencySymbols[settings?.currency || "USD"] || "$";
  const formatCurrency = (amount: number) => {
    return `${currencySymbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const { data: transactions, isLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("POST", "/api/transactions", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/balances"] });
      toast({ title: "Transaction created successfully" });
      setIsOpen(false);
      resetForm();
    },
    onError: () => {
      toast({ title: "Failed to create transaction", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({ type: "Deposit", amount: "", description: "" });
  };

  const handleSubmit = () => {
    createMutation.mutate(formData);
  };

  const filteredTransactions = transactions?.filter((tx) => {
    const matchesSearch = tx.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "all" || tx.type.toLowerCase() === typeFilter.toLowerCase();
    const matchesStatus = statusFilter === "all" || tx.status.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesType && matchesStatus;
  });

  const totalInflow = transactions?.filter(tx => tx.type === "Deposit" || tx.type === "Funding").reduce((sum, tx) => sum + Number(tx.amount), 0) || 0;
  const totalOutflow = transactions?.filter(tx => tx.type !== "Deposit" && tx.type !== "Funding").reduce((sum, tx) => sum + Number(tx.amount), 0) || 0;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 texture-mesh min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight" data-testid="text-transactions-title">Transactions</h1>
          <p className="text-muted-foreground mt-1">View and manage all your financial transactions.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" data-testid="button-export-transactions">
            <Download className="h-4 w-4 mr-2" />Export
          </Button>
          <Button onClick={() => setIsOpen(true)} data-testid="button-add-transaction">
            <Plus className="h-4 w-4 mr-2" />New Transaction
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass card-hover">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Total Transactions</p>
              <div className="p-2 bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl">
                <Wallet className="h-4 w-4 text-primary" />
              </div>
            </div>
            {isLoading ? <Skeleton className="h-8 w-24" /> : <p className="text-2xl font-black">{transactions?.length || 0}</p>}
            <p className="text-xs text-muted-foreground mt-1">All time</p>
          </CardContent>
        </Card>
        <Card className="glass card-hover">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Total Inflow</p>
              <div className="p-2 bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 rounded-xl">
                <ArrowDownRight className="h-4 w-4 text-emerald-600" />
              </div>
            </div>
            {isLoading ? <Skeleton className="h-8 w-24" /> : <p className="text-2xl font-black text-emerald-600">+{formatCurrency(totalInflow)}</p>}
            <p className="text-xs text-muted-foreground mt-1">Money received</p>
          </CardContent>
        </Card>
        <Card className="glass card-hover">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Total Outflow</p>
              <div className="p-2 bg-gradient-to-br from-red-500/20 to-red-500/5 rounded-xl">
                <ArrowUpRight className="h-4 w-4 text-red-600" />
              </div>
            </div>
            {isLoading ? <Skeleton className="h-8 w-24" /> : <p className="text-2xl font-black text-red-600">-{formatCurrency(totalOutflow)}</p>}
            <p className="text-xs text-muted-foreground mt-1">Money spent</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search transactions..." className="pl-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} data-testid="input-search-transactions" />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full md:w-[180px]" data-testid="select-transaction-type">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="deposit">Deposit</SelectItem>
                <SelectItem value="payout">Payout</SelectItem>
                <SelectItem value="bill">Bill</SelectItem>
                <SelectItem value="funding">Funding</SelectItem>
                <SelectItem value="withdrawal">Withdrawal</SelectItem>
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
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-sm font-bold uppercase tracking-widest">All Transactions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-12 w-12 rounded-xl" />
                    <div><Skeleton className="h-4 w-48 mb-2" /><Skeleton className="h-3 w-24" /></div>
                  </div>
                  <div className="text-right">
                    <Skeleton className="h-5 w-24 mb-2" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredTransactions && filteredTransactions.length > 0 ? (
            <div className="divide-y divide-border">
              {filteredTransactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors cursor-pointer" data-testid={`transaction-row-${tx.id}`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      tx.type === 'Deposit' || tx.type === 'Funding'
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                        : tx.type === 'Payout'
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}>
                      {tx.type === 'Deposit' || tx.type === 'Funding' ? <ArrowDownRight className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate">{tx.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">{tx.type}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-base font-bold ${tx.type === 'Deposit' || tx.type === 'Funding' ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
                      {tx.type === 'Deposit' || tx.type === 'Funding' ? '+' : '-'}{formatCurrency(Number(tx.amount))}
                    </p>
                    <Badge variant="secondary" className={`text-xs mt-1 ${
                      tx.status === 'Completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : tx.status === 'Processing' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        : tx.status === 'Failed' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : ''
                    }`}>{tx.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <ArrowUpRight className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-bold mb-1">No transactions found</h3>
              <p className="text-sm text-muted-foreground">{searchQuery || typeFilter !== "all" || statusFilter !== "all" ? "Try adjusting your filters." : "Your transaction history will appear here."}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Transaction</DialogTitle>
            <DialogDescription>Record a new financial transaction.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="type">Transaction Type</Label>
              <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                <SelectTrigger data-testid="select-new-transaction-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Deposit"><div className="flex items-center gap-2"><Wallet className="h-4 w-4" />Deposit</div></SelectItem>
                  <SelectItem value="Withdrawal"><div className="flex items-center gap-2"><Send className="h-4 w-4" />Withdrawal</div></SelectItem>
                  <SelectItem value="Payout"><div className="flex items-center gap-2"><ArrowUpRight className="h-4 w-4" />Payout</div></SelectItem>
                  <SelectItem value="Funding"><div className="flex items-center gap-2"><ArrowDownRight className="h-4 w-4" />Funding</div></SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount ({currencySymbol})</Label>
              <Input id="amount" type="number" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} placeholder="0.00" data-testid="input-transaction-amount" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input id="description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Transaction description" data-testid="input-transaction-description" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending} data-testid="button-submit-transaction">
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Create Transaction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
