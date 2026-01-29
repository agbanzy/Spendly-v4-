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
import { 
  Users, 
  Calendar, 
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
} from "lucide-react";
import type { TeamMember, PayrollEntry } from "@shared/schema";

export default function PayrollPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isRunPayrollOpen, setIsRunPayrollOpen] = useState(false);
  const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<PayrollEntry | null>(null);
  const [formData, setFormData] = useState({
    employeeName: "",
    department: "Engineering",
    salary: "",
    bonus: "",
    deductions: "",
    payDate: new Date().toISOString().split('T')[0],
  });

  const { data: payrollEntries = [], isLoading } = useQuery<PayrollEntry[]>({
    queryKey: ["/api/payroll"]
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("POST", "/api/payroll", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payroll"] });
      toast({ title: "Employee added to payroll" });
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

  const resetForm = () => {
    setFormData({
      employeeName: "",
      department: "Engineering",
      salary: "",
      bonus: "",
      deductions: "",
      payDate: new Date().toISOString().split('T')[0],
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
    });
    setIsAddEmployeeOpen(true);
  };

  const handleSubmit = () => {
    const salary = parseFloat(formData.salary) || 0;
    const bonus = parseFloat(formData.bonus) || 0;
    const deductions = parseFloat(formData.deductions) || 0;
    
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

  const totalPayroll = payrollEntries.reduce((sum, entry) => sum + entry.netPay, 0);
  const pendingPayroll = payrollEntries.filter(e => e.status === "pending").reduce((sum, e) => sum + e.netPay, 0);
  const paidThisMonth = payrollEntries.filter(e => e.status === "paid").reduce((sum, e) => sum + e.netPay, 0);

  const filteredEntries = payrollEntries.filter(entry =>
    entry.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    entry.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: PayrollEntry["status"]) => {
    switch (status) {
      case "paid":
        return <Badge variant="default" className="bg-emerald-500"><CheckCircle2 className="mr-1 h-3 w-3" />Paid</Badge>;
      case "pending":
        return <Badge variant="outline"><Clock className="mr-1 h-3 w-3" />Pending</Badge>;
      case "processing":
        return <Badge variant="secondary"><Loader2 className="mr-1 h-3 w-3 animate-spin" />Processing</Badge>;
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 texture-mesh min-h-screen">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-payroll-title">Payroll</h1>
          <p className="text-muted-foreground">Manage employee salaries and payments</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" data-testid="button-export-payroll"><Download className="mr-2 h-4 w-4" />Export</Button>
          <Button variant="outline" onClick={() => { resetForm(); setEditingEntry(null); setIsAddEmployeeOpen(true); }} data-testid="button-add-employee">
            <Plus className="mr-2 h-4 w-4" />Add Employee
          </Button>
          <Button onClick={() => setIsRunPayrollOpen(true)} data-testid="button-run-payroll">
            <Send className="mr-2 h-4 w-4" />Run Payroll
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="hover-elevate" data-testid="card-total-payroll">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900 text-indigo-600"><Wallet className="h-5 w-5" /></div>
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
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900 text-emerald-600"><CheckCircle2 className="h-5 w-5" /></div>
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
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900 text-amber-600"><Clock className="h-5 w-5" /></div>
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
              <div className="p-2 rounded-lg bg-cyan-100 dark:bg-cyan-900 text-cyan-600"><Users className="h-5 w-5" /></div>
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
            <Input placeholder="Search employees..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" data-testid="input-search-payroll" />
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
                        </div>
                      </div>
                      <div className="hidden md:flex items-center gap-8">
                        <div className="text-right"><p className="text-sm text-muted-foreground">Salary</p><p className="font-medium">${entry.salary.toLocaleString()}</p></div>
                        <div className="text-right"><p className="text-sm text-muted-foreground">Bonus</p><p className="font-medium text-emerald-600">+${entry.bonus.toLocaleString()}</p></div>
                        <div className="text-right"><p className="text-sm text-muted-foreground">Deductions</p><p className="font-medium text-rose-600">-${entry.deductions.toLocaleString()}</p></div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right"><p className="text-sm text-muted-foreground">Net Pay</p><p className="text-lg font-bold">${entry.netPay.toLocaleString()}</p></div>
                        {getStatusBadge(entry.status)}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(entry)}><Pencil className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600" onClick={() => deleteMutation.mutate(entry.id)}><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                  {(tab === "all" ? filteredEntries : filteredEntries.filter(e => e.status === tab)).length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">No payroll entries found</div>
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
                <span className="text-2xl font-bold">${pendingPayroll.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Employees</span>
                <span>{payrollEntries.filter(e => e.status === "pending").length} pending</span>
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
              {processPayrollMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</> : <><Send className="mr-2 h-4 w-4" />Process Payroll</>}
            </Button>
          </DialogFooter>
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
              <Label htmlFor="employeeName">Employee Name</Label>
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
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="salary">Salary ($)</Label>
                <Input id="salary" type="number" value={formData.salary} onChange={(e) => setFormData({ ...formData, salary: e.target.value })} placeholder="0" data-testid="input-salary" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bonus">Bonus ($)</Label>
                <Input id="bonus" type="number" value={formData.bonus} onChange={(e) => setFormData({ ...formData, bonus: e.target.value })} placeholder="0" data-testid="input-bonus" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deductions">Deductions ($)</Label>
                <Input id="deductions" type="number" value={formData.deductions} onChange={(e) => setFormData({ ...formData, deductions: e.target.value })} placeholder="0" data-testid="input-deductions" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payDate">Pay Date</Label>
              <Input id="payDate" type="date" value={formData.payDate} onChange={(e) => setFormData({ ...formData, payDate: e.target.value })} data-testid="input-pay-date" />
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Net Pay</span>
                <span className="font-bold">${((parseFloat(formData.salary) || 0) + (parseFloat(formData.bonus) || 0) - (parseFloat(formData.deductions) || 0)).toLocaleString()}</span>
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
    </div>
  );
}
