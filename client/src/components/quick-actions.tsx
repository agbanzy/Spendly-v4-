import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { 
  Plus, 
  X,
  Receipt,
  Send,
  Wallet,
  CreditCard,
  FileText,
  Building2,
  Loader2
} from "lucide-react";

interface QuickActionsProps {
  isOpen?: boolean;
}

export function QuickActions({ isOpen: controlledOpen }: QuickActionsProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<"expense" | "payout" | "funding" | "card" | null>(null);
  const [expenseForm, setExpenseForm] = useState({
    merchant: "",
    amount: "",
    category: "",
    note: ""
  });

  const createExpenseMutation = useMutation({
    mutationFn: async (data: typeof expenseForm) => {
      return apiRequest("/api/expenses", {
        method: "POST",
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      toast({
        title: "Expense created",
        description: "Your expense has been submitted for approval."
      });
      setActiveModal(null);
      setIsOpen(false);
      setExpenseForm({ merchant: "", amount: "", category: "", note: "" });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create expense. Please try again.",
        variant: "destructive"
      });
    }
  });

  const actions = [
    {
      label: "New Expense",
      icon: Receipt,
      onClick: () => setActiveModal("expense"),
      color: "from-emerald-500 to-teal-600",
      description: "Submit expense or request"
    },
    {
      label: "Send Payout",
      icon: Send,
      onClick: () => {
        toast({
          title: "Payout",
          description: "Payout feature coming soon."
        });
        setIsOpen(false);
      },
      color: "from-indigo-500 to-purple-600",
      description: "Transfer to bank account"
    },
    {
      label: "Fund Wallet",
      icon: Wallet,
      onClick: () => {
        toast({
          title: "Fund Wallet",
          description: "Wallet funding feature coming soon."
        });
        setIsOpen(false);
      },
      color: "from-slate-700 to-slate-900",
      description: "Add money to wallet"
    },
    {
      label: "Virtual Card",
      icon: CreditCard,
      onClick: () => {
        setLocation("/cards");
        setIsOpen(false);
      },
      color: "from-amber-500 to-orange-600",
      description: "Create new card"
    },
    {
      label: "Pay Bills",
      icon: FileText,
      onClick: () => {
        setLocation("/bills");
        setIsOpen(false);
      },
      color: "from-rose-500 to-pink-600",
      description: "Manage bill payments"
    },
    {
      label: "Vendors",
      icon: Building2,
      onClick: () => {
        setLocation("/vendors");
        setIsOpen(false);
      },
      color: "from-cyan-500 to-blue-600",
      description: "Manage vendors"
    }
  ];

  const handleSubmitExpense = () => {
    if (!expenseForm.merchant || !expenseForm.amount || !expenseForm.category) {
      toast({
        title: "Error",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }
    createExpenseMutation.mutate(expenseForm);
  };

  return (
    <>
      <div className="fixed bottom-6 left-6 z-50 hidden lg:block">
        <div className={`flex flex-col-reverse gap-3 transition-all duration-300 ${isOpen ? "mb-4 opacity-100 translate-y-0" : "mb-0 opacity-0 translate-y-10 pointer-events-none"}`}>
          {actions.map((action, idx) => (
            <button
              key={idx}
              onClick={action.onClick}
              className="flex items-center gap-3 group animate-slide-up"
              style={{ animationDelay: `${idx * 50}ms` }}
              data-testid={`quick-action-${action.label.toLowerCase().replace(/\s/g, "-")}`}
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${action.color} text-white flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
                <action.icon className="h-5 w-5" />
              </div>
              <div className="bg-background border px-4 py-2 rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-300 -translate-x-4 group-hover:translate-x-0 min-w-[160px]">
                <p className="text-xs font-bold uppercase tracking-wider">{action.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>
              </div>
            </button>
          ))}
        </div>

        <Button
          onClick={() => setIsOpen(!isOpen)}
          size="lg"
          className={`w-14 h-14 rounded-xl shadow-xl transition-all duration-300 ${isOpen ? "rotate-45 bg-slate-700" : "bg-gradient-to-br from-indigo-600 to-indigo-700"}`}
          data-testid="button-quick-actions"
        >
          {isOpen ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
        </Button>
      </div>

      <div className={`fixed inset-x-0 bottom-0 z-50 lg:hidden transition-transform duration-300 ${isOpen ? "translate-y-0" : "translate-y-full"}`}>
        <div className="bg-background border-t rounded-t-3xl shadow-2xl p-6 pb-10">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold">Quick Actions</h3>
            <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {actions.map((action, idx) => (
              <button
                key={idx}
                onClick={action.onClick}
                className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-muted transition-colors"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${action.color} text-white flex items-center justify-center shadow-lg`}>
                  <action.icon className="h-5 w-5" />
                </div>
                <span className="text-xs font-semibold text-center leading-tight">
                  {action.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <Button
        onClick={() => setIsOpen(!isOpen)}
        size="lg"
        className={`fixed bottom-6 right-6 z-40 lg:hidden w-14 h-14 rounded-full shadow-xl ${isOpen ? "rotate-45 bg-slate-700" : "bg-gradient-to-br from-indigo-600 to-indigo-700"}`}
        data-testid="button-quick-actions-mobile"
      >
        {isOpen ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
      </Button>

      <Dialog open={activeModal === "expense"} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Expense</DialogTitle>
            <DialogDescription>
              Submit an expense for approval.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Merchant / Vendor</Label>
              <Input
                placeholder="e.g., Amazon, Uber, Starbucks"
                value={expenseForm.merchant}
                onChange={(e) => setExpenseForm(prev => ({ ...prev, merchant: e.target.value }))}
                data-testid="input-expense-merchant"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount (USD)</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm(prev => ({ ...prev, amount: e.target.value }))}
                  data-testid="input-expense-amount"
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={expenseForm.category}
                  onValueChange={(value) => setExpenseForm(prev => ({ ...prev, category: value }))}
                >
                  <SelectTrigger data-testid="select-expense-category">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Software">Software</SelectItem>
                    <SelectItem value="Travel">Travel</SelectItem>
                    <SelectItem value="Office">Office</SelectItem>
                    <SelectItem value="Marketing">Marketing</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Note (Optional)</Label>
              <Textarea
                placeholder="Add details about this expense..."
                value={expenseForm.note}
                onChange={(e) => setExpenseForm(prev => ({ ...prev, note: e.target.value }))}
                data-testid="input-expense-note"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveModal(null)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmitExpense} 
              disabled={createExpenseMutation.isPending}
              data-testid="button-submit-quick-expense"
            >
              {createExpenseMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Expense"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
