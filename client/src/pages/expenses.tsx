import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Search,
  Receipt,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  MoreVertical,
  Edit,
  Trash2,
  Download,
  Filter,
  Upload,
  Eye,
  DollarSign,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Expense } from "@shared/schema";

const categories = [
  "Software",
  "Travel",
  "Office",
  "Marketing",
  "Food",
  "Equipment",
  "Utilities",
  "Legal",
  "Other",
];

export default function Expenses() {
  const [open, setOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const { data: expenses, isLoading } = useQuery<Expense[]>({
    queryKey: ["/api/expenses"],
  });

  const filteredExpenses = useMemo(() => {
    if (!expenses) return [];
    return expenses.filter((expense) => {
      const matchesSearch = expense.merchant.toLowerCase().includes(searchQuery.toLowerCase()) ||
        expense.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        expense.note?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || expense.status === statusFilter;
      const matchesCategory = categoryFilter === "all" || expense.category === categoryFilter;
      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [expenses, searchQuery, statusFilter, categoryFilter]);

  const { register, handleSubmit, reset, setValue, watch } = useForm({
    defaultValues: {
      merchant: "",
      amount: "",
      category: "Software",
      note: "",
    },
  });

  const editForm = useForm({
    defaultValues: {
      merchant: "",
      amount: "",
      category: "Software",
      note: "",
    },
  });

  const createExpense = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/expenses", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      toast({ title: "Expense created successfully" });
      setOpen(false);
      reset();
    },
    onError: () => {
      toast({ title: "Failed to create expense", variant: "destructive" });
    },
  });

  const updateExpense = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest("PATCH", `/api/expenses/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      toast({ title: "Expense updated successfully" });
      setEditOpen(false);
      setSelectedExpense(null);
    },
    onError: () => {
      toast({ title: "Failed to update expense", variant: "destructive" });
    },
  });

  const deleteExpense = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/expenses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      toast({ title: "Expense deleted successfully" });
      setDeleteOpen(false);
      setSelectedExpense(null);
    },
    onError: () => {
      toast({ title: "Failed to delete expense", variant: "destructive" });
    },
  });

  const approveExpense = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("PATCH", `/api/expenses/${id}`, { status: "APPROVED" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      toast({ title: "Expense approved" });
    },
    onError: () => {
      toast({ title: "Failed to approve expense", variant: "destructive" });
    },
  });

  const rejectExpense = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("PATCH", `/api/expenses/${id}`, { status: "REJECTED" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      toast({ title: "Expense rejected" });
    },
    onError: () => {
      toast({ title: "Failed to reject expense", variant: "destructive" });
    },
  });

  const markAsPaid = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("PATCH", `/api/expenses/${id}`, { status: "PAID" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      toast({ title: "Expense marked as paid" });
    },
    onError: () => {
      toast({ title: "Failed to update expense", variant: "destructive" });
    },
  });

  const uploadReceipt = async (file: File): Promise<string | null> => {
    const formData = new FormData();
    formData.append('receipt', file);
    
    try {
      const response = await fetch('/api/upload/receipt', {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();
      if (result.success) {
        return result.url;
      }
      return null;
    } catch (error) {
      console.error('Upload failed:', error);
      return null;
    }
  };

  const onSubmit = async (data: any) => {
    setIsUploading(true);
    try {
      let receiptUrl = undefined;
      if (receiptFile) {
        receiptUrl = await uploadReceipt(receiptFile);
        if (!receiptUrl) {
          toast({ title: "Failed to upload receipt", variant: "destructive" });
          setIsUploading(false);
          return;
        }
      }
      
      createExpense.mutate({
        ...data,
        amount: parseFloat(data.amount),
        receiptUrl,
      });
      setReceiptFile(null);
    } finally {
      setIsUploading(false);
    }
  };

  const onEditSubmit = (data: any) => {
    if (!selectedExpense) return;
    updateExpense.mutate({
      id: selectedExpense.id,
      data: {
        ...data,
        amount: parseFloat(data.amount),
      },
    });
  };

  const handleEdit = (expense: Expense) => {
    setSelectedExpense(expense);
    editForm.reset({
      merchant: expense.merchant,
      amount: expense.amount.toString(),
      category: expense.category,
      note: expense.note || "",
    });
    setEditOpen(true);
  };

  const handleViewDetail = (expense: Expense) => {
    setSelectedExpense(expense);
    setDetailOpen(true);
  };

  const handleDelete = (expense: Expense) => {
    setSelectedExpense(expense);
    setDeleteOpen(true);
  };

  const escapeCSVField = (field: string | number | undefined): string => {
    if (field === undefined || field === null) return '""';
    const str = String(field);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const exportToCSV = () => {
    if (!filteredExpenses.length) return;
    const headers = ["Merchant", "Amount", "Currency", "Category", "Date", "Status", "User", "Note"];
    const csvContent = [
      headers.join(","),
      ...filteredExpenses.map(e => 
        [e.merchant, e.amount, e.currency, e.category, e.date, e.status, e.user, e.note || ""].map(escapeCSVField).join(",")
      )
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `expenses-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast({ title: "Expenses exported successfully" });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "PAID":
        return <CheckCircle className="h-4 w-4 text-emerald-600" />;
      case "APPROVED":
        return <CheckCircle className="h-4 w-4 text-blue-600" />;
      case "REJECTED":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "PENDING":
        return <Clock className="h-4 w-4 text-amber-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-slate-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PAID":
        return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
      case "APPROVED":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      case "REJECTED":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      case "PENDING":
        return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
      default:
        return "";
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 texture-mesh min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight" data-testid="text-expenses-title">
            Expenses
          </h1>
          <p className="text-muted-foreground mt-1">
            Track and manage all company expenses.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-expense">
              <Plus className="h-4 w-4 mr-2" />
              Add Expense
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Expense</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="merchant">Merchant</Label>
                <Input
                  id="merchant"
                  placeholder="e.g., Amazon, Uber"
                  {...register("merchant", { required: true })}
                  data-testid="input-merchant"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (USD)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  {...register("amount", { required: true })}
                  data-testid="input-amount"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  onValueChange={(value) => setValue("category", value)}
                  defaultValue="Software"
                >
                  <SelectTrigger data-testid="select-category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="note">Note (Optional)</Label>
                <Textarea
                  id="note"
                  placeholder="Add a note..."
                  {...register("note")}
                  data-testid="input-note"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="receipt">Receipt (Optional)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="receipt"
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                    className="flex-1"
                    data-testid="input-receipt"
                  />
                  {receiptFile && (
                    <Badge variant="secondary" className="text-xs">
                      <Upload className="h-3 w-3 mr-1" />
                      {receiptFile.name.substring(0, 15)}...
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Accepted formats: JPEG, PNG, GIF, PDF (max 5MB)
                </p>
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={createExpense.isPending || isUploading}
                data-testid="button-submit-expense"
              >
                {isUploading ? "Uploading..." : createExpense.isPending ? "Creating..." : "Create Expense"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="glass card-hover">
          <CardContent className="p-4">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">
              Total
            </p>
            <p className="text-2xl font-black">{expenses?.length || 0}</p>
          </CardContent>
        </Card>
        <Card className="glass card-hover">
          <CardContent className="p-4">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">
              Pending
            </p>
            <p className="text-2xl font-black text-amber-600">
              {expenses?.filter((e) => e.status === "PENDING").length || 0}
            </p>
          </CardContent>
        </Card>
        <Card className="glass card-hover">
          <CardContent className="p-4">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">
              Approved
            </p>
            <p className="text-2xl font-black text-emerald-600">
              {expenses?.filter((e) => e.status === "APPROVED" || e.status === "PAID").length || 0}
            </p>
          </CardContent>
        </Card>
        <Card className="glass card-hover">
          <CardContent className="p-4">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">
              This Month
            </p>
            <p className="text-2xl font-black">
              ${expenses?.reduce((sum, e) => sum + e.amount, 0).toLocaleString() || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search expenses..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search-expenses"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-40" data-testid="select-status-filter">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="PAID">Paid</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full md:w-40" data-testid="select-category-filter">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={exportToCSV} disabled={!filteredExpenses.length} data-testid="button-export-expenses">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Expenses List */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-sm font-bold uppercase tracking-widest">
            All Expenses
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
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
          ) : filteredExpenses && filteredExpenses.length > 0 ? (
            <div className="divide-y divide-border">
              {filteredExpenses.map((expense) => (
                <div
                  key={expense.id}
                  className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                  data-testid={`expense-row-${expense.id}`}
                >
                  <div className="flex items-center gap-4 cursor-pointer" onClick={() => handleViewDetail(expense)}>
                    <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-primary">
                      {expense.merchant[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate">{expense.merchant}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {expense.category}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(expense.date).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-base font-bold">
                        ${expense.amount.toLocaleString()}
                      </p>
                      <Badge
                        variant="secondary"
                        className={`text-xs ${getStatusColor(expense.status)}`}
                      >
                        {getStatusIcon(expense.status)}
                        <span className="ml-1">{expense.status}</span>
                      </Badge>
                    </div>
                    {expense.status === "PENDING" && (
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => approveExpense.mutate(expense.id)} disabled={approveExpense.isPending} data-testid={`button-approve-${expense.id}`}>
                          <CheckCircle className="h-4 w-4 text-emerald-600" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => rejectExpense.mutate(expense.id)} disabled={rejectExpense.isPending} data-testid={`button-reject-${expense.id}`}>
                          <XCircle className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    )}
                    {expense.status === "APPROVED" && (
                      <Button size="icon" variant="ghost" onClick={() => markAsPaid.mutate(expense.id)} disabled={markAsPaid.isPending} data-testid={`button-pay-${expense.id}`}>
                        <DollarSign className="h-4 w-4 text-blue-600" />
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" data-testid={`button-expense-menu-${expense.id}`}>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleViewDetail(expense)}>
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEdit(expense)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(expense)}>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Receipt className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-bold mb-1">No expenses yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Start by adding your first expense.
              </p>
              <Button onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Expense
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Expense Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Expense Details</DialogTitle>
          </DialogHeader>
          {selectedExpense && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-primary text-2xl">
                  {selectedExpense.merchant[0]?.toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-lg">{selectedExpense.merchant}</h3>
                  <Badge className={getStatusColor(selectedExpense.status)}>
                    {getStatusIcon(selectedExpense.status)}
                    <span className="ml-1">{selectedExpense.status}</span>
                  </Badge>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-bold">Amount</p>
                  <p className="font-bold text-lg">${selectedExpense.amount.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-bold">Category</p>
                  <p className="font-medium">{selectedExpense.category}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-bold">Date</p>
                  <p className="font-medium">{new Date(selectedExpense.date).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-bold">Submitted By</p>
                  <p className="font-medium">{selectedExpense.user}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-bold">Department</p>
                  <p className="font-medium">{selectedExpense.department}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-bold">Currency</p>
                  <p className="font-medium">{selectedExpense.currency}</p>
                </div>
              </div>
              {selectedExpense.note && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-bold">Note</p>
                  <p className="text-sm mt-1">{selectedExpense.note}</p>
                </div>
              )}
              {selectedExpense.receiptUrl && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-bold mb-2">Receipt</p>
                  <a href={selectedExpense.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline text-sm">
                    View Receipt
                  </a>
                </div>
              )}
              <DialogFooter className="flex gap-2">
                {selectedExpense.status === "PENDING" && (
                  <>
                    <Button variant="outline" className="text-red-600" onClick={() => { rejectExpense.mutate(selectedExpense.id); setDetailOpen(false); }}>
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                    <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => { approveExpense.mutate(selectedExpense.id); setDetailOpen(false); }}>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve
                    </Button>
                  </>
                )}
                {selectedExpense.status === "APPROVED" && (
                  <Button onClick={() => { markAsPaid.mutate(selectedExpense.id); setDetailOpen(false); }}>
                    <DollarSign className="h-4 w-4 mr-2" />
                    Mark as Paid
                  </Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Expense Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Expense</DialogTitle>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-merchant">Merchant</Label>
              <Input id="edit-merchant" placeholder="e.g., Amazon, Uber" {...editForm.register("merchant", { required: true })} data-testid="input-edit-merchant" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-amount">Amount (USD)</Label>
              <Input id="edit-amount" type="number" step="0.01" placeholder="0.00" {...editForm.register("amount", { required: true })} data-testid="input-edit-amount" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-category">Category</Label>
              <Select onValueChange={(value) => editForm.setValue("category", value)} value={editForm.watch("category")}>
                <SelectTrigger data-testid="select-edit-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-note">Note (Optional)</Label>
              <Textarea id="edit-note" placeholder="Add a note..." {...editForm.register("note")} data-testid="input-edit-note" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={updateExpense.isPending} data-testid="button-update-expense">
                {updateExpense.isPending ? "Updating..." : "Update Expense"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Expense Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Expense</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Are you sure you want to delete this expense from <strong>{selectedExpense?.merchant}</strong>? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => selectedExpense && deleteExpense.mutate(selectedExpense.id)} disabled={deleteExpense.isPending} data-testid="button-confirm-delete">
              {deleteExpense.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
