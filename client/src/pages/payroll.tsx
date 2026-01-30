import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { 
  Users, 
  Plus, 
  Search,
  Clock,
  CheckCircle2,
  AlertCircle,
  Download,
  Send,
  Loader2,
  Wallet,
  MoreVertical,
  Pencil,
  Trash2,
  FileText,
  DollarSign,
  Building2,
  CalendarDays,
  Eye,
  Mail,
  Printer,
  X,
} from "lucide-react";
import type { PayrollEntry } from "@shared/schema";

interface Settings {
  currency: string;
}

const currencySymbols: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  NGN: '₦',
  KES: 'KSh',
  GHS: '₵',
  ZAR: 'R',
};

export default function PayrollPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [isRunPayrollOpen, setIsRunPayrollOpen] = useState(false);
  const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false);
  const [isPayIndividualOpen, setIsPayIndividualOpen] = useState(false);
  const [isViewPayslipOpen, setIsViewPayslipOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<PayrollEntry | null>(null);
  const [editingEntry, setEditingEntry] = useState<PayrollEntry | null>(null);
  const [formData, setFormData] = useState({
    employeeName: "",
    department: "Engineering",
    salary: "",
    bonus: "",
    deductions: "",
    payDate: new Date().toISOString().split('T')[0],
    bankName: "",
    accountNumber: "",
    accountName: "",
  });

  const { data: settings } = useQuery<Settings>({
    queryKey: ["/api/settings"]
  });

  const currency = settings?.currency || 'USD';
  const currencySymbol = currencySymbols[currency] || currency;

  const formatCurrency = (amount: number) => {
    return `${currencySymbol}${amount.toLocaleString()}`;
  };

  const { data: payrollEntries = [], isLoading } = useQuery<PayrollEntry[]>({
    queryKey: ["/api/payroll"]
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("POST", "/api/payroll", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payroll"] });
      toast({ title: "Employee added to payroll", description: "The employee has been successfully added." });
      setIsAddEmployeeOpen(false);
      resetForm();
    },
    onError: () => {
      toast({ title: "Failed to add employee", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      return apiRequest("PATCH", `/api/payroll/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payroll"] });
      toast({ title: "Payroll entry updated" });
      setIsAddEmployeeOpen(false);
      setEditingEntry(null);
      resetForm();
    },
    onError: () => {
      toast({ title: "Failed to update payroll entry", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/payroll/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payroll"] });
      toast({ title: "Payroll entry deleted" });
      setIsDeleteConfirmOpen(false);
      setSelectedEntry(null);
    },
    onError: () => {
      toast({ title: "Failed to delete payroll entry", variant: "destructive" });
    },
  });

  const processPayrollMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/payroll/process");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payroll"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/balances"] });
      toast({ title: "Payroll processed successfully", description: "All pending payments have been processed." });
      setIsRunPayrollOpen(false);
    },
    onError: () => {
      toast({ title: "Failed to process payroll", variant: "destructive" });
    },
  });

  const payIndividualMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/payroll/${id}/pay`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payroll"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/balances"] });
      toast({ title: "Payment processed", description: `Payment to ${selectedEntry?.employeeName} completed.` });
      setIsPayIndividualOpen(false);
      setSelectedEntry(null);
    },
    onError: () => {
      toast({ title: "Failed to process payment", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      employeeName: "",
      department: "Engineering",
      salary: "",
      bonus: "",
      deductions: "",
      payDate: new Date().toISOString().split('T')[0],
      bankName: "",
      accountNumber: "",
      accountName: "",
    });
  };

  const openEditDialog = (entry: PayrollEntry) => {
    setEditingEntry(entry);
    setFormData({
      employeeName: entry.employeeName,
      department: entry.department,
      salary: String(entry.salary),
      bonus: String(entry.bonus),
      deductions: String(entry.deductions),
      payDate: entry.payDate,
      bankName: entry.bankName || "",
      accountNumber: entry.accountNumber || "",
      accountName: entry.accountName || "",
    });
    setIsAddEmployeeOpen(true);
  };

  const handleSubmit = () => {
    const salary = parseFloat(formData.salary) || 0;
    const bonus = parseFloat(formData.bonus) || 0;
    const deductions = parseFloat(formData.deductions) || 0;
    
    if (!formData.employeeName.trim()) {
      toast({ title: "Employee name is required", variant: "destructive" });
      return;
    }
    if (salary <= 0) {
      toast({ title: "Salary must be greater than 0", variant: "destructive" });
      return;
    }
    
    if (editingEntry) {
      updateMutation.mutate({ 
        id: editingEntry.id, 
        data: { 
          ...formData, 
          salary, 
          bonus, 
          deductions,
          netPay: salary + bonus - deductions 
        } 
      });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleExport = (format: 'csv' | 'json') => {
    const dataToExport = filteredEntries.map(entry => ({
      employeeName: entry.employeeName,
      department: entry.department,
      salary: entry.salary,
      bonus: entry.bonus,
      deductions: entry.deductions,
      netPay: entry.netPay,
      status: entry.status,
      payDate: entry.payDate,
    }));

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payroll-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const headers = ['Employee Name', 'Department', 'Salary', 'Bonus', 'Deductions', 'Net Pay', 'Status', 'Pay Date'];
      const csvContent = [
        headers.join(','),
        ...dataToExport.map(row => [
          `"${row.employeeName}"`,
          `"${row.department}"`,
          row.salary,
          row.bonus,
          row.deductions,
          row.netPay,
          `"${row.status}"`,
          `"${row.payDate}"`,
        ].join(','))
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payroll-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
    
    toast({ title: "Export successful", description: `Payroll data exported as ${format.toUpperCase()}` });
  };

  const handlePrintPayslip = () => {
    if (!selectedEntry) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Payslip - ${selectedEntry.employeeName}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; max-width: 600px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
          .header h1 { margin: 0; color: #4f46e5; }
          .header p { margin: 5px 0; color: #666; }
          .employee-info { margin-bottom: 30px; }
          .employee-info h2 { margin: 0 0 10px 0; }
          .details { border: 1px solid #ddd; border-radius: 8px; overflow: hidden; }
          .row { display: flex; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid #eee; }
          .row:last-child { border-bottom: none; }
          .row.total { background: #f5f5f5; font-weight: bold; font-size: 1.1em; }
          .label { color: #666; }
          .value { font-weight: 500; }
          .bonus { color: #10b981; }
          .deduction { color: #ef4444; }
          .footer { margin-top: 40px; text-align: center; color: #999; font-size: 12px; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>SPENDLY</h1>
          <p>Payslip for ${new Date(selectedEntry.payDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
        </div>
        <div class="employee-info">
          <h2>${selectedEntry.employeeName}</h2>
          <p>Department: ${selectedEntry.department}</p>
          <p>Employee ID: ${selectedEntry.employeeId}</p>
          <p>Pay Date: ${new Date(selectedEntry.payDate).toLocaleDateString()}</p>
          ${selectedEntry.bankName ? `<p style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #eee;"><strong>Bank:</strong> ${selectedEntry.bankName}</p>` : ''}
          ${selectedEntry.accountNumber ? `<p><strong>Account:</strong> ****${selectedEntry.accountNumber.slice(-4)}${selectedEntry.accountName ? ` (${selectedEntry.accountName})` : ''}</p>` : ''}
        </div>
        <div class="details">
          <div class="row">
            <span class="label">Basic Salary</span>
            <span class="value">${currencySymbol}${Number(selectedEntry.salary).toLocaleString()}</span>
          </div>
          <div class="row">
            <span class="label">Bonus</span>
            <span class="value bonus">+${currencySymbol}${Number(selectedEntry.bonus).toLocaleString()}</span>
          </div>
          <div class="row">
            <span class="label">Deductions</span>
            <span class="value deduction">-${currencySymbol}${Number(selectedEntry.deductions).toLocaleString()}</span>
          </div>
          <div class="row total">
            <span class="label">Net Pay</span>
            <span class="value">${currencySymbol}${Number(selectedEntry.netPay).toLocaleString()}</span>
          </div>
        </div>
        <div class="footer">
          <p>This is a computer-generated payslip. No signature required.</p>
          <p>Generated on ${new Date().toLocaleDateString()}</p>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const totalPayroll = payrollEntries.reduce((sum, entry) => sum + Number(entry.netPay), 0);
  const pendingPayroll = payrollEntries.filter(e => e.status === "pending").reduce((sum, e) => sum + Number(e.netPay), 0);
  const paidThisMonth = payrollEntries.filter(e => e.status === "paid").reduce((sum, e) => sum + Number(e.netPay), 0);
  
  const departments = Array.from(new Set(payrollEntries.map(e => e.department)));
  const departmentStats = departments.map(dept => ({
    name: dept,
    count: payrollEntries.filter(e => e.department === dept).length,
    total: payrollEntries.filter(e => e.department === dept).reduce((sum, e) => sum + Number(e.netPay), 0),
  }));

  const filteredEntries = payrollEntries.filter(entry => {
    const matchesSearch = entry.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.department.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDepartment = departmentFilter === "all" || entry.department === departmentFilter;
    return matchesSearch && matchesDepartment;
  });

  const getStatusBadge = (status: PayrollEntry["status"]) => {
    switch (status) {
      case "paid":
        return <Badge variant="default" className="bg-emerald-500"><CheckCircle2 className="mr-1 h-3 w-3" />Paid</Badge>;
      case "pending":
        return <Badge variant="outline"><Clock className="mr-1 h-3 w-3" />Pending</Badge>;
      case "processing":
        return <Badge variant="secondary"><Loader2 className="mr-1 h-3 w-3 animate-spin" />Processing</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 texture-mesh min-h-screen">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-payroll-title">Payroll Management</h1>
          <p className="text-muted-foreground">Manage employee salaries, bonuses, and payments</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" data-testid="button-export-payroll">
                <Download className="mr-2 h-4 w-4" />Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleExport('csv')} data-testid="button-export-csv">
                <FileText className="mr-2 h-4 w-4" />Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('json')} data-testid="button-export-json">
                <FileText className="mr-2 h-4 w-4" />Export as JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" onClick={() => { resetForm(); setEditingEntry(null); setIsAddEmployeeOpen(true); }} data-testid="button-add-employee">
            <Plus className="mr-2 h-4 w-4" />Add Employee
          </Button>
          <Button onClick={() => setIsRunPayrollOpen(true)} disabled={pendingPayroll === 0} data-testid="button-run-payroll">
            <Send className="mr-2 h-4 w-4" />Run Payroll
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="glass card-hover" data-testid="card-total-payroll">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900 text-indigo-600"><Wallet className="h-5 w-5" /></div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(totalPayroll)}</p>
                <p className="text-sm text-muted-foreground">Total Payroll</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass card-hover">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900 text-emerald-600"><CheckCircle2 className="h-5 w-5" /></div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(paidThisMonth)}</p>
                <p className="text-sm text-muted-foreground">Paid This Month</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass card-hover">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900 text-amber-600"><Clock className="h-5 w-5" /></div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(pendingPayroll)}</p>
                <p className="text-sm text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass card-hover">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-100 dark:bg-cyan-900 text-cyan-600"><Users className="h-5 w-5" /></div>
              <div>
                <p className="text-2xl font-bold">{payrollEntries.length}</p>
                <p className="text-sm text-muted-foreground">Employees</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {departments.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Department Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
              {departmentStats.map((dept, index) => (
                <div key={dept.name} className="p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => setDepartmentFilter(dept.name)} data-testid={`button-department-${index}`}>
                  <p className="font-medium text-sm" data-testid={`text-department-name-${index}`}>{dept.name}</p>
                  <p className="text-2xl font-bold" data-testid={`text-department-count-${index}`}>{dept.count}</p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(dept.total)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="all" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <TabsList>
            <TabsTrigger value="all" data-testid="tab-all">All ({payrollEntries.length})</TabsTrigger>
            <TabsTrigger value="paid" data-testid="tab-paid">Paid ({payrollEntries.filter(e => e.status === "paid").length})</TabsTrigger>
            <TabsTrigger value="pending" data-testid="tab-pending">Pending ({payrollEntries.filter(e => e.status === "pending").length})</TabsTrigger>
            <TabsTrigger value="processing" data-testid="tab-processing">Processing</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-40" data-testid="select-department-filter">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search employees..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" data-testid="input-search-payroll" />
            </div>
          </div>
        </div>

        {["all", "paid", "pending", "processing"].map((tab) => (
          <TabsContent key={tab} value={tab}>
            <Card>
              <CardHeader><CardTitle>Payroll Summary</CardTitle><CardDescription>View and manage employee payments</CardDescription></CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(tab === "all" ? filteredEntries : filteredEntries.filter(e => e.status === tab)).map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors" data-testid={`payroll-row-${entry.id}`}>
                      <div className="flex items-center gap-4">
                        <Avatar><AvatarFallback className="bg-indigo-100 text-indigo-600 dark:bg-indigo-900 dark:text-indigo-400">{entry.employeeName.split(" ").map(n => n[0]).join("")}</AvatarFallback></Avatar>
                        <div>
                          <p className="font-medium">{entry.employeeName}</p>
                          <p className="text-sm text-muted-foreground">{entry.department}</p>
                          {entry.bankName && (
                            <p className="text-xs text-muted-foreground mt-0.5">{entry.bankName} {entry.accountNumber ? `• ****${entry.accountNumber.slice(-4)}` : ''}</p>
                          )}
                        </div>
                      </div>
                      <div className="hidden md:flex items-center gap-8">
                        <div className="text-right"><p className="text-sm text-muted-foreground">Salary</p><p className="font-medium">{formatCurrency(Number(entry.salary))}</p></div>
                        <div className="text-right"><p className="text-sm text-muted-foreground">Bonus</p><p className="font-medium text-emerald-600">+{formatCurrency(Number(entry.bonus))}</p></div>
                        <div className="text-right"><p className="text-sm text-muted-foreground">Deductions</p><p className="font-medium text-rose-600">-{formatCurrency(Number(entry.deductions))}</p></div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right"><p className="text-sm text-muted-foreground">Net Pay</p><p className="text-lg font-bold">{formatCurrency(Number(entry.netPay))}</p></div>
                        {getStatusBadge(entry.status)}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" data-testid={`button-payroll-menu-${entry.id}`}><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setSelectedEntry(entry); setIsViewPayslipOpen(true); }} data-testid={`button-view-payslip-${entry.id}`}>
                              <Eye className="h-4 w-4 mr-2" />View Payslip
                            </DropdownMenuItem>
                            {entry.status === "pending" && (
                              <DropdownMenuItem onClick={() => { setSelectedEntry(entry); setIsPayIndividualOpen(true); }} data-testid={`button-pay-now-${entry.id}`}>
                                <DollarSign className="h-4 w-4 mr-2" />Pay Now
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => openEditDialog(entry)} data-testid={`button-edit-payroll-${entry.id}`}>
                              <Pencil className="h-4 w-4 mr-2" />Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600" onClick={() => { setSelectedEntry(entry); setIsDeleteConfirmOpen(true); }} data-testid={`button-delete-payroll-${entry.id}`}>
                              <Trash2 className="h-4 w-4 mr-2" />Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                  {(tab === "all" ? filteredEntries : filteredEntries.filter(e => e.status === tab)).length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No payroll entries found</p>
                      <Button variant="outline" className="mt-4" onClick={() => { resetForm(); setEditingEntry(null); setIsAddEmployeeOpen(true); }}>
                        <Plus className="mr-2 h-4 w-4" />Add First Employee
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={isRunPayrollOpen} onOpenChange={setIsRunPayrollOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Run Payroll</DialogTitle>
            <DialogDescription>Process payments for all pending employees.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="p-4 rounded-lg bg-muted">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Total to be paid</span>
                <span className="text-2xl font-bold">{formatCurrency(pendingPayroll)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Employees</span>
                <span>{payrollEntries.filter(e => e.status === "pending").length} pending</span>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Pending Employees:</p>
              <div className="max-h-40 overflow-y-auto space-y-2">
                {payrollEntries.filter(e => e.status === "pending").map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between p-2 rounded border bg-background">
                    <span className="text-sm">{entry.employeeName}</span>
                    <span className="text-sm font-medium">{formatCurrency(Number(entry.netPay))}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-200">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm">Funds will be deducted from your main wallet.</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRunPayrollOpen(false)}>Cancel</Button>
            <Button onClick={() => processPayrollMutation.mutate()} disabled={processPayrollMutation.isPending || pendingPayroll === 0} data-testid="button-confirm-payroll">
              {processPayrollMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</> : <><Send className="mr-2 h-4 w-4" />Process {formatCurrency(pendingPayroll)}</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPayIndividualOpen} onOpenChange={setIsPayIndividualOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pay Individual Employee</DialogTitle>
            <DialogDescription>Process payment for {selectedEntry?.employeeName}</DialogDescription>
          </DialogHeader>
          {selectedEntry && (
            <div className="py-4 space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-indigo-100 text-indigo-600">{selectedEntry.employeeName.split(" ").map(n => n[0]).join("")}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{selectedEntry.employeeName}</p>
                  <p className="text-sm text-muted-foreground">{selectedEntry.department}</p>
                </div>
              </div>
              <div className="p-4 rounded-lg bg-muted space-y-2">
                <div className="flex justify-between"><span className="text-muted-foreground">Salary</span><span>{formatCurrency(Number(selectedEntry.salary))}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Bonus</span><span className="text-emerald-600">+{formatCurrency(Number(selectedEntry.bonus))}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Deductions</span><span className="text-rose-600">-{formatCurrency(Number(selectedEntry.deductions))}</span></div>
                <div className="flex justify-between border-t pt-2 font-bold"><span>Net Pay</span><span>{formatCurrency(Number(selectedEntry.netPay))}</span></div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPayIndividualOpen(false)} data-testid="button-cancel-pay">Cancel</Button>
            <Button onClick={() => selectedEntry && payIndividualMutation.mutate(selectedEntry.id)} disabled={payIndividualMutation.isPending} data-testid="button-confirm-pay-individual">
              {payIndividualMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</> : <><DollarSign className="mr-2 h-4 w-4" />Pay {selectedEntry ? formatCurrency(Number(selectedEntry.netPay)) : formatCurrency(0)}</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isViewPayslipOpen} onOpenChange={setIsViewPayslipOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Payslip
            </DialogTitle>
          </DialogHeader>
          {selectedEntry && (
            <div className="space-y-6">
              <div className="text-center border-b pb-4">
                <h2 className="text-xl font-bold text-indigo-600">SPENDLY</h2>
                <p className="text-sm text-muted-foreground">Payslip for {new Date(selectedEntry.payDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
              </div>
              
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-indigo-100 text-indigo-600">{selectedEntry.employeeName.split(" ").map(n => n[0]).join("")}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">{selectedEntry.employeeName}</p>
                    <p className="text-sm text-muted-foreground">{selectedEntry.department}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                  <CalendarDays className="h-4 w-4" />
                  <span>Pay Date: {new Date(selectedEntry.payDate).toLocaleDateString()}</span>
                </div>
                {selectedEntry.bankName && (
                  <div className="mt-3 p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Payment Details</p>
                    <p className="text-sm font-medium">{selectedEntry.bankName}</p>
                    {selectedEntry.accountNumber && (
                      <p className="text-sm text-muted-foreground">****{selectedEntry.accountNumber.slice(-4)}{selectedEntry.accountName ? ` - ${selectedEntry.accountName}` : ''}</p>
                    )}
                  </div>
                )}
              </div>

              <div className="rounded-lg border overflow-hidden">
                <div className="flex justify-between p-3 border-b">
                  <span className="text-muted-foreground">Basic Salary</span>
                  <span className="font-medium">{formatCurrency(Number(selectedEntry.salary))}</span>
                </div>
                <div className="flex justify-between p-3 border-b">
                  <span className="text-muted-foreground">Bonus</span>
                  <span className="font-medium text-emerald-600">+{formatCurrency(Number(selectedEntry.bonus))}</span>
                </div>
                <div className="flex justify-between p-3 border-b">
                  <span className="text-muted-foreground">Deductions</span>
                  <span className="font-medium text-rose-600">-{formatCurrency(Number(selectedEntry.deductions))}</span>
                </div>
                <div className="flex justify-between p-3 bg-muted font-bold">
                  <span>Net Pay</span>
                  <span>{formatCurrency(Number(selectedEntry.netPay))}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                {getStatusBadge(selectedEntry.status)}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handlePrintPayslip} data-testid="button-print-payslip">
                    <Printer className="mr-2 h-4 w-4" />Print
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isAddEmployeeOpen} onOpenChange={setIsAddEmployeeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingEntry ? "Edit Payroll Entry" : "Add Employee to Payroll"}</DialogTitle>
            <DialogDescription>{editingEntry ? "Update the employee's payroll details." : "Add a new employee to the payroll system."}</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="employeeName">Employee Name *</Label>
              <Input id="employeeName" value={formData.employeeName} onChange={(e) => setFormData({ ...formData, employeeName: e.target.value })} placeholder="John Doe" data-testid="input-employee-name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Select value={formData.department} onValueChange={(value) => setFormData({ ...formData, department: value })}>
                <SelectTrigger data-testid="select-department"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Engineering">Engineering</SelectItem>
                  <SelectItem value="Marketing">Marketing</SelectItem>
                  <SelectItem value="Sales">Sales</SelectItem>
                  <SelectItem value="Finance">Finance</SelectItem>
                  <SelectItem value="Operations">Operations</SelectItem>
                  <SelectItem value="HR">HR</SelectItem>
                  <SelectItem value="Legal">Legal</SelectItem>
                  <SelectItem value="Product">Product</SelectItem>
                  <SelectItem value="Design">Design</SelectItem>
                  <SelectItem value="Support">Support</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="salary">Salary ({currencySymbol}) *</Label>
                <Input id="salary" type="number" value={formData.salary} onChange={(e) => setFormData({ ...formData, salary: e.target.value })} placeholder="0" data-testid="input-salary" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bonus">Bonus ({currencySymbol})</Label>
                <Input id="bonus" type="number" value={formData.bonus} onChange={(e) => setFormData({ ...formData, bonus: e.target.value })} placeholder="0" data-testid="input-bonus" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deductions">Deductions ({currencySymbol})</Label>
                <Input id="deductions" type="number" value={formData.deductions} onChange={(e) => setFormData({ ...formData, deductions: e.target.value })} placeholder="0" data-testid="input-deductions" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payDate">Pay Date</Label>
              <Input id="payDate" type="date" value={formData.payDate} onChange={(e) => setFormData({ ...formData, payDate: e.target.value })} data-testid="input-pay-date" />
            </div>
            
            <div className="border-t pt-4 mt-4">
              <h4 className="font-medium mb-3">Bank Account Details</h4>
              <div className="grid gap-4 grid-cols-2">
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="bankName">Bank Name (Payment Channel)</Label>
                  <Input id="bankName" value={formData.bankName} onChange={(e) => setFormData({ ...formData, bankName: e.target.value })} placeholder="e.g., First Bank, GTBank, Chase" data-testid="input-bank-name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accountNumber">Account Number</Label>
                  <Input id="accountNumber" value={formData.accountNumber} onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })} placeholder="0123456789" data-testid="input-account-number" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accountName">Account Name</Label>
                  <Input id="accountName" value={formData.accountName} onChange={(e) => setFormData({ ...formData, accountName: e.target.value })} placeholder="John Doe" data-testid="input-account-name" />
                </div>
              </div>
            </div>
            
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Net Pay</span>
                <span className="font-bold">{formatCurrency((parseFloat(formData.salary) || 0) + (parseFloat(formData.bonus) || 0) - (parseFloat(formData.deductions) || 0))}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddEmployeeOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-payroll">
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingEntry ? "Update Entry" : "Add Employee"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payroll Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the payroll entry for {selectedEntry?.employeeName}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => selectedEntry && deleteMutation.mutate(selectedEntry.id)} className="bg-red-600 hover:bg-red-700">
              {deleteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
