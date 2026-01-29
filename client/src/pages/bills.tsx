import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Search,
  FileText,
  Calendar,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Clock,
  MoreVertical,
  Pencil,
  Trash2,
  Loader2,
} from "lucide-react";
import type { Bill } from "@shared/schema";

export default function Bills() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    provider: "",
    amount: "",
    dueDate: "",
    category: "Software",
  });

  const { data: bills, isLoading } = useQuery<Bill[]>({
    queryKey: ["/api/bills"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("POST", "/api/bills", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bills"] });
      toast({ title: "Bill created successfully" });
      setIsOpen(false);
      resetForm();
    },
    onError: () => {
      toast({ title: "Failed to create bill", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Bill> }) => {
      return apiRequest("PATCH", `/api/bills/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bills"] });
      toast({ title: "Bill updated successfully" });
      setIsOpen(false);
      setEditingBill(null);
      resetForm();
    },
    onError: () => {
      toast({ title: "Failed to update bill", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/bills/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bills"] });
      toast({ title: "Bill deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete bill", variant: "destructive" });
    },
  });

  const payBillMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("PATCH", `/api/bills/${id}`, { status: "Paid" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bills"] });
      toast({ title: "Bill marked as paid" });
    },
    onError: () => {
      toast({ title: "Failed to pay bill", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({ name: "", provider: "", amount: "", dueDate: "", category: "Software" });
  };

  const openEditDialog = (bill: Bill) => {
    setEditingBill(bill);
    setFormData({
      name: bill.name,
      provider: bill.provider,
      amount: String(bill.amount),
      dueDate: bill.dueDate,
      category: bill.category,
    });
    setIsOpen(true);
  };

  const handleSubmit = () => {
    if (editingBill) {
      updateMutation.mutate({ id: editingBill.id, data: { ...formData, amount: parseFloat(formData.amount) } });
    } else {
      createMutation.mutate(formData);
    }
  };

  const filteredBills = bills?.filter(
    (bill) =>
      bill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bill.provider.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalBills = bills?.reduce((sum, b) => sum + b.amount, 0) || 0;
  const paidBills = bills?.filter((b) => b.status === "Paid").reduce((sum, b) => sum + b.amount, 0) || 0;
  const unpaidBills = totalBills - paidBills;
  const overdueBills = bills?.filter((b) => b.status === "Overdue").length || 0;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Paid": return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
      case "Unpaid": return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
      case "Overdue": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      default: return "";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Paid": return <CheckCircle className="h-4 w-4" />;
      case "Unpaid": return <Clock className="h-4 w-4" />;
      case "Overdue": return <AlertTriangle className="h-4 w-4" />;
      default: return null;
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight" data-testid="text-bills-title">Bills</h1>
          <p className="text-muted-foreground mt-1">Manage recurring bills and payments.</p>
        </div>
        <Button onClick={() => { resetForm(); setEditingBill(null); setIsOpen(true); }} data-testid="button-add-bill">
          <Plus className="h-4 w-4 mr-2" />
          Add Bill
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Total Bills</p>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </div>
            {isLoading ? <Skeleton className="h-8 w-24" /> : (
              <p className="text-2xl font-black" data-testid="text-total-bills">${totalBills.toLocaleString()}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Paid</p>
              <CheckCircle className="h-4 w-4 text-emerald-600" />
            </div>
            {isLoading ? <Skeleton className="h-8 w-24" /> : (
              <p className="text-2xl font-black text-emerald-600">${paidBills.toLocaleString()}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Unpaid</p>
              <Clock className="h-4 w-4 text-amber-600" />
            </div>
            {isLoading ? <Skeleton className="h-8 w-24" /> : (
              <p className="text-2xl font-black text-amber-600">${unpaidBills.toLocaleString()}</p>
            )}
          </CardContent>
        </Card>
        <Card className={overdueBills > 0 ? "border-red-200 dark:border-red-900" : ""}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Overdue</p>
              <AlertTriangle className={`h-4 w-4 ${overdueBills > 0 ? "text-red-600" : "text-muted-foreground"}`} />
            </div>
            {isLoading ? <Skeleton className="h-8 w-24" /> : (
              <p className={`text-2xl font-black ${overdueBills > 0 ? "text-red-600" : ""}`}>{overdueBills}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search bills..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-search-bills"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-sm font-bold uppercase tracking-widest">All Bills</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-12 w-12 rounded-xl" />
                    <div><Skeleton className="h-4 w-48 mb-2" /><Skeleton className="h-3 w-24" /></div>
                  </div>
                  <Skeleton className="h-5 w-24" />
                </div>
              ))}
            </div>
          ) : filteredBills && filteredBills.length > 0 ? (
            <div className="divide-y divide-border">
              {filteredBills.map((bill) => (
                <div key={bill.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors" data-testid={`bill-row-${bill.id}`}>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate">{bill.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">{bill.provider}</span>
                        <span className="text-xs text-muted-foreground">•</span>
                        <Badge variant="outline" className="text-xs">{bill.category}</Badge>
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-4">
                    <div>
                      <p className="text-base font-bold">${bill.amount.toLocaleString()}</p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <Calendar className="h-3 w-3" />
                        <span>Due {new Date(bill.dueDate).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <Badge variant="secondary" className={`text-xs ${getStatusColor(bill.status)}`}>
                      {getStatusIcon(bill.status)}<span className="ml-1">{bill.status}</span>
                    </Badge>
                    {bill.status === "Unpaid" && (
                      <Button size="sm" onClick={() => payBillMutation.mutate(bill.id)} disabled={payBillMutation.isPending} data-testid={`button-pay-${bill.id}`}>
                        Pay Now
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(bill)}><Pencil className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600" onClick={() => deleteMutation.mutate(bill.id)}><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
              <p className="text-sm text-muted-foreground mb-4">Start by adding your first bill.</p>
              <Button onClick={() => setIsOpen(true)}><Plus className="h-4 w-4 mr-2" />Add Bill</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBill ? "Edit Bill" : "Add New Bill"}</DialogTitle>
            <DialogDescription>{editingBill ? "Update the bill details." : "Add a new recurring bill to track."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Bill Name</Label>
              <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g., AWS Hosting" data-testid="input-bill-name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="provider">Provider</Label>
              <Input id="provider" value={formData.provider} onChange={(e) => setFormData({ ...formData, provider: e.target.value })} placeholder="e.g., Amazon Web Services" data-testid="input-bill-provider" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input id="amount" type="number" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} placeholder="0.00" data-testid="input-bill-amount" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dueDate">Due Date</Label>
                <Input id="dueDate" type="date" value={formData.dueDate} onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })} data-testid="input-bill-due-date" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                <SelectTrigger data-testid="select-bill-category"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Software">Software</SelectItem>
                  <SelectItem value="Office">Office</SelectItem>
                  <SelectItem value="Utilities">Utilities</SelectItem>
                  <SelectItem value="Marketing">Marketing</SelectItem>
                  <SelectItem value="Legal">Legal</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-bill">
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingBill ? "Update Bill" : "Add Bill"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
