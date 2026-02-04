import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  ArrowUpDown,
  ArrowLeft,
  Plus,
  RefreshCw,
  DollarSign,
  TrendingUp,
  Settings,
  Globe,
  Percent,
} from "lucide-react";
import { Link } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ExchangeRate } from "@shared/schema";

interface ExchangeRateSettings {
  id: string;
  buyMarkupPercent: string;
  sellMarkupPercent: string;
  lastUpdatedBy?: string;
  updatedAt: string;
}

const CURRENCIES = [
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "GBP", name: "British Pound", symbol: "£" },
  { code: "NGN", name: "Nigerian Naira", symbol: "₦" },
  { code: "GHS", name: "Ghanaian Cedi", symbol: "GH₵" },
  { code: "ZAR", name: "South African Rand", symbol: "R" },
  { code: "KES", name: "Kenyan Shilling", symbol: "KSh" },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$" },
];

export default function AdminExchangeRates() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [newRate, setNewRate] = useState({
    baseCurrency: "USD",
    targetCurrency: "NGN",
    rate: "",
  });
  const [markupSettings, setMarkupSettings] = useState({
    buyMarkupPercent: "10",
    sellMarkupPercent: "10",
  });

  const { data: exchangeRates, isLoading } = useQuery<ExchangeRate[]>({
    queryKey: ["/api/exchange-rates"],
  });

  const { data: settings, isLoading: loadingSettings } = useQuery<ExchangeRateSettings>({
    queryKey: ["/api/exchange-rates/settings"],
  });

  useEffect(() => {
    if (settings) {
      setMarkupSettings({
        buyMarkupPercent: settings.buyMarkupPercent || "10",
        sellMarkupPercent: settings.sellMarkupPercent || "10",
      });
    }
  }, [settings]);

  const createMutation = useMutation({
    mutationFn: async (data: typeof newRate) => {
      return apiRequest("POST", "/api/exchange-rates", data);
    },
    onSuccess: () => {
      toast({
        title: "Rate Created",
        description: "Exchange rate has been added successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/exchange-rates"] });
      setIsDialogOpen(false);
      setNewRate({ baseCurrency: "USD", targetCurrency: "NGN", rate: "" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Create",
        description: error.message || "Failed to create exchange rate",
        variant: "destructive",
      });
    },
  });

  const fetchLiveMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/exchange-rates/fetch-live");
    },
    onSuccess: (data: any) => {
      toast({
        title: "Live Rates Fetched",
        description: data.message || "Exchange rates updated from live market",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/exchange-rates"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Fetch",
        description: error.message || "Failed to fetch live exchange rates",
        variant: "destructive",
      });
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: typeof markupSettings) => {
      return apiRequest("PUT", "/api/exchange-rates/settings", data);
    },
    onSuccess: () => {
      toast({
        title: "Settings Updated",
        description: "Exchange rate markup has been updated",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/exchange-rates/settings"] });
      setIsSettingsOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Update",
        description: error.message || "Failed to update markup settings",
        variant: "destructive",
      });
    },
  });

  const getCurrencySymbol = (code: string) => {
    return CURRENCIES.find((c) => c.code === code)?.symbol || code;
  };

  const calculateCustomerRate = (baseRate: number, type: 'buy' | 'sell') => {
    if (isNaN(baseRate) || baseRate <= 0) return 0;
    
    const markupStr = type === 'buy' 
      ? settings?.buyMarkupPercent 
      : settings?.sellMarkupPercent;
    const markup = parseFloat(markupStr || '10');
    
    if (isNaN(markup) || markup < 0) return baseRate;
    
    if (type === 'buy') {
      return baseRate * (1 + markup / 100);
    } else {
      return baseRate * (1 - markup / 100);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/admin">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-3" data-testid="text-title">
            <ArrowUpDown className="h-7 w-7 text-cyan-600" />
            Exchange Rates
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage live exchange rates and profit margins
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => fetchLiveMutation.mutate()}
            disabled={fetchLiveMutation.isPending}
            className="gap-2"
            data-testid="button-fetch-live"
          >
            {fetchLiveMutation.isPending ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Globe className="h-4 w-4" />
            )}
            Fetch Live Rates
          </Button>
          <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2" data-testid="button-settings">
                <Settings className="h-4 w-4" />
                Markup Settings
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Percent className="h-5 w-5" />
                  Profit Margin Settings
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    These percentages determine the profit margin on currency exchanges. 
                    Customers pay more when buying foreign currency and receive less when selling.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Buy Markup (%)</Label>
                  <Input
                    type="number"
                    step="0.5"
                    min="0"
                    max="50"
                    placeholder="e.g., 10"
                    value={markupSettings.buyMarkupPercent}
                    onChange={(e) =>
                      setMarkupSettings((prev) => ({ ...prev, buyMarkupPercent: e.target.value }))
                    }
                    data-testid="input-buy-markup"
                  />
                  <p className="text-xs text-muted-foreground">
                    When customers buy foreign currency, rate is increased by this %
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Sell Markup (%)</Label>
                  <Input
                    type="number"
                    step="0.5"
                    min="0"
                    max="50"
                    placeholder="e.g., 10"
                    value={markupSettings.sellMarkupPercent}
                    onChange={(e) =>
                      setMarkupSettings((prev) => ({ ...prev, sellMarkupPercent: e.target.value }))
                    }
                    data-testid="input-sell-markup"
                  />
                  <p className="text-xs text-muted-foreground">
                    When customers sell foreign currency, rate is decreased by this %
                  </p>
                </div>
                <Button
                  className="w-full"
                  onClick={() => updateSettingsMutation.mutate(markupSettings)}
                  disabled={updateSettingsMutation.isPending}
                  data-testid="button-save-settings"
                >
                  {updateSettingsMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Save Markup Settings
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" data-testid="button-add-rate">
                <Plus className="h-4 w-4" />
                Add Rate
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Exchange Rate</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Base Currency</Label>
                  <Select
                    value={newRate.baseCurrency}
                    onValueChange={(value) =>
                      setNewRate((prev) => ({ ...prev, baseCurrency: value }))
                    }
                  >
                    <SelectTrigger data-testid="select-base-currency">
                      <SelectValue placeholder="Select base currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((currency) => (
                        <SelectItem key={currency.code} value={currency.code}>
                          {currency.symbol} {currency.code} - {currency.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Target Currency</Label>
                  <Select
                    value={newRate.targetCurrency}
                    onValueChange={(value) =>
                      setNewRate((prev) => ({ ...prev, targetCurrency: value }))
                    }
                  >
                    <SelectTrigger data-testid="select-target-currency">
                      <SelectValue placeholder="Select target currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((currency) => (
                        <SelectItem key={currency.code} value={currency.code}>
                          {currency.symbol} {currency.code} - {currency.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Market Rate</Label>
                  <Input
                    type="number"
                    step="0.000001"
                    placeholder="e.g., 1550.00"
                    value={newRate.rate}
                    onChange={(e) =>
                      setNewRate((prev) => ({ ...prev, rate: e.target.value }))
                    }
                    data-testid="input-rate"
                  />
                  <p className="text-xs text-muted-foreground">
                    1 {newRate.baseCurrency} = {newRate.rate || "?"} {newRate.targetCurrency}
                  </p>
                </div>
                <Button
                  className="w-full"
                  onClick={() => createMutation.mutate(newRate)}
                  disabled={!newRate.rate || createMutation.isPending}
                  data-testid="button-save-rate"
                >
                  {createMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Save Exchange Rate
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass border-emerald-200 dark:border-emerald-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">
                  Buy Markup
                </p>
                {loadingSettings ? (
                  <Skeleton className="h-7 w-16" />
                ) : (
                  <p className="text-2xl font-black text-emerald-600">
                    {settings?.buyMarkupPercent || '10'}%
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass border-blue-200 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <TrendingUp className="h-5 w-5 text-blue-600 rotate-180" />
              </div>
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">
                  Sell Markup
                </p>
                {loadingSettings ? (
                  <Skeleton className="h-7 w-16" />
                ) : (
                  <p className="text-2xl font-black text-blue-600">
                    {settings?.sellMarkupPercent || '10'}%
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass border-cyan-200 dark:border-cyan-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-100 dark:bg-cyan-900/30">
                <ArrowUpDown className="h-5 w-5 text-cyan-600" />
              </div>
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">
                  Active Pairs
                </p>
                {isLoading ? (
                  <Skeleton className="h-7 w-12" />
                ) : (
                  <p className="text-2xl font-black text-cyan-600">
                    {exchangeRates?.length || 0}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle>Exchange Rates</CardTitle>
            <CardDescription>
              Market rates with customer buy/sell prices
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/exchange-rates"] })}
            data-testid="button-refresh"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : exchangeRates && exchangeRates.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {exchangeRates.map((rate) => {
                const marketRate = parseFloat(rate.rate);
                const buyRate = calculateCustomerRate(marketRate, 'buy');
                const sellRate = calculateCustomerRate(marketRate, 'sell');
                
                return (
                  <div
                    key={rate.id}
                    className="p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                    data-testid={`rate-${rate.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono">
                          {rate.baseCurrency}
                        </Badge>
                        <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                        <Badge variant="outline" className="font-mono">
                          {rate.targetCurrency}
                        </Badge>
                      </div>
                      <Badge className="bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-200">
                        {rate.source}
                      </Badge>
                    </div>
                    <div className="mt-3 space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Market:</span>
                        <span className="font-mono font-bold">
                          {getCurrencySymbol(rate.baseCurrency)}1 = {getCurrencySymbol(rate.targetCurrency)}{marketRate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-emerald-600">Customer Buy:</span>
                        <span className="font-mono font-bold text-emerald-600">
                          {getCurrencySymbol(rate.targetCurrency)}{buyRate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-blue-600">Customer Sell:</span>
                        <span className="font-mono font-bold text-blue-600">
                          {getCurrencySymbol(rate.targetCurrency)}{sellRate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">
                      Updated: {new Date(rate.validFrom).toLocaleDateString()}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <ArrowUpDown className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No exchange rates configured</p>
              <p className="text-sm mt-1">Click "Fetch Live Rates" to get market rates</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
