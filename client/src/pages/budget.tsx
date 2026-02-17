import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatCurrencyAmount } from "@/lib/constants";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  TrendingUp,
  AlertTriangle,
  MoreVertical,
  Pencil,
  Trash2,
  Loader2,
  Wallet,
} from "lucide-react";
import {
  PageWrapper,
  PageHeader,
  MetricCard,
  StatusBadge,
  EmptyState,
  SectionLabel,
  GlassCard,
  ProgressRing,
  fadeUp,
} from "@/components/ui-extended";
import type { Budget, CompanySettings } from "@shared/schema";

export default function BudgetPage() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    category: "Software",
    limit: "",
    period: "monthly",
  });

  const { data: settings } = useQuery<CompanySettings>({
    queryKey: ["/api/settings"],
  });

  const currency = settings?.currency || "USD";

  const formatCurrency = (amount: number | string) => {
    return formatCurrencyAmount(amount, currency);
  };

  const { data: budgets, isLoading } = useQuery<Budget[]>({
    queryKey: ["/api/budgets"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("POST", "/api/budgets", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      toast({ title: "Budget created successfully" });
      setIsOpen(false);
      resetForm();
    },
    onError: () => {
      toast({ title: "Failed to create budget", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Budget> }) => {
      return apiRequest("PATCH", `/api/budgets/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      toast({ title: "Budget updated successfully" });
      setIsOpen(false);
      setEditingBudget(null);
      resetForm();
    },
    onError: () => {
      toast({ title: "Failed to update budget", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/budgets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      toast({ title: "Budget deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete budget", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({ name: "", category: "Software", limit: "", period: "monthly" });
  };

  const openEditDialog = (budget: Budget) => {
    setEditingBudget(budget);
    setFormData({
      name: budget.name,
      category: budget.category,
      limit: String(budget.limit),
      period: budget.period,
    });
    setIsOpen(true);
  };

  const handleSubmit = () => {
    if (editingBudget) {
      updateMutation.mutate({ id: editingBudget.id, data: { ...formData, limit: parseFloat(formData.limit) } });
    } else {
      createMutation.mutate(formData);
    }
  };

  const totalBudget = budgets?.reduce((sum, b) => sum + b.limit, 0) || 0;
  const totalSpent = budgets?.reduce((sum, b) => sum + b.spent, 0) || 0;
  const overBudget = budgets?.filter((b) => b.spent > b.limit).length || 0;

  const getCategoryGradient = (category: string) => {
    const gradients: Record<string, string> = {
      Software: "from-primary/15 to-primary/5",
      Marketing: "from-cyan/15 to-cyan/5",
      Travel: "from-emerald/15 to-emerald/5",
      Office: "from-amber/15 to-amber/5",
      Equipment: "from-slate/15 to-slate/5",
      Other: "from-rose/15 to-rose/5",
    };
    return gradients[category] || "from-slate/15 to-slate/5";
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4, ease: "easeOut" },
    },
  };

  return (
    <PageWrapper>
      <PageHeader
        title="Budget"
        subtitle="Set and track spending limits by category."
        actions={
          <Button
            onClick={() => {
              resetForm();
              setEditingBudget(null);
              setIsOpen(true);
            }}
            data-testid="button-create-budget"
            className="bg-gradient-to-r from-primary via-primary to-primary hover:shadow-lg hover:shadow-primary/25 transition-all"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Budget
          </Button>
        }
      />

      <motion.div
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {isLoading ? (
          <>
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </>
        ) : (
          <>
            <motion.div variants={itemVariants}>
              <MetricCard
                title="Total Budget"
                value={formatCurrency(totalBudget)}
                icon={Wallet}
                color="primary"
                trend="neutral"
                trendLabel={`${budgets?.length || 0} categories`}
              />
            </motion.div>

            <motion.div variants={itemVariants}>
              <MetricCard
                title="Total Spent"
                value={formatCurrency(totalSpent)}
                icon={TrendingUp}
                color="emerald"
                trend="up"
                trendLabel={`${totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0}% of budget`}
              />
            </motion.div>

            <motion.div variants={itemVariants}>
              <MetricCard
                title="Over Budget"
                value={String(overBudget)}
                icon={AlertTriangle}
                color={overBudget > 0 ? "rose" : "cyan"}
                trend={overBudget > 0 ? "down" : "neutral"}
                trendLabel={overBudget === 0 ? "All on track" : "Categories exceeded"}
              />
            </motion.div>
          </>
        )}
      </motion.div>

      <motion.div
        className="space-y-4 mt-8"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <SectionLabel>Budget Categories</SectionLabel>

        {isLoading ? (
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {[1, 2, 3, 4].map((i) => (
              <motion.div key={i} variants={itemVariants}>
                <Skeleton className="h-40 rounded-xl" />
              </motion.div>
            ))}
          </motion.div>
        ) : budgets && budgets.length > 0 ? (
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {budgets.map((budget, index) => {
              const percentage = (budget.spent / budget.limit) * 100;
              const isOverBudget = percentage >= 100;
              const isWarning = percentage >= 80 && percentage < 100;

              return (
                <motion.div
                  key={budget.id}
                  variants={itemVariants}
                  data-testid={`budget-card-${budget.id}`}
                >
                  <GlassCard
                    className={`group relative overflow-hidden gradient-border backdrop-blur-xl transition-all duration-300 hover:shadow-xl
                      ${isOverBudget ? "ring-2 ring-rose-500/50 shadow-rose-500/20" : ""}
                      ${isWarning ? "ring-1 ring-amber-500/30" : ""}
                      ${!isOverBudget && !isWarning ? "hover:ring-1 hover:ring-primary/30" : ""}
                      bg-gradient-to-br ${getCategoryGradient(budget.category)}`}
                  >
                    {isOverBudget && (
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-rose-500/5 to-transparent pointer-events-none" />
                    )}

                    <div className="p-6 space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="text-lg font-bold text-foreground">{budget.name}</h4>
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <StatusBadge
                              variant="secondary"
                              className="text-xs font-medium bg-background/50 backdrop-blur"
                            >
                              {budget.category}
                            </StatusBadge>
                            <StatusBadge
                              variant="secondary"
                              className="text-xs font-medium bg-background/50 backdrop-blur capitalize"
                            >
                              {budget.period}
                            </StatusBadge>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {isOverBudget && (
                            <StatusBadge variant="destructive" className="text-xs flex-shrink-0">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Over
                            </StatusBadge>
                          )}
                          {isWarning && !isOverBudget && (
                            <StatusBadge
                              variant="warning"
                              className="text-xs flex-shrink-0 bg-amber-500/20 text-amber-700 dark:text-amber-400"
                            >
                              <TrendingUp className="h-3 w-3 mr-1" />
                              Warning
                            </StatusBadge>
                          )}

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditDialog(budget)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-rose-600 dark:text-rose-400"
                                onClick={() => deleteMutation.mutate(budget.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>

                      <div className="flex gap-4 items-center">
                        <div className="flex-shrink-0">
                          <ProgressRing
                            value={Math.min(percentage, 100)}
                            size={80}
                            strokeWidth={6}
                            color={
                              isOverBudget ? "rgb(225, 29, 72)" : isWarning ? "rgb(217, 119, 6)" : "rgb(139, 92, 246)"
                            }
                          />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="space-y-2">
                            <div>
                              <p className="text-2xl font-black text-foreground" data-testid={`spent-${budget.id}`}>
                                {formatCurrency(budget.spent)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                of {formatCurrency(budget.limit)}
                              </p>
                            </div>
                            <div className="flex items-center justify-between text-xs font-semibold">
                              <span className="text-muted-foreground">{Math.round(percentage)}% used</span>
                              {isOverBudget && (
                                <span className="text-rose-600 dark:text-rose-400">
                                  +{formatCurrency(budget.spent - budget.limit)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </GlassCard>
                </motion.div>
              );
            })}
          </motion.div>
        ) : (
          <motion.div variants={itemVariants}>
            <EmptyState
              icon={Wallet}
              title="No budgets yet"
              subtitle="Create your first budget to start tracking spending."
              action={
                <Button
                  onClick={() => {
                    resetForm();
                    setEditingBudget(null);
                    setIsOpen(true);
                  }}
                  className="bg-gradient-to-r from-primary via-primary to-primary hover:shadow-lg hover:shadow-primary/25 transition-all"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Budget
                </Button>
              }
            />
          </motion.div>
        )}
      </motion.div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle>{editingBudget ? "Edit Budget" : "Create New Budget"}</DialogTitle>
            <DialogDescription>
              {editingBudget ? "Update the budget details." : "Set a spending limit for a category."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Budget Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Marketing Spend"
                data-testid="input-budget-name"
                className="bg-muted/30 border-border/50 rounded-xl h-11 focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger
                    data-testid="select-budget-category"
                    className="bg-muted/30 border-border/50 rounded-xl h-11"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Software">Software</SelectItem>
                    <SelectItem value="Marketing">Marketing</SelectItem>
                    <SelectItem value="Travel">Travel</SelectItem>
                    <SelectItem value="Office">Office</SelectItem>
                    <SelectItem value="Equipment">Equipment</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="period">Period</Label>
                <Select
                  value={formData.period}
                  onValueChange={(value) => setFormData({ ...formData, period: value })}
                >
                  <SelectTrigger
                    data-testid="select-budget-period"
                    className="bg-muted/30 border-border/50 rounded-xl h-11"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="limit">Budget Limit ({currency})</Label>
              <Input
                id="limit"
                type="number"
                value={formData.limit}
                onChange={(e) => setFormData({ ...formData, limit: e.target.value })}
                placeholder="0.00"
                data-testid="input-budget-limit"
                className="bg-muted/30 border-border/50 rounded-xl h-11 focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-submit-budget"
              className="bg-gradient-to-r from-primary via-primary to-primary hover:shadow-lg hover:shadow-primary/25 transition-all"
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              )}
              {editingBudget ? "Update Budget" : "Create Budget"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageWrapper>
  );
}
