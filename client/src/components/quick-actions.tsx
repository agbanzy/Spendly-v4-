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
  Wallet,
  Loader2,
  FileBarChart
} from "lucide-react";

export function QuickActions() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<"expense" | "funding" | null>(null);
  
  const [expenseForm, setExpenseForm] = useState({
    merchant: "",
    amount: "",
    category: "",
    note: ""
  });

  const [fundingForm, setFundingForm] = useState({
    amount: "",
    source: "bank",
    note: ""
  });

  const createExpenseMutation = useMutation({
    mutationFn: async (data: typeof expenseForm) => {
      return apiRequest("POST", "/api/expenses", {
        merchant: data.merchant,
        amount: parseFloat(data.amount),
        category: data.category,
        note: data.note,
        status: "pending",
        date: new Date().toISOString().split('T')[0]
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

  const fundWalletMutation = useMutation({
    mutationFn: async (data: typeof fundingForm) => {
      return apiRequest("POST", "/api/balances/fund", {
        amount: parseFloat(data.amount),
        source: data.source,
        note: data.note
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/balances"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      toast({
        title: "Wallet funded",
        description: `Successfully added $${fundingForm.amount} to your wallet.`
      });
      setActiveModal(null);
      setIsOpen(false);
      setFundingForm({ amount: "", source: "bank", note: "" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to fund wallet. Please try again.",
        variant: "destructive"
      });
    }
  });

  const actions = [
    {
      label: "Fund Wallet",
      icon: Wallet,
      onClick: () => setActiveModal("funding"),
      color: "bg-emerald-500 hover:bg-emerald-600"
    },
    {
      label: "New Expense",
      icon: Receipt,
      onClick: () => setActiveModal("expense"),
      color: "bg-blue-500 hover:bg-blue-600"
    },
    {
      label: "Pay Bills",
      icon: FileBarChart,
      onClick: () => {
        setLocation("/bills");
        setIsOpen(false);
      },
      color: "bg-purple-500 hover:bg-purple-600"
    }
  ];

  const handleSubmitExpense = () => {
    if (!expenseForm.merchant || !expenseForm.amount || !expenseForm.category) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }
    createExpenseMutation.mutate(expenseForm);
  };

  const handleSubmitFunding = () => {
    if (!fundingForm.amount) {
      toast({
        title: "Missing amount",
        description: "Please enter an amount to fund.",
        variant: "destructive"
      });
      return;
    }
    fundWalletMutation.mutate(fundingForm);
  };

  return (
    <>
      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-[60]">
        {/* Action buttons - appear when open */}
        <div className={`flex flex-col gap-3 mb-3 transition-all duration-200 ${isOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"}`}>
          {actions.map((action, idx) => (
            <button
              key={idx}
              onClick={(e) => {
                e.stopPropagation();
                action.onClick();
              }}
              className={`flex items-center gap-3 justify-end z-[70]`}
              data-testid={`quick-action-${action.label.toLowerCase().replace(/\s/g, "-")}`}
            >
              <span className="bg-background border px-3 py-1.5 rounded-lg shadow-md text-sm font-medium">
                {action.label}
              </span>
              <div className={`w-12 h-12 rounded-full ${action.color} text-white flex items-center justify-center shadow-lg transition-transform hover:scale-110`}>
                <action.icon className="h-5 w-5" />
              </div>
            </button>
          ))}
        </div>

        {/* Main FAB button */}
        <Button
          onClick={() => setIsOpen(!isOpen)}
          className={`w-14 h-14 rounded-full shadow-xl transition-all duration-200 ${
            isOpen 
              ? "bg-gray-600 hover:bg-gray-700 rotate-45" 
              : "bg-indigo-600 hover:bg-indigo-700"
          }`}
          data-testid="button-quick-actions"
        >
          {isOpen ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
        </Button>
      </div>

      {/* Backdrop overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/30 z-50" 
          onClick={() => setIsOpen(false)} 
        />
      )}

      {/* Expense Dialog */}
      <Dialog open={activeModal === "expense"} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Expense</DialogTitle>
            <DialogDescription>Submit a new expense for approval.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="merchant">Merchant</Label>
              <Input
                id="merchant"
                placeholder="Where did you spend?"
                value={expenseForm.merchant}
                onChange={(e) => setExpenseForm({ ...expenseForm, merchant: e.target.value })}
                data-testid="input-expense-merchant"
              />
            </div>
            <div>
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                placeholder="0.00"
                value={expenseForm.amount}
                onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                data-testid="input-expense-amount"
              />
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <Select value={expenseForm.category} onValueChange={(value) => setExpenseForm({ ...expenseForm, category: value })}>
                <SelectTrigger data-testid="select-expense-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Software">Software</SelectItem>
                  <SelectItem value="Travel">Travel</SelectItem>
                  <SelectItem value="Office">Office</SelectItem>
                  <SelectItem value="Marketing">Marketing</SelectItem>
                  <SelectItem value="Food">Food</SelectItem>
                  <SelectItem value="Equipment">Equipment</SelectItem>
                  <SelectItem value="Utilities">Utilities</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="note">Note (Optional)</Label>
              <Textarea
                id="note"
                placeholder="Add any additional details..."
                value={expenseForm.note}
                onChange={(e) => setExpenseForm({ ...expenseForm, note: e.target.value })}
                data-testid="input-expense-note"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveModal(null)} data-testid="button-cancel-expense">
              Cancel
            </Button>
            <Button onClick={handleSubmitExpense} disabled={createExpenseMutation.isPending} data-testid="button-submit-expense">
              {createExpenseMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Submit Expense
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Funding Dialog */}
      <Dialog open={activeModal === "funding"} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fund Wallet</DialogTitle>
            <DialogDescription>Add money to your wallet.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="fundAmount">Amount</Label>
              <Input
                id="fundAmount"
                type="number"
                placeholder="0.00"
                value={fundingForm.amount}
                onChange={(e) => setFundingForm({ ...fundingForm, amount: e.target.value })}
                data-testid="input-funding-amount"
              />
            </div>
            <div>
              <Label htmlFor="source">Funding Source</Label>
              <Select value={fundingForm.source} onValueChange={(value) => setFundingForm({ ...fundingForm, source: value })}>
                <SelectTrigger data-testid="select-funding-source">
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank">Bank Transfer</SelectItem>
                  <SelectItem value="card">Debit Card</SelectItem>
                  <SelectItem value="ussd">USSD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="fundNote">Note (Optional)</Label>
              <Textarea
                id="fundNote"
                placeholder="Add a note..."
                value={fundingForm.note}
                onChange={(e) => setFundingForm({ ...fundingForm, note: e.target.value })}
                data-testid="input-funding-note"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveModal(null)} data-testid="button-cancel-funding">
              Cancel
            </Button>
            <Button onClick={handleSubmitFunding} disabled={fundWalletMutation.isPending} data-testid="button-submit-funding">
              {fundWalletMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Fund Wallet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
