import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Wallet,
  ArrowLeft,
  Plus,
  DollarSign,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Eye,
} from "lucide-react";
import { Link } from "wouter";
import type { Wallet as WalletType } from "@shared/schema";

interface WalletWithDetails extends WalletType {
  transactions?: any[];
}

export default function AdminWallets() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: wallets, isLoading } = useQuery<WalletType[]>({
    queryKey: ["/api/wallets"],
  });

  const formatCurrency = (amount: string | number, currency: string = "USD") => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(num || 0);
  };

  const totalBalance = wallets?.reduce(
    (sum, w) => sum + parseFloat(w.balance || "0"),
    0
  ) || 0;

  const activeWallets = wallets?.filter((w) => w.status === "active").length || 0;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/admin">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-3" data-testid="text-title">
            <Wallet className="h-7 w-7 text-violet-600" />
            Wallet Management
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            View and manage all user wallets
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-900/30">
                <Wallet className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">
                  Total Wallets
                </p>
                {isLoading ? (
                  <Skeleton className="h-7 w-12" />
                ) : (
                  <p className="text-2xl font-black">{wallets?.length || 0}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">
                  Active Wallets
                </p>
                {isLoading ? (
                  <Skeleton className="h-7 w-12" />
                ) : (
                  <p className="text-2xl font-black text-emerald-600">{activeWallets}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
                <DollarSign className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">
                  Total Balance
                </p>
                {isLoading ? (
                  <Skeleton className="h-7 w-24" />
                ) : (
                  <p className="text-2xl font-black">{formatCurrency(totalBalance)}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>All Wallets</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/wallets"] })}
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
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : wallets && wallets.length > 0 ? (
            <div className="space-y-4">
              {wallets.map((wallet) => (
                <div
                  key={wallet.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  data-testid={`wallet-${wallet.id}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-900/30">
                      <Wallet className="h-5 w-5 text-violet-600" />
                    </div>
                    <div>
                      <p className="font-medium">User: {wallet.userId}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline">{wallet.currency}</Badge>
                        <Badge
                          variant={wallet.status === "active" ? "default" : "secondary"}
                          className={wallet.status === "active" ? "bg-emerald-100 text-emerald-800" : ""}
                        >
                          {wallet.status}
                        </Badge>
                        <Badge variant="outline">{wallet.type}</Badge>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold">
                      {formatCurrency(wallet.balance, wallet.currency)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Available: {formatCurrency(wallet.availableBalance || "0", wallet.currency)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No wallets found</p>
              <p className="text-sm mt-1">Wallets are created when users complete onboarding</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
