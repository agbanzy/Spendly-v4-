import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  Loader2,
  Users,
  TrendingUp,
  FileBarChart,
  Zap
} from "lucide-react";

interface QuickActionsProps {
  isOpen?: boolean;
}

export function QuickActions({ isOpen: controlledOpen }: QuickActionsProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<"expense" | "payout" | "funding" | "card" | "invoice" | null>(null);
  
  const [expenseForm, setExpenseForm] = useState({
    merchant: "",
    amount: "",
    category: "",
    note: ""
  });

  const [payoutForm, setPayoutForm] = useState({
    recipient: "",
    amount: "",
    description: "",
    method: "bank"
  });

  const [fundingForm, setFundingForm] = useState({
    amount: "",
    source: "bank",
    note: ""
  });

  const [cardForm, setCardForm] = useState({
    name: "",
    type: "virtual",
    limit: ""
  });

  const [invoiceForm, setInvoiceForm] = useState({
    clientName: "",
    amount: "",
    description: "",
    dueDate: ""
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

  const sendPayoutMutation = useMutation({
    mutationFn: async (data: typeof payoutForm) => {
      return apiRequest("POST", "/api/balances/send", {
        amount: parseFloat(data.amount),
        recipient: data.recipient,
        description: data.description
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/balances"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      toast({
        title: "Payout sent",
        description: `Successfully sent $${payoutForm.amount} to ${payoutForm.recipient}.`
      });
      setActiveModal(null);
      setIsOpen(false);
      setPayoutForm({ recipient: "", amount: "", description: "", method: "bank" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to send payout. Please try again.",
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

  const createCardMutation = useMutation({
    mutationFn: async (data: typeof cardForm) => {
      const cardNumber = `**** **** **** ${Math.floor(1000 + Math.random() * 9000)}`;
      return apiRequest("POST", "/api/cards", {
        name: data.name,
        type: data.type,
        limit: parseFloat(data.limit),
        balance: 0,
        cardNumber,
        expiryDate: "12/28",
        status: "active"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cards"] });
      toast({
        title: "Card created",
        description: `Successfully created ${cardForm.name} virtual card.`
      });
      setActiveModal(null);
      setIsOpen(false);
      setCardForm({ name: "", type: "virtual", limit: "" });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create card. Please try again.",
        variant: "destructive"
      });
    }
  });

  const createInvoiceMutation = useMutation({
    mutationFn: async (data: typeof invoiceForm) => {
      return apiRequest("POST", "/api/invoices", {
        clientName: data.clientName,
        amount: parseFloat(data.amount),
        description: data.description,
        dueDate: data.dueDate,
        status: "pending",
        invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
        items: []
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({
        title: "Invoice created",
        description: `Invoice for ${invoiceForm.clientName} has been created.`
      });
      setActiveModal(null);
      setIsOpen(false);
      setInvoiceForm({ clientName: "", amount: "", description: "", dueDate: "" });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create invoice. Please try again.",
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
      onClick: () => setActiveModal("payout"),
      color: "from-indigo-500 to-purple-600",
      description: "Transfer to bank account"
    },
    {
      label: "Fund Wallet",
      icon: Wallet,
      onClick: () => setActiveModal("funding"),
      color: "from-slate-700 to-slate-900",
      description: "Add money to wallet"
    },
    {
      label: "Virtual Card",
      icon: CreditCard,
      onClick: () => setActiveModal("card"),
      color: "from-amber-500 to-orange-600",
      description: "Create new card"
    },
    {
      label: "New Invoice",
      icon: FileText,
      onClick: () => setActiveModal("invoice"),
      color: "from-rose-500 to-pink-600",
      description: "Create client invoice"
    },
    {
      label: "Pay Bills",
      icon: FileBarChart,
      onClick: () => {
        setLocation("/bills");
        setIsOpen(false);
      },
      color: "from-cyan-500 to-blue-600",
      description: "Manage bill payments"
    },
    {
      label: "Vendors",
      icon: Building2,
      onClick: () => {
        setLocation("/vendors");
        setIsOpen(false);
      },
      color: "from-violet-500 to-purple-600",
      description: "Manage vendors"
    },
    {
      label: "Team",
      icon: Users,
      onClick: () => {
        setLocation("/team");
        setIsOpen(false);
      },
      color: "from-blue-500 to-indigo-600",
      description: "Manage team members"
    },
    {
      label: "Analytics",
      icon: TrendingUp,
      onClick: () => {
        setLocation("/analytics");
        setIsOpen(false);
      },
      color: "from-green-500 to-emerald-600",
      description: "View spending analytics"
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

  const handleSubmitPayout = () => {
    if (!payoutForm.recipient || !payoutForm.amount) {
      toast({
        title: "Error",
        description: "Please fill in recipient and amount.",
        variant: "destructive"
      });
      return;
    }
    sendPayoutMutation.mutate(payoutForm);
  };

  const handleSubmitFunding = () => {
    if (!fundingForm.amount) {
      toast({
        title: "Error",
        description: "Please enter an amount.",
        variant: "destructive"
      });
      return;
    }
    fundWalletMutation.mutate(fundingForm);
  };

  const handleSubmitCard = () => {
    if (!cardForm.name || !cardForm.limit) {
      toast({
        title: "Error",
        description: "Please fill in card name and spending limit.",
        variant: "destructive"
      });
      return;
    }
    createCardMutation.mutate(cardForm);
  };

  const handleSubmitInvoice = () => {
    if (!invoiceForm.clientName || !invoiceForm.amount || !invoiceForm.dueDate) {
      toast({
        title: "Error",
        description: "Please fill in client name, amount, and due date.",
        variant: "destructive"
      });
      return;
    }
    createInvoiceMutation.mutate(invoiceForm);
  };

  return (
    <>
      <div className={`fixed bottom-6 right-6 z-50 transition-all duration-300`}>
        <div className={`flex flex-col-reverse gap-3 transition-all duration-300 ${isOpen ? "mb-4 opacity-100 translate-y-0" : "mb-0 opacity-0 translate-y-10 pointer-events-none"}`}>
          {actions.map((action, idx) => (
            <button
              key={idx}
              onClick={action.onClick}
              className="flex items-center gap-3 group animate-slide-up justify-end"
              style={{ animationDelay: `${idx * 40}ms` }}
              data-testid={`quick-action-${action.label.toLowerCase().replace(/\s/g, "-")}`}
            >
              <div className="bg-background border px-4 py-2 rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-4 group-hover:translate-x-0 min-w-[160px] text-right">
                <p className="text-xs font-bold uppercase tracking-wider">{action.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>
              </div>
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${action.color} text-white flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
                <action.icon className="h-5 w-5" />
              </div>
            </button>
          ))}
        </div>

        <Button
          onClick={() => setIsOpen(!isOpen)}
          size="lg"
          className={`w-16 h-16 rounded-2xl shadow-2xl transition-all duration-300 relative overflow-visible ${
            isOpen 
              ? "rotate-45 bg-slate-700 hover:bg-slate-800" 
              : "bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700 hover:from-indigo-500 hover:via-indigo-600 hover:to-purple-600"
          }`}
          data-testid="button-quick-actions"
        >
          {!isOpen && (
            <span className="absolute inset-0 rounded-2xl animate-ping bg-indigo-500 opacity-20"></span>
          )}
          <span className="relative z-10 flex items-center justify-center">
            {isOpen ? <X className="h-7 w-7" /> : <Zap className="h-7 w-7" />}
          </span>
        </Button>
        
        {!isOpen && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-background animate-pulse" />
        )}
      </div>

      <div className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`} onClick={() => setIsOpen(false)} />

      <Dialog open={activeModal === "expense"} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <Receipt className="h-5 w-5 text-white" />
              </div>
              Add New Expense
            </DialogTitle>
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

      <Dialog open={activeModal === "payout"} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <Send className="h-5 w-5 text-white" />
              </div>
              Send Payout
            </DialogTitle>
            <DialogDescription>
              Transfer money to a recipient.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Recipient</Label>
              <Input
                placeholder="Enter recipient name or email"
                value={payoutForm.recipient}
                onChange={(e) => setPayoutForm(prev => ({ ...prev, recipient: e.target.value }))}
                data-testid="input-payout-recipient"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount (USD)</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={payoutForm.amount}
                  onChange={(e) => setPayoutForm(prev => ({ ...prev, amount: e.target.value }))}
                  data-testid="input-payout-amount"
                />
              </div>
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select
                  value={payoutForm.method}
                  onValueChange={(value) => setPayoutForm(prev => ({ ...prev, method: value }))}
                >
                  <SelectTrigger data-testid="select-payout-method">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank">Bank Transfer</SelectItem>
                    <SelectItem value="wallet">Wallet</SelectItem>
                    <SelectItem value="crypto">Crypto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description (Optional)</Label>
              <Textarea
                placeholder="Add a note for this transfer..."
                value={payoutForm.description}
                onChange={(e) => setPayoutForm(prev => ({ ...prev, description: e.target.value }))}
                data-testid="input-payout-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveModal(null)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmitPayout} 
              disabled={sendPayoutMutation.isPending}
              data-testid="button-submit-payout"
            >
              {sendPayoutMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Payout"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={activeModal === "funding"} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center">
                <Wallet className="h-5 w-5 text-white" />
              </div>
              Fund Wallet
            </DialogTitle>
            <DialogDescription>
              Add money to your company wallet.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount (USD)</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={fundingForm.amount}
                  onChange={(e) => setFundingForm(prev => ({ ...prev, amount: e.target.value }))}
                  data-testid="input-funding-amount"
                />
              </div>
              <div className="space-y-2">
                <Label>Source</Label>
                <Select
                  value={fundingForm.source}
                  onValueChange={(value) => setFundingForm(prev => ({ ...prev, source: value }))}
                >
                  <SelectTrigger data-testid="select-funding-source">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank">Bank Account</SelectItem>
                    <SelectItem value="card">Debit Card</SelectItem>
                    <SelectItem value="crypto">Crypto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Note (Optional)</Label>
              <Input
                placeholder="Add a note..."
                value={fundingForm.note}
                onChange={(e) => setFundingForm(prev => ({ ...prev, note: e.target.value }))}
                data-testid="input-funding-note"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveModal(null)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmitFunding} 
              disabled={fundWalletMutation.isPending}
              data-testid="button-submit-funding"
            >
              {fundWalletMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Funding...
                </>
              ) : (
                "Fund Wallet"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={activeModal === "card"} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-white" />
              </div>
              Create Virtual Card
            </DialogTitle>
            <DialogDescription>
              Create a new virtual card for online purchases.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Card Name</Label>
              <Input
                placeholder="e.g., Marketing, Software, Travel"
                value={cardForm.name}
                onChange={(e) => setCardForm(prev => ({ ...prev, name: e.target.value }))}
                data-testid="input-card-name"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Card Type</Label>
                <Select
                  value={cardForm.type}
                  onValueChange={(value) => setCardForm(prev => ({ ...prev, type: value }))}
                >
                  <SelectTrigger data-testid="select-card-type">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="virtual">Virtual Card</SelectItem>
                    <SelectItem value="physical">Physical Card</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Spending Limit (USD)</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={cardForm.limit}
                  onChange={(e) => setCardForm(prev => ({ ...prev, limit: e.target.value }))}
                  data-testid="input-card-limit"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveModal(null)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmitCard} 
              disabled={createCardMutation.isPending}
              data-testid="button-submit-card"
            >
              {createCardMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Card"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={activeModal === "invoice"} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center">
                <FileText className="h-5 w-5 text-white" />
              </div>
              Create Invoice
            </DialogTitle>
            <DialogDescription>
              Create a new invoice for a client.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Client Name</Label>
              <Input
                placeholder="Enter client or company name"
                value={invoiceForm.clientName}
                onChange={(e) => setInvoiceForm(prev => ({ ...prev, clientName: e.target.value }))}
                data-testid="input-invoice-client"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount (USD)</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={invoiceForm.amount}
                  onChange={(e) => setInvoiceForm(prev => ({ ...prev, amount: e.target.value }))}
                  data-testid="input-invoice-amount"
                />
              </div>
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={invoiceForm.dueDate}
                  onChange={(e) => setInvoiceForm(prev => ({ ...prev, dueDate: e.target.value }))}
                  data-testid="input-invoice-due-date"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Describe the services or products..."
                value={invoiceForm.description}
                onChange={(e) => setInvoiceForm(prev => ({ ...prev, description: e.target.value }))}
                data-testid="input-invoice-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveModal(null)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmitInvoice} 
              disabled={createInvoiceMutation.isPending}
              data-testid="button-submit-invoice"
            >
              {createInvoiceMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Invoice"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
