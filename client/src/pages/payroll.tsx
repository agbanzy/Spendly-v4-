import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
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
  PageWrapper,
  PageHeader,
  MetricCard,
  StatusBadge,
  AnimatedListItem,
  EmptyState,
  GlassCard,
  SectionLabel,
  fadeUp,
  stagger,
} from "@/components/ui-extended";
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
  Printer,
  TrendingUp,
} from "lucide-react";
import type { PayrollEntry } from "@shared/schema";

interface Settings {
  currency: string;
}

const currencySymbols: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  NGN: "₦",
  KES: "KSh",
  GHS: "₵",
  ZAR: "R",
};

const departmentColors: Record<string, { badge: string; text: string; bg: string }> = {
  Engineering: { badge: "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300", text: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-950/30" },
  Marketing: { badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300", text: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
  Sales: { badge: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300", text: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/30" },
  Finance: { badge: "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300", text: "text-rose-600", bg: "bg-rose-50 dark:bg-rose-950/30" },
  Operations: { badge: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300", text: "text-cyan-600", bg: "bg-cyan-50 dark:bg-cyan-950/30" },
  HR: { badge: "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300", text: "text-slate-600", bg: "bg-slate-50 dark:bg-slate-950/30" },
  Legal: { badge: "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300", text: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-950/30" },
  Product: { badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300", text: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
  Design: { badge: "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300", text: "text-rose-600", bg: "bg-rose-50 dark:bg-rose-950/30" },
  Support: { badge: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300", text: "text-cyan-600", bg: "bg-cyan-50 dark:bg-cyan-950/30" },
};

const getAvatarGradient = (name: string) => {
  const colors = ["from-violet-400 to-violet-600", "from-emerald-400 to-emerald-600", "from-amber-400 to-amber-600", "from-rose-400 to-rose-600", "from-cyan-400 to-cyan-600"];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
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
    payDate: new Date().toISOString().split("T")[0],
    bankName: "",
    accountNumber: "",
    accountName: "",
  });

  const { data: settings } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });

  const currency = settings?.currency || "USD";
  const currencySymbol = currencySymbols[currency] || currency;

  const formatCurrency = (amount: number) => {
    return `${currencySymbol}${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const { data: payrollEntries = [], isLoading } = useQuery<PayrollEntry[]>({
    queryKey: ["/api/payroll"],
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
      payDate: new Date().toISOString().split("T")[0],
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
          netPay: salary + bonus - deductions,
        },
      });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleExport = (format: "csv" | "json") => {
    const dataToExport = filteredEntries.map((entry) => ({
      employeeName: entry.employeeName,
      department: entry.department,
      salary: entry.salary,
      bonus: entry.bonus,
      deductions: entry.deductions,
      netPay: entry.netPay,
      status: entry.status,
      payDate: entry.payDate,
    }));

    if (format === "json") {
      const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `payroll-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const headers = ["Employee Name", "Department", "Salary", "Bonus", "Deductions", "Net Pay", "Status", "Pay Date"];
      const csvContent = [
        headers.join(","),
        ...dataToExport.map((row) =>
          [
            `"${row.employeeName}"`,
            `"${row.department}"`,
            row.salary,
            row.bonus,
            row.deductions,
            row.netPay,
            `"${row.status}"`,
            `"${row.payDate}"`,
          ].join(",")
        ),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `payroll-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }

    toast({ title: "Export successful", description: `Payroll data exported as ${format.toUpperCase()}` });
  };

  const handlePrintPayslip = () => {
    if (!selectedEntry) return;

    const printWindow = window.open("", "_blank");
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
          <p>Payslip for ${new Date(selectedEntry.payDate).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</p>
        </div>
        <div class="employee-info">
          <h2>${selectedEntry.employeeName}</h2>
          <p>Department: ${selectedEntry.department}</p>
          <p>Employee ID: ${selectedEntry.employeeId}</p>
          <p>Pay Date: ${new Date(selectedEntry.payDate).toLocaleDateString()}</p>
          ${selectedEntry.bankName ? `<p style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #eee;"><strong>Bank:</strong> ${selectedEntry.bankName}</p>` : ""}
          ${selectedEntry.accountNumber ? `<p><strong>Account:</strong> ****${selectedEntry.accountNumber.slice(-4)}${selectedEntry.accountName ? ` (${selectedEntry.accountName})` : ""}</p>` : ""}
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
  const pendingPayroll = payrollEntries.filter((e) => e.status === "pending").reduce((sum, e) => sum + Number(e.netPay), 0);
  const paidThisMonth = payrollEntries.filter((e) => e.status === "paid").reduce((sum, e) => sum + Number(e.netPay), 0);

  const departments = Array.from(new Set(payrollEntries.map((e) => e.department)));
  const departmentStats = departments.map((dept) => ({
    name: dept,
    count: payrollEntries.filter((e) => e.department === dept).length,
    total: payrollEntries.filter((e) => e.department === dept).reduce((sum, e) => sum + Number(e.netPay), 0),
  }));

  const filteredEntries = payrollEntries.filter((entry) => {
    const matchesSearch = entry.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) || entry.department.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDepartment = departmentFilter === "all" || entry.department === departmentFilter;
    return matchesSearch && matchesDepartment;
  });

  const getStatusBadge = (status: PayrollEntry["status"]) => {
    switch (status) {
      case "paid":
        return <StatusBadge status="success" label="Paid" icon={CheckCircle2} />;
      case "pending":
        return <StatusBadge status="pending" label="Pending" icon={Clock} />;
      case "processing":
        return <StatusBadge status="processing" label="Processing" icon={Loader2} />;
      default:
        return <StatusBadge status="default" label={status} />;
    }
  };

  if (isLoading) {
    return (
      <PageWrapper>
        <div className="flex items-center justify-center h-64">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
            <Loader2 className="h-8 w-8 text-violet-600" />
          </motion.div>
        </div>
      </PageWrapper>
    );
  }

  const displayEntries = departmentFilter === "all" ? filteredEntries : filteredEntries.filter((e) => e.department === departmentFilter);
  const currentTabEntries = displayEntries;

  return (
    <PageWrapper>
      <motion.div className="space-y-6" initial="hidden" animate="visible" variants={stagger}>
        <motion.div variants={fadeUp}>
          <PageHeader
            title="Payroll Management"
            subtitle="Manage employee salaries, bonuses, and payments"
            actions={
              <div className="flex items-center gap-2 flex-wrap">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" data-testid="button-export-payroll">
                      <Download className="mr-2 h-4 w-4" />
                      Export
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => handleExport("csv")} data-testid="button-export-csv">
                      <FileText className="mr-2 h-4 w-4" />
                      Export as CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExport("json")} data-testid="button-export-json">
                      <FileText className="mr-2 h-4 w-4" />
                      Export as JSON
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    resetForm();
                    setEditingEntry(null);
                    setIsAddEmployeeOpen(true);
                  }}
                  data-testid="button-add-employee"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Employee
                </Button>
                <Button size="sm" onClick={() => setIsRunPayrollOpen(true)} disabled={pendingPayroll === 0} data-testid="button-run-payroll">
                  <Send className="mr-2 h-4 w-4" />
                  Run Payroll
                </Button>
              </div>
            }
          />
        </motion.div>

        <motion.div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" variants={stagger}>
          <motion.div variants={fadeUp}>
            <MetricCard
              title="Total Payroll"
              value={formatCurrency(totalPayroll)}
              icon={Wallet}
              color="violet"
              data-testid="card-total-payroll"
            />
          </motion.div>
          <motion.div variants={fadeUp}>
            <MetricCard
              title="Paid This Month"
              value={formatCurrency(paidThisMonth)}
              icon={CheckCircle2}
              color="emerald"
            />
          </motion.div>
          <motion.div variants={fadeUp}>
            <MetricCard
              title="Pending"
              value={formatCurrency(pendingPayroll)}
              icon={Clock}
              color="amber"
            />
          </motion.div>
          <motion.div variants={fadeUp}>
            <MetricCard
              title="Employees"
              value={String(payrollEntries.length)}
              icon={Users}
              color="cyan"
            />
          </motion.div>
        </motion.div>

        {departments.length > 0 && (
          <motion.div variants={fadeUp}>
            <GlassCard className="p-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Building2 className="h-5 w-5 text-violet-600" />
                  <SectionLabel>Department Breakdown</SectionLabel>
                </div>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                  {departmentStats.map((dept) => {
                    const colorScheme = departmentColors[dept.name] || departmentColors["Engineering"];
                    return (
                      <motion.div
                        key={dept.name}
                        whileHover={{ scale: 1.05 }}
                        onClick={() => setDepartmentFilter(dept.name)}
                        className={`p-4 rounded-lg border transition-all cursor-pointer ${colorScheme.bg} hover:shadow-md`}
                        data-testid={`button-department-${dept.name}`}
                      >
                        <div className={`inline-block px-2 py-1 rounded-full text-xs font-semibold mb-2 ${colorScheme.badge}`}>
                          {dept.name}
                        </div>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{dept.count}</p>
                        <p className={`text-sm font-medium mt-1 ${colorScheme.text}`}>{formatCurrency(dept.total)}</p>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </GlassCard>
          </motion.div>
        )}

        <motion.div variants={fadeUp}>
          <Tabs defaultValue="all" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <TabsList>
                <TabsTrigger value="all" data-testid="tab-all">
                  All ({payrollEntries.length})
                </TabsTrigger>
                <TabsTrigger value="paid" data-testid="tab-paid">
                  Paid ({payrollEntries.filter((e) => e.status === "paid").length})
                </TabsTrigger>
                <TabsTrigger value="pending" data-testid="tab-pending">
                  Pending ({payrollEntries.filter((e) => e.status === "pending").length})
                </TabsTrigger>
                <TabsTrigger value="processing" data-testid="tab-processing">
                  Processing
                </TabsTrigger>
              </TabsList>
              <div className="flex items-center gap-2 flex-col sm:flex-row">
                <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                  <SelectTrigger className="w-40" data-testid="select-department-filter">
                    <SelectValue placeholder="Department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search employees..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                    data-testid="input-search-payroll"
                  />
                </div>
              </div>
            </div>

            {["all", "paid", "pending", "processing"].map((tab) => (
              <TabsContent key={tab} value={tab} className="space-y-4">
                {(tab === "all" ? currentTabEntries : currentTabEntries.filter((e) => e.status === tab)).length > 0 ? (
                  <motion.div className="space-y-3" variants={stagger}>
                    {(tab === "all" ? currentTabEntries : currentTabEntries.filter((e) => e.status === tab)).map((entry, index) => {
                      const colorScheme = departmentColors[entry.department] || departmentColors["Engineering"];
                      return (
                        <motion.div key={entry.id} variants={fadeUp} transition={{ delay: index * 0.05 }}>
                          <AnimatedListItem
                            className={`p-4 rounded-xl border transition-all cursor-default hover:shadow-md ${colorScheme.bg} dark:border-slate-700`}
                            data-testid={`payroll-row-${entry.id}`}
                          >
                            <div className="flex items-center justify-between flex-col sm:flex-row gap-4">
                              <div className="flex items-center gap-4 w-full sm:w-auto">
                                <div className={`h-12 w-12 rounded-full flex items-center justify-center text-white font-semibold bg-gradient-to-br ${getAvatarGradient(entry.employeeName)}`}>
                                  {entry.employeeName.split(" ").map((n) => n[0]).join("")}
                                </div>
                                <div className="flex-1">
                                  <p className="font-semibold text-gray-900 dark:text-white">{entry.employeeName}</p>
                                  <div className="flex items-center gap-2 flex-wrap mt-1">
                                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${colorScheme.badge}`}>
                                      {entry.department}
                                    </span>
                                    {entry.bankName && (
                                      <span className="text-xs text-slate-600 dark:text-slate-400">
                                        {entry.bankName} {entry.accountNumber ? `• ****${entry.accountNumber.slice(-4)}` : ""}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="hidden md:grid grid-cols-3 gap-6 flex-1">
                                <div className="text-center">
                                  <p className="text-xs text-slate-600 dark:text-slate-400 font-medium uppercase">Salary</p>
                                  <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">{formatCurrency(Number(entry.salary))}</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-xs text-slate-600 dark:text-slate-400 font-medium uppercase">Bonus</p>
                                  <p className="text-sm font-semibold text-emerald-600 mt-0.5">+{formatCurrency(Number(entry.bonus))}</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-xs text-slate-600 dark:text-slate-400 font-medium uppercase">Deductions</p>
                                  <p className="text-sm font-semibold text-rose-600 mt-0.5">-{formatCurrency(Number(entry.deductions))}</p>
                                </div>
                              </div>

                              <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                                <div className="text-center sm:text-right">
                                  <p className="text-xs text-slate-600 dark:text-slate-400 font-medium uppercase">Net Pay</p>
                                  <p className="text-lg font-bold text-violet-600 dark:text-violet-400 mt-0.5">{formatCurrency(Number(entry.netPay))}</p>
                                </div>
                                {getStatusBadge(entry.status)}
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`button-payroll-menu-${entry.id}`}>
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setSelectedEntry(entry);
                                        setIsViewPayslipOpen(true);
                                      }}
                                      data-testid={`button-view-payslip-${entry.id}`}
                                    >
                                      <Eye className="h-4 w-4 mr-2" />
                                      View Payslip
                                    </DropdownMenuItem>
                                    {entry.status === "pending" && (
                                      <DropdownMenuItem
                                        onClick={() => {
                                          setSelectedEntry(entry);
                                          setIsPayIndividualOpen(true);
                                        }}
                                        data-testid={`button-pay-now-${entry.id}`}
                                      >
                                        <DollarSign className="h-4 w-4 mr-2" />
                                        Pay Now
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem onClick={() => openEditDialog(entry)} data-testid={`button-edit-payroll-${entry.id}`}>
                                      <Pencil className="h-4 w-4 mr-2" />
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-rose-600 dark:text-rose-400"
                                      onClick={() => {
                                        setSelectedEntry(entry);
                                        setIsDeleteConfirmOpen(true);
                                      }}
                                      data-testid={`button-delete-payroll-${entry.id}`}
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                          </AnimatedListItem>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                ) : (
                  <motion.div variants={fadeUp}>
                    <EmptyState
                      icon={Users}
                      title="No payroll entries"
                      description={`No ${tab !== "all" ? tab : ""} payroll entries found. ${tab === "all" ? "Add your first employee to get started." : ""}`}
                      action={
                        tab === "all" ? (
                          <Button
                            size="sm"
                            onClick={() => {
                              resetForm();
                              setEditingEntry(null);
                              setIsAddEmployeeOpen(true);
                            }}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Add First Employee
                          </Button>
                        ) : undefined
                      }
                    />
                  </motion.div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </motion.div>
      </motion.div>

      <Dialog open={isRunPayrollOpen} onOpenChange={setIsRunPayrollOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Run Payroll</DialogTitle>
            <DialogDescription>Process payments for all pending employees.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <GlassCard className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Total to be paid</span>
                <span className="text-2xl font-bold text-violet-600 dark:text-violet-400">{formatCurrency(pendingPayroll)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">Employees</span>
                <span className="font-semibold">{payrollEntries.filter((e) => e.status === "pending").length} pending</span>
              </div>
            </GlassCard>
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Pending Employees:</p>
              <div className="max-h-40 overflow-y-auto space-y-2">
                {payrollEntries
                  .filter((e) => e.status === "pending")
                  .map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{entry.employeeName}</span>
                      <span className="text-sm font-semibold text-violet-600 dark:text-violet-400">{formatCurrency(Number(entry.netPay))}</span>
                    </div>
                  ))}
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-amber-800 dark:text-amber-200">Funds will be deducted from your main wallet.</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRunPayrollOpen(false)} size="sm">
              Cancel
            </Button>
            <Button onClick={() => processPayrollMutation.mutate()} disabled={processPayrollMutation.isPending || pendingPayroll === 0} size="sm" data-testid="button-confirm-payroll">
              {processPayrollMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Process {formatCurrency(pendingPayroll)}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPayIndividualOpen} onOpenChange={setIsPayIndividualOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pay Individual Employee</DialogTitle>
            <DialogDescription>Process payment for {selectedEntry?.employeeName}</DialogDescription>
          </DialogHeader>
          {selectedEntry && (
            <div className="py-4 space-y-4">
              <div className="flex items-center gap-4 p-4 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
                <div className={`h-12 w-12 rounded-full flex items-center justify-center text-white font-semibold bg-gradient-to-br ${getAvatarGradient(selectedEntry.employeeName)}`}>
                  {selectedEntry.employeeName.split(" ").map((n) => n[0]).join("")}
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">{selectedEntry.employeeName}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{selectedEntry.department}</p>
                </div>
              </div>
              <GlassCard className="p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 dark:text-slate-400 text-sm">Salary</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(Number(selectedEntry.salary))}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 dark:text-slate-400 text-sm">Bonus</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">+{formatCurrency(Number(selectedEntry.bonus))}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 dark:text-slate-400 text-sm">Deductions</span>
                  <span className="font-semibold text-rose-600 dark:text-rose-400">-{formatCurrency(Number(selectedEntry.deductions))}</span>
                </div>
                <div className="flex justify-between items-center border-t border-slate-200 dark:border-slate-700 pt-3">
                  <span className="font-bold text-gray-900 dark:text-white">Net Pay</span>
                  <span className="text-lg font-bold text-violet-600 dark:text-violet-400">{formatCurrency(Number(selectedEntry.netPay))}</span>
                </div>
              </GlassCard>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPayIndividualOpen(false)} size="sm" data-testid="button-cancel-pay">
              Cancel
            </Button>
            <Button
              onClick={() => selectedEntry && payIndividualMutation.mutate(selectedEntry.id)}
              disabled={payIndividualMutation.isPending}
              size="sm"
              data-testid="button-confirm-pay-individual"
            >
              {payIndividualMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <DollarSign className="mr-2 h-4 w-4" />
                  Pay {selectedEntry ? formatCurrency(Number(selectedEntry.netPay)) : formatCurrency(0)}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isViewPayslipOpen} onOpenChange={setIsViewPayslipOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-violet-600" />
              Payslip
            </DialogTitle>
          </DialogHeader>
          {selectedEntry && (
            <div className="space-y-4">
              <div className="text-center pb-4 border-b border-slate-200 dark:border-slate-700">
                <h2 className="text-xl font-bold text-violet-600 dark:text-violet-400">SPENDLY</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Payslip for {new Date(selectedEntry.payDate).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold bg-gradient-to-br ${getAvatarGradient(selectedEntry.employeeName)}`}>
                    {selectedEntry.employeeName.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{selectedEntry.employeeName}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{selectedEntry.department}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 mt-3">
                  <CalendarDays className="h-4 w-4" />
                  <span>Pay Date: {new Date(selectedEntry.payDate).toLocaleDateString()}</span>
                </div>
                {selectedEntry.bankName && (
                  <div className="mt-3 p-3 rounded-lg bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
                    <p className="text-xs text-slate-600 dark:text-slate-400 uppercase font-medium mb-1">Payment Details</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{selectedEntry.bankName}</p>
                    {selectedEntry.accountNumber && (
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        ****{selectedEntry.accountNumber.slice(-4)}
                        {selectedEntry.accountName ? ` - ${selectedEntry.accountName}` : ""}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <GlassCard className="p-4 space-y-0">
                <div className="flex justify-between py-3 border-b border-slate-200 dark:border-slate-700">
                  <span className="text-slate-600 dark:text-slate-400 text-sm">Basic Salary</span>
                  <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(Number(selectedEntry.salary))}</span>
                </div>
                <div className="flex justify-between py-3 border-b border-slate-200 dark:border-slate-700">
                  <span className="text-slate-600 dark:text-slate-400 text-sm">Bonus</span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">+{formatCurrency(Number(selectedEntry.bonus))}</span>
                </div>
                <div className="flex justify-between py-3 border-b border-slate-200 dark:border-slate-700">
                  <span className="text-slate-600 dark:text-slate-400 text-sm">Deductions</span>
                  <span className="font-medium text-rose-600 dark:text-rose-400">-{formatCurrency(Number(selectedEntry.deductions))}</span>
                </div>
                <div className="flex justify-between py-3 font-bold text-gray-900 dark:text-white">
                  <span>Net Pay</span>
                  <span className="text-violet-600 dark:text-violet-400">{formatCurrency(Number(selectedEntry.netPay))}</span>
                </div>
              </GlassCard>

              <div className="flex items-center justify-between pt-2">
                {getStatusBadge(selectedEntry.status)}
                <Button variant="outline" size="sm" onClick={handlePrintPayslip} data-testid="button-print-payslip">
                  <Printer className="mr-2 h-4 w-4" />
                  Print
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isAddEmployeeOpen} onOpenChange={setIsAddEmployeeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingEntry ? "Edit Payroll Entry" : "Add Employee to Payroll"}</DialogTitle>
            <DialogDescription>
              {editingEntry ? "Update the employee's payroll details." : "Add a new employee to the payroll system."}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="employeeName" className="text-slate-700 dark:text-slate-300">
                Employee Name *
              </Label>
              <Input
                id="employeeName"
                value={formData.employeeName}
                onChange={(e) => setFormData({ ...formData, employeeName: e.target.value })}
                placeholder="John Doe"
                className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                data-testid="input-employee-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department" className="text-slate-700 dark:text-slate-300">
                Department
              </Label>
              <Select value={formData.department} onValueChange={(value) => setFormData({ ...formData, department: value })}>
                <SelectTrigger className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700" data-testid="select-department">
                  <SelectValue />
                </SelectTrigger>
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
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-2">
                <Label htmlFor="salary" className="text-slate-700 dark:text-slate-300 text-xs">
                  Salary ({currencySymbol}) *
                </Label>
                <Input
                  id="salary"
                  type="number"
                  value={formData.salary}
                  onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                  placeholder="0"
                  className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                  data-testid="input-salary"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bonus" className="text-slate-700 dark:text-slate-300 text-xs">
                  Bonus ({currencySymbol})
                </Label>
                <Input
                  id="bonus"
                  type="number"
                  value={formData.bonus}
                  onChange={(e) => setFormData({ ...formData, bonus: e.target.value })}
                  placeholder="0"
                  className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                  data-testid="input-bonus"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deductions" className="text-slate-700 dark:text-slate-300 text-xs">
                  Deductions ({currencySymbol})
                </Label>
                <Input
                  id="deductions"
                  type="number"
                  value={formData.deductions}
                  onChange={(e) => setFormData({ ...formData, deductions: e.target.value })}
                  placeholder="0"
                  className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                  data-testid="input-deductions"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payDate" className="text-slate-700 dark:text-slate-300">
                Pay Date
              </Label>
              <Input
                id="payDate"
                type="date"
                value={formData.payDate}
                onChange={(e) => setFormData({ ...formData, payDate: e.target.value })}
                className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                data-testid="input-pay-date"
              />
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
              <h4 className="font-medium text-slate-900 dark:text-white mb-3">Bank Account Details</h4>
              <div className="grid gap-3 grid-cols-2">
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="bankName" className="text-slate-700 dark:text-slate-300 text-sm">
                    Bank Name (Payment Channel)
                  </Label>
                  <Input
                    id="bankName"
                    value={formData.bankName}
                    onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                    placeholder="e.g., First Bank, GTBank, Chase"
                    className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                    data-testid="input-bank-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accountNumber" className="text-slate-700 dark:text-slate-300 text-sm">
                    Account Number
                  </Label>
                  <Input
                    id="accountNumber"
                    value={formData.accountNumber}
                    onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                    placeholder="0123456789"
                    className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                    data-testid="input-account-number"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accountName" className="text-slate-700 dark:text-slate-300 text-sm">
                    Account Name
                  </Label>
                  <Input
                    id="accountName"
                    value={formData.accountName}
                    onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                    placeholder="John Doe"
                    className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                    data-testid="input-account-name"
                  />
                </div>
              </div>
            </div>

            <GlassCard className="p-3">
              <div className="flex justify-between items-center">
                <span className="text-slate-600 dark:text-slate-400 text-sm">Net Pay</span>
                <span className="font-bold text-violet-600 dark:text-violet-400">
                  {formatCurrency((parseFloat(formData.salary) || 0) + (parseFloat(formData.bonus) || 0) - (parseFloat(formData.deductions) || 0))}
                </span>
              </div>
            </GlassCard>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddEmployeeOpen(false)} size="sm">
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending} size="sm" data-testid="button-submit-payroll">
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
            <AlertDialogAction
              onClick={() => selectedEntry && deleteMutation.mutate(selectedEntry.id)}
              className="bg-rose-600 hover:bg-rose-700 dark:bg-rose-700 dark:hover:bg-rose-800"
            >
              {deleteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageWrapper>
  );
}
