import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { 
  Users, 
  DollarSign, 
  Calendar, 
  Plus, 
  Search,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Download,
  Send,
  Loader2,
  Building2,
  Wallet,
  CreditCard
} from "lucide-react";
import type { TeamMember, PayrollEntry } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";

export default function PayrollPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isRunPayrollOpen, setIsRunPayrollOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: team } = useQuery<TeamMember[]>({
    queryKey: ["/api/team"]
  });

  const { data: payrollEntries = [], isLoading } = useQuery<PayrollEntry[]>({
    queryKey: ["/api/payroll"]
  });

  const totalPayroll = payrollEntries.reduce((sum, entry) => sum + entry.netPay, 0);
  const pendingPayroll = payrollEntries.filter(e => e.status === "pending").reduce((sum, e) => sum + e.netPay, 0);
  const paidThisMonth = payrollEntries.filter(e => e.status === "paid").reduce((sum, e) => sum + e.netPay, 0);

  const filteredEntries = payrollEntries.filter(entry =>
    entry.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    entry.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleRunPayroll = async () => {
    setIsProcessing(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    toast({
      title: "Payroll initiated",
      description: "Payroll is being processed. Employees will be paid within 24 hours."
    });
    
    setIsProcessing(false);
    setIsRunPayrollOpen(false);
  };

  const getStatusBadge = (status: PayrollEntry["status"]) => {
    switch (status) {
      case "paid":
        return (
          <Badge variant="default" className="bg-emerald-500">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Paid
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="outline">
            <Clock className="mr-1 h-3 w-3" />
            Pending
          </Badge>
        );
      case "processing":
        return (
          <Badge variant="secondary">
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            Processing
          </Badge>
        );
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-payroll-title">Payroll</h1>
          <p className="text-muted-foreground">Manage employee salaries and payments</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" data-testid="button-export-payroll">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Dialog open={isRunPayrollOpen} onOpenChange={setIsRunPayrollOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-run-payroll">
                <Send className="mr-2 h-4 w-4" />
                Run Payroll
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Run Payroll</DialogTitle>
                <DialogDescription>
                  Process payments for all pending employees.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-4">
                <div className="p-4 rounded-lg bg-muted">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Total to be paid</span>
                    <span className="text-2xl font-bold">${pendingPayroll.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Employees</span>
                    <span>{payrollEntries.filter(e => e.status === "pending").length} pending</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Payment Date</Label>
                  <Select defaultValue="2026-02-01">
                    <SelectTrigger>
                      <Calendar className="mr-2 h-4 w-4" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2026-01-28">January 28, 2026</SelectItem>
                      <SelectItem value="2026-02-01">February 1, 2026</SelectItem>
                      <SelectItem value="2026-02-15">February 15, 2026</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-200">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span className="text-sm">Funds will be deducted from your main wallet.</span>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsRunPayrollOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleRunPayroll} disabled={isProcessing} data-testid="button-confirm-payroll">
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Process Payroll
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="hover-elevate" data-testid="card-total-payroll">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900 text-indigo-600">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">${totalPayroll.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Total Payroll</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover-elevate">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900 text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">${paidThisMonth.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Paid This Month</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover-elevate">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900 text-amber-600">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">${pendingPayroll.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover-elevate">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-100 dark:bg-cyan-900 text-cyan-600">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{payrollEntries.length}</p>
                <p className="text-sm text-muted-foreground">Employees</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="all" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <TabsList>
            <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
            <TabsTrigger value="paid" data-testid="tab-paid">Paid</TabsTrigger>
            <TabsTrigger value="pending" data-testid="tab-pending">Pending</TabsTrigger>
            <TabsTrigger value="processing" data-testid="tab-processing">Processing</TabsTrigger>
          </TabsList>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search employees..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-payroll"
            />
          </div>
        </div>

        <TabsContent value="all">
          <Card>
            <CardHeader>
              <CardTitle>Payroll Summary</CardTitle>
              <CardDescription>View and manage employee payments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredEntries.map((entry, index) => (
                  <div 
                    key={entry.id} 
                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                    data-testid={`payroll-row-${index}`}
                  >
                    <div className="flex items-center gap-4">
                      <Avatar>
                        <AvatarFallback className="bg-indigo-100 text-indigo-600 dark:bg-indigo-900 dark:text-indigo-400">
                          {entry.employeeName.split(" ").map(n => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{entry.employeeName}</p>
                        <p className="text-sm text-muted-foreground">{entry.department}</p>
                      </div>
                    </div>
                    <div className="hidden md:flex items-center gap-8">
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Salary</p>
                        <p className="font-medium">${entry.salary.toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Bonus</p>
                        <p className="font-medium text-emerald-600">+${entry.bonus.toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Deductions</p>
                        <p className="font-medium text-rose-600">-${entry.deductions.toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Net Pay</p>
                        <p className="text-lg font-bold">${entry.netPay.toLocaleString()}</p>
                      </div>
                      {getStatusBadge(entry.status)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="paid">
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                {filteredEntries.filter(e => e.status === "paid").map((entry, index) => (
                  <div 
                    key={entry.id} 
                    className="flex items-center justify-between p-4 rounded-lg border"
                  >
                    <div className="flex items-center gap-4">
                      <Avatar>
                        <AvatarFallback className="bg-emerald-100 text-emerald-600">
                          {entry.employeeName.split(" ").map(n => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{entry.employeeName}</p>
                        <p className="text-sm text-muted-foreground">Paid on {entry.payDate}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="text-lg font-bold">${entry.netPay.toLocaleString()}</p>
                      {getStatusBadge(entry.status)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending">
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                {filteredEntries.filter(e => e.status === "pending").map((entry) => (
                  <div 
                    key={entry.id} 
                    className="flex items-center justify-between p-4 rounded-lg border"
                  >
                    <div className="flex items-center gap-4">
                      <Avatar>
                        <AvatarFallback className="bg-amber-100 text-amber-600">
                          {entry.employeeName.split(" ").map(n => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{entry.employeeName}</p>
                        <p className="text-sm text-muted-foreground">Due {entry.payDate}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="text-lg font-bold">${entry.netPay.toLocaleString()}</p>
                      {getStatusBadge(entry.status)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="processing">
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                {filteredEntries.filter(e => e.status === "processing").map((entry) => (
                  <div 
                    key={entry.id} 
                    className="flex items-center justify-between p-4 rounded-lg border"
                  >
                    <div className="flex items-center gap-4">
                      <Avatar>
                        <AvatarFallback className="bg-indigo-100 text-indigo-600">
                          {entry.employeeName.split(" ").map(n => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{entry.employeeName}</p>
                        <p className="text-sm text-muted-foreground">Processing...</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="text-lg font-bold">${entry.netPay.toLocaleString()}</p>
                      {getStatusBadge(entry.status)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
