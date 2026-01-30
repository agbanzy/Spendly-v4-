import { useState, useMemo, useEffect } from "react";
import { useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  Paperclip,
  Users,
  Image,
  FileText,
  X,
  CreditCard,
  FileQuestion,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Expense, TeamMember, Vendor, CompanySettings } from "@shared/schema";

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
  const searchParams = useSearch();
  const [open, setOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [selectedReviewers, setSelectedReviewers] = useState<string[]>([]);
  const [expenseType, setExpenseType] = useState<'spent' | 'request'>('request');
  const [isUploading, setIsUploading] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");
  const { toast } = useToast();

  // Handle quick action to open new expense dialog
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    const action = params.get('action');
    if (action === 'new') {
      setOpen(true);
      window.history.replaceState({}, '', '/expenses');
    }
  }, [searchParams]);

  const { data: settings } = useQuery<CompanySettings>({
    queryKey: ["/api/settings"],
  });

  // Currency formatting
  const currencySymbols: Record<string, string> = {
    USD: "$", EUR: "€", GBP: "£", NGN: "₦", KES: "KSh", GHS: "₵", ZAR: "R"
  };
  const currency = settings?.currency || "USD";
  const currencySymbol = currencySymbols[currency] || "$";
  
  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) || 0 : amount;
    return `${currencySymbol}${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const { data: expenses, isLoading } = useQuery<Expense[]>({
    queryKey: ["/api/expenses"],
  });

  const { data: teamMembers } = useQuery<TeamMember[]>({
    queryKey: ["/api/team"],
  });

  const { data: vendors } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
  });

  const filteredExpenses = useMemo(() => {
    if (!expenses) return [];
    return expenses.filter((expense) => {
      const matchesSearch = expense.merchant.toLowerCase().includes(searchQuery.toLowerCase()) ||
        expense.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        expense.note?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || expense.status === statusFilter;
      const matchesCategory = categoryFilter === "all" || expense.category === categoryFilter;
      const matchesType = typeFilter === "all" || expense.expenseType === typeFilter;
      return matchesSearch && matchesStatus && matchesCategory && matchesType;
    });
  }, [expenses, searchQuery, statusFilter, categoryFilter, typeFilter]);

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
      setExpenseType('request');
      setSelectedReviewers([]);
      setAttachmentFiles([]);
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
    mutationFn: async ({ id, vendorId }: { id: string; vendorId?: string }) => {
      return apiRequest("POST", `/api/expenses/${id}/approve-and-pay`, { 
        approvedBy: "admin",
        vendorId,
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payouts"] });
      toast({ 
        title: "Expense Approved", 
        description: data.payout ? "Payout created and queued for processing" : "Expense approved"
      });
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

  const uploadFile = async (file: File): Promise<string | null> => {
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

  const handleAttachmentAdd = (e: { target: HTMLInputElement }) => {
    const files = e.target.files;
    if (files) {
      const newFiles = Array.from(files);
      setAttachmentFiles(prev => [...prev, ...newFiles]);
    }
    e.target.value = '';
  };

  const handleAttachmentRemove = (index: number) => {
    setAttachmentFiles(prev => prev.filter((_, i) => i !== index));
  };

  const toggleReviewer = (memberId: string) => {
    setSelectedReviewers(prev => 
      prev.includes(memberId) 
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const onSubmit = async (data: any) => {
    setIsUploading(true);
    try {
      const attachmentUrls: string[] = [];
      for (const file of attachmentFiles) {
        const url = await uploadFile(file);
        if (url) {
          attachmentUrls.push(url);
        }
      }
      
      const receiptUrl = attachmentUrls.length > 0 ? attachmentUrls[0] : undefined;
      
      createExpense.mutate({
        ...data,
        amount: parseFloat(data.amount),
        receiptUrl,
        expenseType,
        attachments: attachmentUrls,
        taggedReviewers: selectedReviewers,
      });
      setAttachmentFiles([]);
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
    const headers = ["Merchant", "Amount", "Currency", "Category", "Date", "Status", "Type", "User", "Note"];
    const csvContent = [
      headers.join(","),
      ...filteredExpenses.map(e => 
        [e.merchant, e.amount, e.currency, e.category, e.date, e.status, e.expenseType || 'request', e.user, e.note || ""].map(escapeCSVField).join(",")
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

  const getTypeIcon = (type: string | undefined) => {
    if (type === 'spent') {
      return <CreditCard className="h-3 w-3" />;
    }
    return <FileQuestion className="h-3 w-3" />;
  };

  const getTypeColor = (type: string | undefined) => {
    if (type === 'spent') {
      return "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400";
    }
    return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
  };

  const getMemberById = (id: string) => {
    return teamMembers?.find(m => m.id === id);
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
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Expense</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Expense Type Selection */}
              <div className="space-y-2">
                <Label>Expense Type</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setExpenseType('spent')}
                    className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
                      expenseType === 'spent' 
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' 
                        : 'border-border hover:border-muted-foreground'
                    }`}
                    data-testid="button-type-spent"
                  >
                    <CreditCard className={`h-5 w-5 ${expenseType === 'spent' ? 'text-indigo-600' : 'text-muted-foreground'}`} />
                    <span className={`text-sm font-medium ${expenseType === 'spent' ? 'text-indigo-700 dark:text-indigo-400' : ''}`}>
                      Already Spent
                    </span>
                    <span className="text-xs text-muted-foreground text-center">
                      Reimbursement request
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpenseType('request')}
                    className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
                      expenseType === 'request' 
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' 
                        : 'border-border hover:border-muted-foreground'
                    }`}
                    data-testid="button-type-request"
                  >
                    <FileQuestion className={`h-5 w-5 ${expenseType === 'request' ? 'text-purple-600' : 'text-muted-foreground'}`} />
                    <span className={`text-sm font-medium ${expenseType === 'request' ? 'text-purple-700 dark:text-purple-400' : ''}`}>
                      Fresh Request
                    </span>
                    <span className="text-xs text-muted-foreground text-center">
                      Needs approval first
                    </span>
                  </button>
                </div>
              </div>

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

              {/* Attachments Section */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Paperclip className="h-4 w-4" />
                  Attachments
                </Label>
                <div className="border rounded-lg p-3 space-y-3">
                  {attachmentFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {attachmentFiles.map((file, index) => (
                        <div key={index} className="flex items-center gap-2 bg-muted rounded-md px-2 py-1">
                          {file.type.startsWith('image/') ? (
                            <Image className="h-3 w-3 text-blue-500" />
                          ) : (
                            <FileText className="h-3 w-3 text-amber-500" />
                          )}
                          <span className="text-xs truncate max-w-[120px]">{file.name}</span>
                          <button
                            type="button"
                            onClick={() => handleAttachmentRemove(index)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Input
                      type="file"
                      accept="image/*,application/pdf"
                      multiple
                      onChange={handleAttachmentAdd}
                      className="flex-1"
                      data-testid="input-attachments"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Upload receipts, invoices, or supporting documents (JPEG, PNG, PDF)
                  </p>
                </div>
              </div>

              {/* Tag Reviewers Section */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Tag Reviewers for Re-evaluation
                </Label>
                <div className="border rounded-lg p-3 max-h-40 overflow-y-auto">
                  {teamMembers && teamMembers.length > 0 ? (
                    <div className="space-y-2">
                      {teamMembers.filter(m => m.status === 'Active').map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center gap-3 p-2 rounded-md hover:bg-muted cursor-pointer"
                          onClick={() => toggleReviewer(member.id)}
                          data-testid={`reviewer-${member.id}`}
                        >
                          <Checkbox
                            checked={selectedReviewers.includes(member.id)}
                            onCheckedChange={() => toggleReviewer(member.id)}
                          />
                          <Avatar className="h-7 w-7">
                            <AvatarFallback className="text-xs bg-primary/10">
                              {member.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{member.name}</p>
                            <p className="text-xs text-muted-foreground">{member.role}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      No team members available
                    </p>
                  )}
                </div>
                {selectedReviewers.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {selectedReviewers.length} reviewer(s) selected
                  </p>
                )}
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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
            <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1">
              Reimbursements
            </p>
            <p className="text-2xl font-black text-indigo-600">
              {expenses?.filter((e) => e.expenseType === "spent").length || 0}
            </p>
          </CardContent>
        </Card>
        <Card className="glass card-hover">
          <CardContent className="p-4">
            <p className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-widest mb-1">
              Requests
            </p>
            <p className="text-2xl font-black text-purple-600">
              {expenses?.filter((e) => e.expenseType === "request" || !e.expenseType).length || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search expenses..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search-expenses"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full md:w-40" data-testid="select-type-filter">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="spent">Reimbursement</SelectItem>
                <SelectItem value="request">Request</SelectItem>
              </SelectContent>
            </Select>
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
                  <div className="flex items-center gap-4 cursor-pointer flex-1 min-w-0" onClick={() => handleViewDetail(expense)}>
                    <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
                      {expense.merchant[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold truncate">{expense.merchant}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="secondary" className={`text-xs ${getTypeColor(expense.expenseType)}`}>
                          {getTypeIcon(expense.expenseType)}
                          <span className="ml-1">{expense.expenseType === 'spent' ? 'Reimbursement' : 'Request'}</span>
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {expense.category}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(expense.date).toLocaleDateString()}
                        </span>
                        {expense.attachments && expense.attachments.length > 0 && (
                          <Badge variant="outline" className="text-xs">
                            <Paperclip className="h-3 w-3 mr-1" />
                            {expense.attachments.length}
                          </Badge>
                        )}
                        {expense.taggedReviewers && expense.taggedReviewers.length > 0 && (
                          <Badge variant="outline" className="text-xs">
                            <Users className="h-3 w-3 mr-1" />
                            {expense.taggedReviewers.length}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
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
                        <Button size="icon" variant="ghost" onClick={() => approveExpense.mutate({ id: expense.id, vendorId: expense.vendorId || undefined })} disabled={approveExpense.isPending} data-testid={`button-approve-${expense.id}`}>
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
                        <DropdownMenuItem onClick={() => handleDelete(expense)} className="text-red-600">
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Expense Details</DialogTitle>
          </DialogHeader>
          {selectedExpense && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-indigo-600 dark:text-indigo-400 text-2xl">
                  {selectedExpense.merchant[0]?.toUpperCase()}
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-lg">{selectedExpense.merchant}</h3>
                  <div className="flex gap-2">
                    <Badge className={getStatusColor(selectedExpense.status)}>
                      {getStatusIcon(selectedExpense.status)}
                      <span className="ml-1">{selectedExpense.status}</span>
                    </Badge>
                    <Badge className={getTypeColor(selectedExpense.expenseType)}>
                      {getTypeIcon(selectedExpense.expenseType)}
                      <span className="ml-1">{selectedExpense.expenseType === 'spent' ? 'Reimbursement' : 'Request'}</span>
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-bold">Amount</p>
                  <p className="font-bold text-lg">{formatCurrency(selectedExpense.amount)}</p>
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

              {/* Attachments Display */}
              {selectedExpense.attachments && selectedExpense.attachments.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-bold mb-2">
                    Attachments ({selectedExpense.attachments.length})
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedExpense.attachments.map((url, index) => (
                      <a
                        key={index}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="border rounded-lg p-2 flex items-center gap-2 hover:bg-muted transition-colors"
                      >
                        {url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                          <Image className="h-4 w-4 text-blue-500" />
                        ) : (
                          <FileText className="h-4 w-4 text-amber-500" />
                        )}
                        <span className="text-xs truncate">Attachment {index + 1}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Tagged Reviewers Display */}
              {selectedExpense.taggedReviewers && selectedExpense.taggedReviewers.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-bold mb-2">
                    Tagged Reviewers ({selectedExpense.taggedReviewers.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedExpense.taggedReviewers.map((reviewerId) => {
                      const member = getMemberById(reviewerId);
                      return (
                        <div key={reviewerId} className="flex items-center gap-2 bg-muted rounded-full px-3 py-1">
                          <Avatar className="h-5 w-5">
                            <AvatarFallback className="text-xs">
                              {member?.name.split(' ').map(n => n[0]).join('').toUpperCase() || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs font-medium">{member?.name || 'Unknown'}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {selectedExpense.receiptUrl && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-bold mb-2">Receipt</p>
                  <a href={selectedExpense.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 underline text-sm">
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
                    <Button variant="default" onClick={() => { approveExpense.mutate({ id: selectedExpense.id, vendorId: selectedExpense.vendorId || undefined }); setDetailOpen(false); }}>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve & Pay
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
