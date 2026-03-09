import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreditCard, Clock, AlertTriangle } from "lucide-react";
import { useLocation } from "wouter";

interface SubscriptionData {
  id?: string;
  status: string;
  isActive: boolean;
  isTrialing: boolean;
  isExpired: boolean;
  trialDaysLeft: number;
  trialEndDate?: string;
  currentPeriodEnd?: string;
  canceledAt?: string;
  quantity?: number;
  unitPrice?: number;
  currency?: string;
  provider?: string;
}

export function useSubscription() {
  const { data, isLoading, error } = useQuery<SubscriptionData>({
    queryKey: ["/api/subscription"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/subscription");
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  return {
    subscription: data,
    isLoading,
    error,
    status: data?.status || 'none',
    isActive: data?.isActive ?? false,
    isTrialing: data?.isTrialing ?? false,
    isExpired: data?.isExpired ?? false,
    trialDaysLeft: data?.trialDaysLeft ?? 0,
  };
}

export function SubscriptionBanner() {
  const { subscription, isLoading, isTrialing, isExpired, trialDaysLeft, status } = useSubscription();
  const [, setLocation] = useLocation();

  if (isLoading || !subscription || status === 'none' || status === 'active') {
    return null;
  }

  if (isTrialing && trialDaysLeft > 14) {
    return null; // Don't show banner if trial has plenty of time
  }

  return (
    <div className="px-3 py-2">
      {isTrialing && trialDaysLeft <= 14 && (
        <div
          className="flex items-center gap-2 p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-950/60 transition-colors"
          onClick={() => setLocation("/settings#billing-section")}
        >
          <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-blue-800 dark:text-blue-200 truncate">
              Trial: {trialDaysLeft}d left
            </p>
          </div>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
            Upgrade
          </Badge>
        </div>
      )}

      {isExpired && (
        <div
          className="flex items-center gap-2 p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 cursor-pointer hover:bg-red-100 dark:hover:bg-red-950/60 transition-colors"
          onClick={() => setLocation("/settings#billing-section")}
        >
          <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-red-800 dark:text-red-200 truncate">
              Trial ended
            </p>
          </div>
          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
            Subscribe
          </Badge>
        </div>
      )}

      {status === 'past_due' && (
        <div
          className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-950/60 transition-colors"
          onClick={() => setLocation("/settings#billing-section")}
        >
          <CreditCard className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-amber-800 dark:text-amber-200 truncate">
              Payment failed
            </p>
          </div>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300">
            Update
          </Badge>
        </div>
      )}
    </div>
  );
}
