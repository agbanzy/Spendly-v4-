import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const [newRate, setNewRate] = useState({
    baseCurrency: "USD",
    targetCurrency: "NGN",
    rate: "",
  });

  const { data: exchangeRates, isLoading } = useQuery<ExchangeRate[]>({
    queryKey: ["/api/exchange-rates"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof newRate) => {
      return apiRequest("/api/exchange-rates", {
        method: "POST",
        body: JSON.stringify(data),
      });
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

  const getCurrencySymbol = (code: string) => {
    return CURRENCIES.find((c) => c.code === code)?.symbol || code;
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
            Manage currency exchange rates for multi-currency transactions
          </p>
        </div>
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
                <Label>Exchange Rate</Label>
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {CURRENCIES.slice(0, 4).map((currency) => (
          <Card key={currency.code} className="glass">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-cyan-100 dark:bg-cyan-900/30">
                  <DollarSign className="h-5 w-5 text-cyan-600" />
                </div>
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">
                    {currency.code}
                  </p>
                  <p className="text-lg font-bold">{currency.symbol}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Exchange Rates</CardTitle>
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
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : exchangeRates && exchangeRates.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {exchangeRates.map((rate) => (
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
                    <Badge className="bg-cyan-100 text-cyan-800">{rate.source}</Badge>
                  </div>
                  <div className="mt-3">
                    <p className="text-2xl font-bold">
                      {getCurrencySymbol(rate.baseCurrency)}1 ={" "}
                      {getCurrencySymbol(rate.targetCurrency)}
                      {parseFloat(rate.rate).toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Valid from: {new Date(rate.validFrom).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <ArrowUpDown className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No exchange rates configured</p>
              <p className="text-sm mt-1">Add rates for multi-currency support</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
