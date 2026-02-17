import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Banknote,
  ArrowLeft,
  Send,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  Play,
} from "lucide-react";
import { Link } from "wouter";
import type { Payout } from "@shared/schema";

export default function AdminPayouts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: payouts, isLoading } = useQuery<Payout[]>({
    queryKey: ["/api/payouts"],
  });

  const processMutation = useMutation({
    mutationFn: async (payoutId: string) => {
      return apiRequest("POST", `/api/payouts/${payoutId}/process`);
    },
    onSuccess: () => {
      toast({
        title: "Payout Processing",
        description: "Payout has been submitted for processing",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/payouts"] });
    },
    onError: (error: any) => {
      toast({
        title: "Processing Failed",
        description: error.message || "Failed to process payout",
        variant: "destructive",
      });
    },
  });

  const formatCurrency = (amount: string | number, currency: string = "USD") => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(num || 0);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-emerald-600" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-rose-600" />;
      case "processing":
        return <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-amber-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-emerald-100 text-emerald-800";
      case "failed":
        return "bg-rose-100 text-rose-800";
      case "processing":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-amber-100 text-amber-800";
    }
  };

  const pendingPayouts = payouts?.filter((p) => p.status === "pending") || [];
  const totalPending = pendingPayouts.reduce(
    (sum, p) => sum + parseFloat(p.amount || "0"),
    0
  );

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
            <Banknote className="h-7 w-7 text-teal-600" />
            Payout Management
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Process and track expense reimbursements, payroll, and vendor payments
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-teal-100 dark:bg-teal-900/30">
                <Banknote className="h-5 w-5 text-teal-600" />
              </div>
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">
                  Total Payouts
                </p>
                {isLoading ? (
                  <Skeleton className="h-7 w-12" />
                ) : (
                  <p className="text-2xl font-black">{payouts?.length || 0}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">
                  Pending
                </p>
                {isLoading ? (
                  <Skeleton className="h-7 w-12" />
                ) : (
                  <p className="text-2xl font-black text-amber-600">
                    {pendingPayouts.length}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
                <Send className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">
                  Pending Amount
                </p>
                {isLoading ? (
                  <Skeleton className="h-7 w-24" />
                ) : (
                  <p className="text-2xl font-black">{formatCurrency(totalPending)}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">
                  Completed
                </p>
                {isLoading ? (
                  <Skeleton className="h-7 w-12" />
                ) : (
                  <p className="text-2xl font-black text-emerald-600">
                    {payouts?.filter((p) => p.status === "completed").length || 0}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>All Payouts</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/payouts"] })}
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
          ) : payouts && payouts.length > 0 ? (
            <div className="space-y-4">
              {payouts.map((payout) => (
                <div
                  key={payout.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  data-testid={`payout-${payout.id}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-teal-100 dark:bg-teal-900/30">
                      <Banknote className="h-5 w-5 text-teal-600" />
                    </div>
                    <div>
                      <p className="font-medium">{payout.recipientName || payout.recipientId}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline">{payout.type}</Badge>
                        <Badge variant="outline">{payout.recipientType}</Badge>
                        <Badge className={getStatusColor(payout.status)}>
                          {getStatusIcon(payout.status)}
                          <span className="ml-1">{payout.status}</span>
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xl font-bold">
                        {formatCurrency(payout.amount, payout.currency)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        via {payout.provider}
                      </p>
                    </div>
                    {payout.status === "pending" && (
                      <Button
                        size="sm"
                        onClick={() => processMutation.mutate(payout.id)}
                        disabled={processMutation.isPending}
                        className="gap-2"
                        data-testid={`button-process-${payout.id}`}
                      >
                        <Play className="h-4 w-4" />
                        Process
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Banknote className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No payouts found</p>
              <p className="text-sm mt-1">Payouts are created when expenses are approved</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
