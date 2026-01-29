import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Plus,
  Search,
  FileText,
  Calendar,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Clock,
} from "lucide-react";
import type { Bill } from "@shared/schema";

export default function Bills() {
  const { data: bills, isLoading } = useQuery<Bill[]>({
    queryKey: ["/api/bills"],
  });

  const totalBills = bills?.reduce((sum, b) => sum + b.amount, 0) || 0;
  const paidBills = bills?.filter((b) => b.status === "Paid").reduce((sum, b) => sum + b.amount, 0) || 0;
  const unpaidBills = totalBills - paidBills;
  const overdueBills = bills?.filter((b) => b.status === "Overdue").length || 0;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Paid":
        return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
      case "Unpaid":
        return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
      case "Overdue":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      default:
        return "";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Paid":
        return <CheckCircle className="h-4 w-4" />;
      case "Unpaid":
        return <Clock className="h-4 w-4" />;
      case "Overdue":
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight" data-testid="text-bills-title">
            Bills
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage recurring bills and payments.
          </p>
        </div>
        <Button data-testid="button-add-bill">
          <Plus className="h-4 w-4 mr-2" />
          Add Bill
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                Total Bills
              </p>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </div>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-black" data-testid="text-total-bills">
                ${totalBills.toLocaleString()}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                Paid
              </p>
              <CheckCircle className="h-4 w-4 text-emerald-600" />
            </div>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-black text-emerald-600">
                ${paidBills.toLocaleString()}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                Unpaid
              </p>
              <Clock className="h-4 w-4 text-amber-600" />
            </div>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-black text-amber-600">
                ${unpaidBills.toLocaleString()}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className={overdueBills > 0 ? "border-red-200 dark:border-red-900" : ""}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                Overdue
              </p>
              <AlertTriangle className={`h-4 w-4 ${overdueBills > 0 ? "text-red-600" : "text-muted-foreground"}`} />
            </div>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className={`text-2xl font-black ${overdueBills > 0 ? "text-red-600" : ""}`}>
                {overdueBills}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search bills..."
              className="pl-10"
              data-testid="input-search-bills"
            />
          </div>
        </CardContent>
      </Card>

      {/* Bills List */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-sm font-bold uppercase tracking-widest">
            All Bills
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-12 w-12 rounded-xl" />
                    <div>
                      <Skeleton className="h-4 w-48 mb-2" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                  <Skeleton className="h-5 w-24" />
                </div>
              ))}
            </div>
          ) : bills && bills.length > 0 ? (
            <div className="divide-y divide-border">
              {bills.map((bill) => (
                <div
                  key={bill.id}
                  className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                  data-testid={`bill-row-${bill.id}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate">{bill.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {bill.provider}
                        </span>
                        <span className="text-xs text-muted-foreground">•</span>
                        <Badge variant="outline" className="text-xs">
                          {bill.category}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-4">
                    <div>
                      <p className="text-base font-bold">
                        ${bill.amount.toLocaleString()}
                      </p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <Calendar className="h-3 w-3" />
                        <span>Due {new Date(bill.dueDate).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <Badge
                      variant="secondary"
                      className={`text-xs ${getStatusColor(bill.status)}`}
                    >
                      {getStatusIcon(bill.status)}
                      <span className="ml-1">{bill.status}</span>
                    </Badge>
                    {bill.status === "Unpaid" && (
                      <Button size="sm" data-testid={`button-pay-${bill.id}`}>
                        Pay Now
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-bold mb-1">No bills yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Start by adding your first bill.
              </p>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Bill
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
