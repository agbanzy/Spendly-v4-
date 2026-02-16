import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
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
    return `${currencySymbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

  const getStatusColor = (status: string): "emerald" | "amber" | "rose" | "slate" | "cyan" | "primary" => {
    switch (status?.toLowerCase()) {
      case "completed": return "emerald";
      case "processing": return "amber";
      case "failed": return "rose";
      default: return "slate";
    }
  };

  const getTransactionColor = (type: string): "emerald" | "cyan" | "slate" | "primary" => {
    if (type === "Deposit" || type === "Funding") return "emerald";
    if (type === "Payout") return "cyan";
    return "slate";
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: "easeOut" },
    },
  };

  return (
    <PageWrapper>
      <PageHeader
        title="Transactions"
        subtitle="View and manage all your financial transactions."
        actions={
          <div className="flex gap-3">
            <Button variant="outline" data-testid="button-export-transactions">
              <Download className="h-4 w-4 mr-2" />Export
            </Button>
            <Button
              onClick={() => setIsOpen(true)}
              className="bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-700 hover:to-violet-800"
              data-testid="button-add-transaction"
            >
              <Plus className="h-4 w-4 mr-2" />New Transaction
            </Button>
          </div>
        }
      />

      <motion.div
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={itemVariants}>
          <MetricCard
            label="Total Transactions"
            value={isLoading ? <Skeleton className="h-8 w-24" /> : transactions?.length || 0}
            sublabel="All time"
            icon={Wallet}
            color="primary"
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <MetricCard
            label="Total Inflow"
            value={isLoading ? <Skeleton className="h-8 w-24" /> : `+${formatCurrency(totalInflow)}`}
            sublabel="Money received"
            icon={ArrowDownRight}
            color="emerald"
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <MetricCard
            label="Total Outflow"
            value={isLoading ? <Skeleton className="h-8 w-24" /> : `-${formatCurrency(totalOutflow)}`}
            sublabel="Money spent"
            icon={ArrowUpRight}
            color="rose"
          />
        </motion.div>
      </motion.div>

      <GlassCard>
        <div className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search transactions..."
                className="pl-11 bg-slate-500/10 border-slate-300/30 rounded-2xl h-11 placeholder:text-slate-500 focus:bg-slate-500/15 focus:border-violet-300/50 transition-colors"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search-transactions"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger
                className="w-full md:w-[180px] bg-slate-500/10 border-slate-300/30 rounded-2xl h-11 focus:bg-slate-500/15 focus:border-violet-300/50"
                data-testid="select-transaction-type"
              >
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="deposit">Deposit</SelectItem>
                <SelectItem value="payout">Payout</SelectItem>
                <SelectItem value="bill">Bill</SelectItem>
                <SelectItem value="funding">Funding</SelectItem>
                <SelectItem value="transfer">Transfer</SelectItem>
                <SelectItem value="withdrawal">Withdrawal</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger
                className="w-full md:w-[180px] bg-slate-500/10 border-slate-300/30 rounded-2xl h-11 focus:bg-slate-500/15 focus:border-violet-300/50"
                data-testid="select-transaction-status"
              >
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
        </div>
      </GlassCard>

      <GlassCard>
        <div>
          <div className="px-6 py-4 border-b border-slate-300/20">
            <SectionLabel>All Transactions</SectionLabel>
          </div>
          <div className="divide-y divide-slate-300/20">
            {isLoading ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-12 w-12 rounded-xl" />
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
              <motion.div
                className="divide-y divide-slate-300/20"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
              >
                {filteredTransactions.map((tx, index) => (
                  <AnimatedListItem
                    key={tx.id}
                    delay={index * 0.05}
                    className="group"
                    data-testid={`transaction-row-${tx.id}`}
                  >
                    <div className="flex items-center justify-between p-4 hover:bg-slate-500/5 transition-all duration-200">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div
                          className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br ${
                            getTransactionColor(tx.type) === "emerald"
                              ? "from-emerald-500/30 to-emerald-600/20"
                              : getTransactionColor(tx.type) === "cyan"
                              ? "from-cyan-500/30 to-cyan-600/20"
                              : "from-slate-500/30 to-slate-600/20"
                          }`}
                        >
                          {tx.type === "Deposit" || tx.type === "Funding" ? (
                            <ArrowDownRight
                              className={`h-5 w-5 ${
                                getTransactionColor(tx.type) === "emerald"
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : getTransactionColor(tx.type) === "cyan"
                                  ? "text-cyan-600 dark:text-cyan-400"
                                  : "text-slate-600 dark:text-slate-400"
                              }`}
                            />
                          ) : (
                            <ArrowUpRight
                              className={`h-5 w-5 ${
                                getTransactionColor(tx.type) === "emerald"
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : getTransactionColor(tx.type) === "cyan"
                                  ? "text-cyan-600 dark:text-cyan-400"
                                  : "text-slate-600 dark:text-slate-400"
                              }`}
                            />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold truncate text-slate-900 dark:text-slate-100">
                            {tx.description}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs px-2 py-1 bg-slate-500/10 text-slate-700 dark:text-slate-300 rounded-lg border border-slate-300/30">
                              {tx.type}
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {new Date(tx.date).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-4">
                        <p
                          className={`text-base font-bold ${
                            tx.type === "Deposit" || tx.type === "Funding"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-slate-900 dark:text-slate-100"
                          }`}
                        >
                          {tx.type === "Deposit" || tx.type === "Funding"
                            ? "+"
                            : "-"}
                          {formatCurrency(Number(tx.amount))}
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
                ))}
              </motion.div>
            ) : (
              <EmptyState
                icon={ArrowUpRight}
                title="No transactions found"
                description={
                  searchQuery || typeFilter !== "all" || statusFilter !== "all"
                    ? "Try adjusting your filters."
                    : "Your transaction history will appear here."
                }
              />
            )}
          </div>
        </div>
      </GlassCard>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>New Transaction</DialogTitle>
            <DialogDescription>
              Record a new financial transaction.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="type" className="text-sm font-medium">
                Transaction Type
              </Label>
              <Select
                value={formData.type}
                onValueChange={(value) =>
                  setFormData({ ...formData, type: value })
                }
              >
                <SelectTrigger
                  className="bg-slate-500/10 border-slate-300/30 rounded-xl h-11 focus:bg-slate-500/15 focus:border-violet-300/50"
                  data-testid="select-new-transaction-type"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Deposit">
                    <div className="flex items-center gap-2">
                      <Wallet className="h-4 w-4" />
                      Deposit
                    </div>
                  </SelectItem>
                  <SelectItem value="Withdrawal">
                    <div className="flex items-center gap-2">
                      <Send className="h-4 w-4" />
                      Withdrawal
                    </div>
                  </SelectItem>
                  <SelectItem value="Payout">
                    <div className="flex items-center gap-2">
                      <ArrowUpRight className="h-4 w-4" />
                      Payout
                    </div>
                  </SelectItem>
                  <SelectItem value="Funding">
                    <div className="flex items-center gap-2">
                      <ArrowDownRight className="h-4 w-4" />
                      Funding
                    </div>
                  </SelectItem>
                  <SelectItem value="Transfer">
                    <div className="flex items-center gap-2">
                      <ArrowUpRight className="h-4 w-4" />
                      Transfer
                    </div>
                  </SelectItem>
                  <SelectItem value="Bill">
                    <div className="flex items-center gap-2">
                      <Wallet className="h-4 w-4" />
                      Bill Payment
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount" className="text-sm font-medium">
                Amount ({currencySymbol})
              </Label>
              <Input
                id="amount"
                type="number"
                value={formData.amount}
                onChange={(e) =>
                  setFormData({ ...formData, amount: e.target.value })
                }
                placeholder="0.00"
                className="bg-slate-500/10 border-slate-300/30 rounded-xl h-11 focus:bg-slate-500/15 focus:border-violet-300/50"
                data-testid="input-transaction-amount"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-medium">
                Description
              </Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Transaction description"
                className="bg-slate-500/10 border-slate-300/30 rounded-xl h-11 focus:bg-slate-500/15 focus:border-violet-300/50"
                data-testid="input-transaction-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending}
              className="bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-700 hover:to-violet-800"
              data-testid="button-submit-transaction"
            >
              {createMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              )}
              Create Transaction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageWrapper>
  );
}
