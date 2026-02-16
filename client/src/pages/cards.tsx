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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Wifi,
} from "lucide-react";
import type { VirtualCard, CompanySettings } from "@shared/schema";

const cardGradients: Record<string, string> = {
  indigo: "bg-gradient-to-br from-violet-500 via-violet-600 to-indigo-700",
  emerald: "bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700",
  rose: "bg-gradient-to-br from-rose-500 via-rose-600 to-pink-700",
  amber: "bg-gradient-to-br from-amber-500 via-amber-600 to-orange-700",
  slate: "bg-gradient-to-br from-slate-700 via-slate-800 to-zinc-900",
  cyan: "bg-gradient-to-br from-cyan-500 via-cyan-600 to-blue-700",
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
      updateMutation.mutate({ id: editingCard.id, data: { name: formData.name, limit: formData.limit, type: formData.type as 'Visa' | 'Mastercard', color: formData.color, currency: formData.currency } });
    } else {
      createMutation.mutate(formData);
    }
  };

  const toggleShowNumber = (cardId: string) => {
    setShowNumbers((prev) => ({ ...prev, [cardId]: !prev[cardId] }));
  };

  const totalBalance = cards?.reduce((sum, c) => sum + parseFloat(String(c.balance) || '0'), 0) || 0;
  const activeCards = cards?.filter((c) => c.status === "Active").length || 0;

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
      transition: {
        duration: 0.5,
        ease: "easeOut",
      },
    },
  };

  return (
    <PageWrapper>
      <PageHeader
        title="Virtual Cards"
        subtitle="Manage your corporate virtual cards with advanced controls"
        actions={
          <Button
            onClick={() => {
              resetForm();
              setEditingCard(null);
              setIsOpen(true);
            }}
            className="gap-2"
            data-testid="button-issue-card"
          >
            <Plus className="h-4 w-4" />
            Issue New Card
          </Button>
        }
      />

      <motion.div
        className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={itemVariants}>
          <MetricCard
            title="Total Balance"
            value={isLoading ? <Skeleton className="h-8 w-32" /> : formatCurrency(totalBalance)}
            subtitle="Across all cards"
            icon={CreditCard}
            color="violet"
            trend="neutral"
            trendLabel=""
            data-testid="text-total-card-balance"
          />
        </motion.div>

        <motion.div variants={itemVariants}>
          <MetricCard
            title="Active Cards"
            value={isLoading ? <Skeleton className="h-8 w-16" /> : activeCards}
            subtitle="Ready to use"
            icon={CreditCard}
            color="emerald"
            trend="neutral"
            trendLabel=""
          />
        </motion.div>

        <motion.div variants={itemVariants}>
          <MetricCard
            title="Total Cards"
            value={isLoading ? <Skeleton className="h-8 w-16" /> : cards?.length || 0}
            subtitle="Virtual cards issued"
            icon={CreditCard}
            color="cyan"
            trend="neutral"
            trendLabel=""
          />
        </motion.div>
      </motion.div>

      <div className="space-y-6">
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Your Cards
          </h2>

          {isLoading ? (
            <motion.div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              {[1, 2, 3].map((i) => (
                <motion.div key={i} variants={itemVariants}>
                  <Skeleton className="h-56 rounded-2xl" />
                </motion.div>
              ))}
            </motion.div>
          ) : cards && cards.length > 0 ? (
            <motion.div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              {cards.map((card) => (
                <motion.div
                  key={card.id}
                  variants={itemVariants}
                  data-testid={`card-${card.id}`}
                >
                  <motion.div
                    className={`relative rounded-2xl overflow-hidden shadow-2xl group cursor-pointer`}
                    whileHover={{ y: -4, rotateY: -3 }}
                    style={{
                      transformStyle: "preserve-3d",
                      perspective: 1000,
                    }}
                  >
                    <div
                      className={`relative h-56 p-6 text-white ${
                        cardGradients[card.color] || cardGradients.slate
                      } overflow-hidden`}
                    >
                      <div className="absolute inset-0 opacity-20">
                        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-white/10 blur-3xl" />
                        <div className="absolute -bottom-20 -left-20 w-60 h-60 rounded-full bg-white/10 blur-3xl" />
                      </div>

                      {card.status === "Frozen" && (
                        <div className="absolute inset-0 bg-white/15 backdrop-blur-sm z-20" />
                      )}

                      <div className="relative z-10 h-full flex flex-col justify-between">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-xs font-semibold opacity-75 uppercase tracking-widest mb-2">
                              {card.name}
                            </p>
                            {card.status === "Active" && (
                              <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
                                <span className="text-xs font-medium text-emerald-200">Active</span>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-white hover:bg-white/20"
                              onClick={() => toggleShowNumber(card.id)}
                            >
                              {showNumbers[card.id] ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-white hover:bg-white/20"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="rounded-xl">
                                <DropdownMenuItem onClick={() => openFundDialog(card)}>
                                  <Plus className="h-4 w-4 mr-2" />
                                  Fund Card
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openEditDialog(card)}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    toggleStatusMutation.mutate({
                                      id: card.id,
                                      status:
                                        card.status === "Active"
                                          ? "Frozen"
                                          : "Active",
                                    })
                                  }
                                >
                                  {card.status === "Active" ? (
                                    <>
                                      <PauseCircle className="h-4 w-4 mr-2" />
                                      Freeze Card
                                    </>
                                  ) : (
                                    <>
                                      <PlayCircle className="h-4 w-4 mr-2" />
                                      Activate Card
                                    </>
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-red-500"
                                  onClick={() => deleteMutation.mutate(card.id)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <div className="w-8 h-6 rounded bg-white/20 backdrop-blur flex items-center justify-center">
                                <Wifi className="h-3 w-3 text-white rotate-90" />
                              </div>
                              <span className="text-xs opacity-60">
                                {card.type}
                              </span>
                            </div>
                            <p className="text-lg font-mono tracking-[0.15em] font-semibold">
                              {showNumbers[card.id]
                                ? `4532 •••• •••• ${card.last4}`
                                : `•••• •••• •••• ${card.last4}`}
                            </p>
                          </div>

                          <div className="flex items-end justify-between pt-2">
                            <div>
                              <p className="text-xs opacity-60 uppercase tracking-wider">
                                Balance
                              </p>
                              <p className="text-lg font-bold">
                                {formatCurrency(
                                  card.balance,
                                  card.currency
                                )}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs opacity-60 uppercase tracking-wider">
                                Limit
                              </p>
                              <p className="text-sm font-semibold">
                                {formatCurrency(
                                  card.limit,
                                  card.currency
                                )}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <EmptyState
                icon={CreditCard}
                title="No cards yet"
                description="Issue your first virtual card to get started"
                action={
                  <Button
                    onClick={() => setIsOpen(true)}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Issue New Card
                  </Button>
                }
              />
            </motion.div>
          )}
        </div>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingCard ? "Edit Card" : "Issue New Card"}
            </DialogTitle>
            <DialogDescription>
              {editingCard
                ? "Update the card details"
                : "Create a new virtual card for your team"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium">
                Card Name
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Marketing Team"
                className="bg-muted/30 border-border/50 rounded-xl h-11"
                data-testid="input-card-name"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="currency" className="text-sm font-medium">
                  Currency
                </Label>
                <Select
                  value={formData.currency}
                  onValueChange={(value) =>
                    setFormData({ ...formData, currency: value })
                  }
                >
                  <SelectTrigger
                    className="bg-muted/30 border-border/50 rounded-xl h-11"
                    data-testid="select-card-currency"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
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
                <Label htmlFor="limit" className="text-sm font-medium">
                  Spending Limit
                </Label>
                <Input
                  id="limit"
                  type="number"
                  value={formData.limit}
                  onChange={(e) =>
                    setFormData({ ...formData, limit: e.target.value })
                  }
                  placeholder="0.00"
                  className="bg-muted/30 border-border/50 rounded-xl h-11"
                  data-testid="input-card-limit"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type" className="text-sm font-medium">
                  Card Type
                </Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) =>
                    setFormData({ ...formData, type: value })
                  }
                >
                  <SelectTrigger
                    className="bg-muted/30 border-border/50 rounded-xl h-11"
                    data-testid="select-card-type"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="Visa">Visa</SelectItem>
                    <SelectItem value="Mastercard">Mastercard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="color" className="text-sm font-medium">
                  Card Color
                </Label>
                <div className="flex gap-2 pt-1">
                  {[
                    "indigo",
                    "emerald",
                    "rose",
                    "amber",
                    "slate",
                    "cyan",
                  ].map((color) => (
                    <button
                      key={color}
                      onClick={() =>
                        setFormData({ ...formData, color })
                      }
                      className={`w-8 h-8 rounded-full transition-all duration-200 ${
                        cardGradients[color]
                      } ${
                        formData.color === color
                          ? "ring-2 ring-offset-2 ring-offset-background ring-primary scale-110"
                          : "ring-1 ring-border/50 hover:scale-105"
                      }`}
                      title={color}
                      data-testid={`color-${color}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                createMutation.isPending || updateMutation.isPending
              }
              className="gap-2 rounded-xl"
              data-testid="button-submit-card"
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {editingCard ? "Update Card" : "Issue Card"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isFundOpen} onOpenChange={setIsFundOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Fund Card</DialogTitle>
            <DialogDescription>
              {fundingCard &&
                `Add funds to ${fundingCard.name} (****${fundingCard.last4})`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-4">
            {fundingCard && (
              <>
                <div className="p-4 rounded-xl bg-muted/40 border border-border/50 backdrop-blur-sm">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm font-medium text-muted-foreground">
                      Current Balance
                    </span>
                    <span className="font-semibold">
                      {formatCurrency(
                        fundingCard.balance,
                        fundingCard.currency
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-3 border-t border-border/30">
                    <span className="text-sm font-medium text-muted-foreground">
                      Card Currency
                    </span>
                    <span className="font-medium">{fundingCard.currency}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fundAmount" className="text-sm font-medium">
                    Amount to Add
                  </Label>
                  <Input
                    id="fundAmount"
                    type="number"
                    value={fundAmount}
                    onChange={(e) => setFundAmount(e.target.value)}
                    placeholder="Enter amount"
                    className="bg-muted/30 border-border/50 rounded-xl h-11"
                    data-testid="input-fund-amount"
                  />
                  <p className="text-xs text-muted-foreground">
                    Funds will be deducted from your {fundingCard.currency}{" "}
                    wallet.
                  </p>
                </div>
              </>
            )}
          </div>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setIsFundOpen(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleFundCard}
              disabled={fundCardMutation.isPending || !fundAmount}
              className="gap-2 rounded-xl"
              data-testid="button-confirm-fund"
            >
              {fundCardMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Fund Card
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageWrapper>
  );
}
