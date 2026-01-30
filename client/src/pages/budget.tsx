import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  PieChart,
  TrendingUp,
  AlertTriangle,
  MoreVertical,
  Pencil,
  Trash2,
  Loader2,
} from "lucide-react";
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

  // Currency formatting
  const currencySymbols: Record<string, string> = {
    USD: "$", EUR: "€", GBP: "£", NGN: "₦", KES: "KSh", GHS: "₵", ZAR: "R"
  };
  const currency = settings?.currency || "USD";
  const currencySymbol = currencySymbols[currency] || "$";
  
  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) || 0 : amount;
    return `${currencySymbol}${num.toLocaleString()}`;
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

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 texture-mesh min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight" data-testid="text-budget-title">Budget</h1>
          <p className="text-muted-foreground mt-1">Set and track spending limits by category.</p>
        </div>
        <Button onClick={() => { resetForm(); setEditingBudget(null); setIsOpen(true); }} data-testid="button-create-budget">
          <Plus className="h-4 w-4 mr-2" />Create Budget
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass card-hover bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Total Budget</p>
              <PieChart className="h-4 w-4 text-primary" />
            </div>
            {isLoading ? <Skeleton className="h-8 w-32" /> : (
              <>
                <p className="text-3xl font-black" data-testid="text-total-budget">{formatCurrency(totalBudget)}</p>
                <p className="text-sm text-muted-foreground mt-2">Across {budgets?.length || 0} categories</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="glass card-hover">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Total Spent</p>
              <div className="p-2 bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 rounded-xl">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
              </div>
            </div>
            {isLoading ? <Skeleton className="h-8 w-32" /> : (
              <>
                <p className="text-3xl font-black" data-testid="text-total-spent">{formatCurrency(totalSpent)}</p>
                <div className="mt-2">
                  <Progress value={(totalSpent / totalBudget) * 100} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1">{totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0}% of total budget</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className={`glass card-hover ${overBudget > 0 ? "border-red-200 dark:border-red-900" : ""}`}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Over Budget</p>
              <AlertTriangle className={`h-4 w-4 ${overBudget > 0 ? "text-red-600" : "text-muted-foreground"}`} />
            </div>
            {isLoading ? <Skeleton className="h-8 w-24" /> : (
              <>
                <p className={`text-3xl font-black ${overBudget > 0 ? "text-red-600" : ""}`}>{overBudget}</p>
                <p className="text-sm text-muted-foreground mt-2">{overBudget === 0 ? "All budgets on track" : "Categories exceeded"}</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Budget Categories</h3>
        
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}><CardContent className="p-6"><Skeleton className="h-6 w-32 mb-4" /><Skeleton className="h-4 w-full mb-2" /><Skeleton className="h-3 w-24" /></CardContent></Card>
            ))}
          </div>
        ) : budgets && budgets.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {budgets.map((budget) => {
              const percentage = (budget.spent / budget.limit) * 100;
              const isOverBudget = percentage >= 100;
              const isWarning = percentage >= 80 && percentage < 100;
              
              return (
                <Card key={budget.id} className={isOverBudget ? "border-red-200 dark:border-red-900" : ""} data-testid={`budget-card-${budget.id}`}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h4 className="text-lg font-bold">{budget.name}</h4>
                        <Badge variant="outline" className="text-xs mt-1">{budget.category}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        {isOverBudget && <Badge variant="destructive" className="text-xs"><AlertTriangle className="h-3 w-3 mr-1" />Over Budget</Badge>}
                        {isWarning && <Badge className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"><TrendingUp className="h-3 w-3 mr-1" />Warning</Badge>}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(budget)}><Pencil className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600" onClick={() => deleteMutation.mutate(budget.id)}><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-baseline justify-between">
                        <span className="text-2xl font-black">{formatCurrency(budget.spent)}</span>
                        <span className="text-sm text-muted-foreground">of {formatCurrency(budget.limit)}</span>
                      </div>
                      <Progress value={Math.min(percentage, 100)} className="h-3" />
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{Math.round(percentage)}% used</span>
                        <span className="capitalize">{budget.period}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <PieChart className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-bold mb-1">No budgets yet</h3>
              <p className="text-sm text-muted-foreground mb-4">Create your first budget to start tracking spending.</p>
              <Button onClick={() => setIsOpen(true)}><Plus className="h-4 w-4 mr-2" />Create Budget</Button>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBudget ? "Edit Budget" : "Create New Budget"}</DialogTitle>
            <DialogDescription>{editingBudget ? "Update the budget details." : "Set a spending limit for a category."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Budget Name</Label>
              <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g., Marketing Spend" data-testid="input-budget-name" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                  <SelectTrigger data-testid="select-budget-category"><SelectValue /></SelectTrigger>
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
                <Select value={formData.period} onValueChange={(value) => setFormData({ ...formData, period: value })}>
                  <SelectTrigger data-testid="select-budget-period"><SelectValue /></SelectTrigger>
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
              <Label htmlFor="limit">Budget Limit ($)</Label>
              <Input id="limit" type="number" value={formData.limit} onChange={(e) => setFormData({ ...formData, limit: e.target.value })} placeholder="0.00" data-testid="input-budget-limit" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-budget">
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingBudget ? "Update Budget" : "Create Budget"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
