import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  CreditCard,
  MoreVertical,
  Snowflake,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  Loader2,
  PlayCircle,
  PauseCircle,
} from "lucide-react";
import type { VirtualCard, CompanySettings } from "@shared/schema";

const cardGradients: Record<string, string> = {
  indigo: "bg-gradient-to-br from-indigo-500 to-purple-600",
  emerald: "bg-gradient-to-br from-emerald-500 to-teal-600",
  rose: "bg-gradient-to-br from-rose-500 to-pink-600",
  amber: "bg-gradient-to-br from-amber-500 to-orange-600",
  slate: "bg-gradient-to-br from-slate-700 to-slate-900",
};

export default function Cards() {
  const { toast } = useToast();
  const [showNumbers, setShowNumbers] = useState<Record<string, boolean>>({});
  const [isOpen, setIsOpen] = useState(false);
  const [isFundOpen, setIsFundOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<VirtualCard | null>(null);
  const [fundingCard, setFundingCard] = useState<VirtualCard | null>(null);
  const [fundAmount, setFundAmount] = useState("");

  const { data: settings } = useQuery<CompanySettings>({
    queryKey: ["/api/settings"],
  });

  // Currency formatting
  const currencySymbols: Record<string, string> = {
    USD: "$", EUR: "€", GBP: "£", NGN: "₦", KES: "KSh", GHS: "₵", ZAR: "R"
  };
  const currency = settings?.currency || "USD";
  const currencySymbol = currencySymbols[currency] || "$";
  
  const formatCurrency = (amount: number | string, cardCurrency?: string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) || 0 : amount;
    const symbol = cardCurrency ? (currencySymbols[cardCurrency] || '$') : currencySymbol;
    return `${symbol}${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
  const [formData, setFormData] = useState({
    name: "",
    limit: "",
    type: "Visa",
    color: "indigo",
    currency: currency,
  });
  
  const { data: cards, isLoading } = useQuery<VirtualCard[]>({
    queryKey: ["/api/cards"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("POST", "/api/cards", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cards"] });
      toast({ title: "Card issued successfully" });
      setIsOpen(false);
      resetForm();
    },
    onError: () => {
      toast({ title: "Failed to issue card", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<VirtualCard> }) => {
      return apiRequest("PATCH", `/api/cards/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cards"] });
      toast({ title: "Card updated successfully" });
      setIsOpen(false);
      setEditingCard(null);
      resetForm();
    },
    onError: () => {
      toast({ title: "Failed to update card", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/cards/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cards"] });
      toast({ title: "Card deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete card", variant: "destructive" });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return apiRequest("PATCH", `/api/cards/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cards"] });
      toast({ title: "Card status updated" });
    },
    onError: () => {
      toast({ title: "Failed to update card status", variant: "destructive" });
    },
  });

  const fundCardMutation = useMutation({
    mutationFn: async ({ id, amount }: { id: string; amount: number }) => {
      const res = await apiRequest("POST", `/api/cards/${id}/fund`, { amount });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/cards"] });
      toast({ title: data.message || "Card funded successfully" });
      setIsFundOpen(false);
      setFundingCard(null);
      setFundAmount("");
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to fund card", variant: "destructive" });
    },
  });

  const openFundDialog = (card: VirtualCard) => {
    setFundingCard(card);
    setFundAmount("");
    setIsFundOpen(true);
  };

  const handleFundCard = () => {
    if (!fundingCard || !fundAmount) return;
    const amount = parseFloat(fundAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Please enter a valid amount", variant: "destructive" });
      return;
    }
    fundCardMutation.mutate({ id: fundingCard.id, amount });
  };

  const resetForm = () => {
    setFormData({ name: "", limit: "", type: "Visa", color: "indigo", currency: currency });
  };

  const openEditDialog = (card: VirtualCard) => {
    setEditingCard(card);
    setFormData({
      name: card.name,
      limit: String(card.limit),
      type: card.type,
      color: card.color,
      currency: card.currency || currency,
    });
    setIsOpen(true);
  };

  const handleSubmit = () => {
    if (editingCard) {
      updateMutation.mutate({ id: editingCard.id, data: { name: formData.name, limit: parseFloat(formData.limit), type: formData.type as 'Visa' | 'Mastercard', color: formData.color, currency: formData.currency } });
    } else {
      createMutation.mutate(formData);
    }
  };

  const toggleShowNumber = (cardId: string) => {
    setShowNumbers((prev) => ({ ...prev, [cardId]: !prev[cardId] }));
  };

  const totalBalance = cards?.reduce((sum, c) => sum + parseFloat(String(c.balance) || '0'), 0) || 0;
  const activeCards = cards?.filter((c) => c.status === "Active").length || 0;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 texture-mesh min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight" data-testid="text-cards-title">Virtual Cards</h1>
          <p className="text-muted-foreground mt-1">Manage your corporate virtual cards.</p>
        </div>
        <Button onClick={() => { resetForm(); setEditingCard(null); setIsOpen(true); }} data-testid="button-issue-card">
          <Plus className="h-4 w-4 mr-2" />Issue New Card
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass card-hover">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Total Balance</p>
              <div className="p-2 bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl">
                <CreditCard className="h-4 w-4 text-primary" />
              </div>
            </div>
            {isLoading ? <Skeleton className="h-8 w-32" /> : <p className="text-2xl font-black" data-testid="text-total-card-balance">{formatCurrency(totalBalance)}</p>}
            <p className="text-xs text-muted-foreground mt-1">Across all cards</p>
          </CardContent>
        </Card>

        <Card className="glass card-hover">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Active Cards</p>
              <div className="p-2 bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 rounded-xl">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              </div>
            </div>
            {isLoading ? <Skeleton className="h-8 w-16" /> : <p className="text-2xl font-black text-emerald-600">{activeCards}</p>}
            <p className="text-xs text-muted-foreground mt-1">Ready to use</p>
          </CardContent>
        </Card>

        <Card className="glass card-hover">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Total Cards</p>
              <div className="p-2 bg-gradient-to-br from-slate-500/20 to-slate-500/5 rounded-xl">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            {isLoading ? <Skeleton className="h-8 w-16" /> : <p className="text-2xl font-black">{cards?.length || 0}</p>}
            <p className="text-xs text-muted-foreground mt-1">Virtual cards issued</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Your Cards</h3>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-52 rounded-2xl" />)}
          </div>
        ) : cards && cards.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cards.map((card) => (
              <div key={card.id} className={`relative rounded-2xl p-6 text-white ${cardGradients[card.color] || cardGradients.slate} shadow-xl overflow-hidden`} data-testid={`card-${card.id}`}>
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute top-10 -right-10 w-40 h-40 border-8 border-white rounded-full" />
                  <div className="absolute -bottom-10 -left-10 w-32 h-32 border-8 border-white rounded-full" />
                </div>

                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-8">
                    <div>
                      <p className="text-xs font-bold opacity-80 uppercase tracking-widest">{card.name}</p>
                      {card.status === "Frozen" && (
                        <Badge className="mt-2 bg-white/20 text-white border-0"><Snowflake className="h-3 w-3 mr-1" />Frozen</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/10" onClick={() => toggleShowNumber(card.id)}>
                        {showNumbers[card.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/10"><MoreVertical className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openFundDialog(card)}><Plus className="h-4 w-4 mr-2" />Fund Card</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEditDialog(card)}><Pencil className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleStatusMutation.mutate({ id: card.id, status: card.status === "Active" ? "Frozen" : "Active" })}>
                            {card.status === "Active" ? <><PauseCircle className="h-4 w-4 mr-2" />Freeze Card</> : <><PlayCircle className="h-4 w-4 mr-2" />Activate Card</>}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-600" onClick={() => deleteMutation.mutate(card.id)}><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <div className="mb-6">
                    <p className="text-xl font-mono tracking-wider">
                      {showNumbers[card.id] ? `4532 •••• •••• ${card.last4}` : `•••• •••• •••• ${card.last4}`}
                    </p>
                  </div>

                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-xs opacity-60 uppercase">Balance</p>
                      <p className="text-xl font-bold">{formatCurrency(card.balance, card.currency)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs opacity-60 uppercase">Limit</p>
                      <p className="text-sm font-bold">{formatCurrency(card.limit, card.currency)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-lg font-bold uppercase">{card.type}</p>
                      <span className="text-xs opacity-60">{card.currency}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <CreditCard className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-bold mb-1">No cards yet</h3>
              <p className="text-sm text-muted-foreground mb-4">Issue your first virtual card to get started.</p>
              <Button onClick={() => setIsOpen(true)}><Plus className="h-4 w-4 mr-2" />Issue New Card</Button>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCard ? "Edit Card" : "Issue New Card"}</DialogTitle>
            <DialogDescription>{editingCard ? "Update the card details." : "Create a new virtual card for your team."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Card Name</Label>
              <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g., Marketing Team" data-testid="input-card-name" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Select value={formData.currency} onValueChange={(value) => setFormData({ ...formData, currency: value })}>
                  <SelectTrigger data-testid="select-card-currency"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                    <SelectItem value="GBP">GBP (£)</SelectItem>
                    <SelectItem value="NGN">NGN (₦)</SelectItem>
                    <SelectItem value="KES">KES (KSh)</SelectItem>
                    <SelectItem value="GHS">GHS (₵)</SelectItem>
                    <SelectItem value="ZAR">ZAR (R)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="limit">Spending Limit ({currencySymbols[formData.currency] || '$'})</Label>
                <Input id="limit" type="number" value={formData.limit} onChange={(e) => setFormData({ ...formData, limit: e.target.value })} placeholder="0.00" data-testid="input-card-limit" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Card Type</Label>
                <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                  <SelectTrigger data-testid="select-card-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Visa">Visa</SelectItem>
                    <SelectItem value="Mastercard">Mastercard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="color">Card Color</Label>
                <Select value={formData.color} onValueChange={(value) => setFormData({ ...formData, color: value })}>
                  <SelectTrigger data-testid="select-card-color"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="indigo">Indigo</SelectItem>
                    <SelectItem value="emerald">Emerald</SelectItem>
                    <SelectItem value="rose">Rose</SelectItem>
                    <SelectItem value="amber">Amber</SelectItem>
                    <SelectItem value="slate">Slate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-card">
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingCard ? "Update Card" : "Issue Card"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isFundOpen} onOpenChange={setIsFundOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fund Card</DialogTitle>
            <DialogDescription>
              {fundingCard && `Add funds to ${fundingCard.name} (****${fundingCard.last4})`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {fundingCard && (
              <>
                <div className="p-4 rounded-lg bg-muted">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Current Balance</span>
                    <span className="font-bold">{formatCurrency(fundingCard.balance, fundingCard.currency)}</span>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-sm text-muted-foreground">Card Currency</span>
                    <span className="font-medium">{fundingCard.currency}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fundAmount">Amount ({currencySymbols[fundingCard.currency] || fundingCard.currency})</Label>
                  <Input
                    id="fundAmount"
                    type="number"
                    value={fundAmount}
                    onChange={(e) => setFundAmount(e.target.value)}
                    placeholder="Enter amount to fund"
                    data-testid="input-fund-amount"
                  />
                  <p className="text-xs text-muted-foreground">
                    Funds will be deducted from your {fundingCard.currency} wallet.
                  </p>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFundOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleFundCard} 
              disabled={fundCardMutation.isPending || !fundAmount}
              data-testid="button-confirm-fund"
            >
              {fundCardMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Fund Card
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
