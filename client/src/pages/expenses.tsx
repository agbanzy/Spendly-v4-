import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatCurrencyAmount } from "@/lib/constants";
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
import { motion } from "framer-motion";
import {
  PageWrapper,
  PageHeader,
  MetricCard,
  StatusBadge,
  AnimatedListItem,
  EmptyState,
  SectionLabel,
  GlassCard,
  FormField,
  SuccessFeedback,
  WarningFeedback,
  fadeUp,
  stagger,
} from "@/components/ui-extended";

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
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [selectedReviewers, setSelectedReviewers] = useState<string[]>([]);
  const [expenseType, setExpenseType] = useState<'spent' | 'request'>('request');
  const [isUploading, setIsUploading] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");
  const { toast } = useToast();

  // Handle quick action to open new expense dialog (runs once on mount)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    if (action === 'new') {
      setOpen(true);
      window.history.replaceState({}, '', '/expenses');
    }
  }, []);

  const { data: settings } = useQuery<CompanySettings>({
    queryKey: ["/api/settings"],
  });

  const currency = settings?.currency || "USD";

  const formatCurrency = (amount: number | string) => {
    return formatCurrencyAmount(amount, currency);
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
    <PageWrapper>
      <motion.div initial="hidden" animate="visible" variants={fadeUp} className="space-y-8">
        {/* Header Section */}
        <PageHeader
          title="Expenses"
          subtitle="Track and manage all company expenses"
          actions={
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-700 hover:to-violet-800" data-testid="button-add-expense">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Expense
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add New Expense</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                  {/* Expense Type Selection */}
                  <div className="space-y-3">
                    <SectionLabel>Expense Type</SectionLabel>
                    <div className="grid grid-cols-2 gap-3">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="button"
                        onClick={() => setExpenseType('spent')}
                        className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${
                          expenseType === 'spent'
                            ? 'border-emerald-500 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20'
                            : 'border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-600'
                        }`}
                        data-testid="button-type-spent"
                      >
                        <CreditCard className={`h-5 w-5 ${expenseType === 'spent' ? 'text-emerald-600' : 'text-slate-400'}`} />
                        <span className={`text-sm font-semibold ${expenseType === 'spent' ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}`}>
                          Already Spent
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 text-center">
                          Reimbursement
                        </span>
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="button"
                        onClick={() => setExpenseType('request')}
                        className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${
                          expenseType === 'request'
                            ? 'border-violet-500 bg-gradient-to-br from-violet-50 to-violet-100 dark:from-violet-900/20 dark:to-violet-800/20'
                            : 'border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-600'
                        }`}
                        data-testid="button-type-request"
                      >
                        <FileQuestion className={`h-5 w-5 ${expenseType === 'request' ? 'text-violet-600' : 'text-slate-400'}`} />
                        <span className={`text-sm font-semibold ${expenseType === 'request' ? 'text-violet-700 dark:text-violet-400' : 'text-slate-700 dark:text-slate-300'}`}>
                          Fresh Request
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 text-center">
                          Needs approval
                        </span>
                      </motion.button>
                    </div>
                  </div>

                  <FormField label="Merchant" required>
                    <Input
                      id="merchant"
                      placeholder="e.g., Amazon, Uber"
                      {...register("merchant", { required: true })}
                      className="bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-700 rounded-xl h-11"
                      data-testid="input-merchant"
                    />
                  </FormField>

                  <FormField label="Amount" required>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      {...register("amount", { required: true })}
                      className="bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-700 rounded-xl h-11"
                      data-testid="input-amount"
                    />
                  </FormField>

                  <div className="space-y-2">
                    <SectionLabel>Category</SectionLabel>
                    <Select
                      onValueChange={(value) => setValue("category", value)}
                      defaultValue="Software"
                    >
                      <SelectTrigger className="rounded-xl h-11 bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-700" data-testid="select-category">
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

                  <FormField label="Note (Optional)">
                    <Textarea
                      id="note"
                      placeholder="Add a note..."
                      {...register("note")}
                      className="bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-700 rounded-xl"
                      data-testid="input-note"
                    />
                  </FormField>

                  {/* Attachments Section */}
                  <div className="space-y-3">
                    <SectionLabel className="flex items-center gap-2">
                      <Paperclip className="h-4 w-4" />
                      Attachments
                    </SectionLabel>
                    <GlassCard className="p-4 space-y-3">
                      {attachmentFiles.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {attachmentFiles.map((file, index) => (
                            <motion.div
                              key={index}
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-1.5"
                            >
                              {file.type.startsWith('image/') ? (
                                <Image className="h-3.5 w-3.5 text-cyan-500" />
                              ) : (
                                <FileText className="h-3.5 w-3.5 text-amber-500" />
                              )}
                              <span className="text-xs truncate max-w-[120px] font-medium">{file.name}</span>
                              <button
                                type="button"
                                onClick={() => handleAttachmentRemove(index)}
                                className="text-slate-400 hover:text-rose-500 transition-colors"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </motion.div>
                          ))}
                        </div>
                      )}
                      <label className="flex items-center justify-center gap-2 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-6 cursor-pointer hover:border-violet-400 dark:hover:border-violet-600 transition-colors group">
                        <Upload className="h-5 w-5 text-slate-400 group-hover:text-violet-600 transition-colors" />
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-400 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                          Click or drag files
                        </span>
                        <Input
                          type="file"
                          accept="image/*,application/pdf"
                          multiple
                          onChange={handleAttachmentAdd}
                          className="hidden"
                          data-testid="input-attachments"
                        />
                      </label>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        JPEG, PNG, PDF up to 10MB each
                      </p>
                    </GlassCard>
                  </div>

                  {/* Tag Reviewers Section */}
                  <div className="space-y-3">
                    <SectionLabel className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Tag Reviewers
                    </SectionLabel>
                    <GlassCard className="p-4 max-h-48 overflow-y-auto">
                      {teamMembers && teamMembers.length > 0 ? (
                        <div className="space-y-2">
                          {teamMembers.filter(m => m.status === 'Active').map((member) => (
                            <motion.div
                              key={member.id}
                              whileHover={{ backgroundColor: "var(--color-hover)" }}
                              className="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              onClick={() => toggleReviewer(member.id)}
                              data-testid={`reviewer-${member.id}`}
                            >
                              <Checkbox
                                checked={selectedReviewers.includes(member.id)}
                                onCheckedChange={() => toggleReviewer(member.id)}
                              />
                              <Avatar className="h-7 w-7">
                                <AvatarFallback className="text-xs font-semibold bg-gradient-to-br from-violet-400 to-violet-600 text-white">
                                  {member.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{member.name}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{member.role}</p>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
                          No team members available
                        </p>
                      )}
                    </GlassCard>
                    {selectedReviewers.length > 0 && (
                      <SuccessFeedback>{selectedReviewers.length} reviewer(s) selected</SuccessFeedback>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-700 hover:to-violet-800 h-11 rounded-xl font-semibold"
                    disabled={createExpense.isPending || isUploading}
                    data-testid="button-submit-expense"
                  >
                    {isUploading ? "Uploading..." : createExpense.isPending ? "Creating..." : "Create Expense"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          }
        />

        {/* Metric Cards */}
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4"
          variants={stagger}
        >
          <motion.div variants={fadeUp}>
            <MetricCard
              icon={Receipt}
              title="Total"
              value={expenses?.length || 0}
              color="primary"
            />
          </motion.div>
          <motion.div variants={fadeUp}>
            <MetricCard
              icon={Clock}
              title="Pending"
              value={expenses?.filter((e) => e.status === "PENDING").length || 0}
              color="amber"
            />
          </motion.div>
          <motion.div variants={fadeUp}>
            <MetricCard
              icon={CheckCircle}
              title="Approved"
              value={expenses?.filter((e) => e.status === "APPROVED" || e.status === "PAID").length || 0}
              color="emerald"
            />
          </motion.div>
          <motion.div variants={fadeUp}>
            <MetricCard
              icon={DollarSign}
              title="Reimbursements"
              value={expenses?.filter((e) => e.expenseType === "spent").length || 0}
              color="cyan"
            />
          </motion.div>
          <motion.div variants={fadeUp}>
            <MetricCard
              icon={Users}
              title="Requests"
              value={expenses?.filter((e) => e.expenseType === "request" || !e.expenseType).length || 0}
              color="primary"
            />
          </motion.div>
        </motion.div>

        {/* Search and Filters */}
        <motion.div variants={fadeUp}>
          <GlassCard className="p-5">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search expenses..."
                  className="pl-10 bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-700 rounded-2xl h-11"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-search-expenses"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="rounded-2xl h-11 bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-700 md:w-40" data-testid="select-type-filter">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="spent">Reimbursement</SelectItem>
                  <SelectItem value="request">Request</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="rounded-2xl h-11 bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-700 md:w-40" data-testid="select-status-filter">
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
                <SelectTrigger className="rounded-2xl h-11 bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-700 md:w-40" data-testid="select-category-filter">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={exportToCSV}
                disabled={!filteredExpenses.length}
                className="rounded-2xl h-11 md:w-auto"
                data-testid="button-export-expenses"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </GlassCard>
        </motion.div>

        {/* Expenses List */}
        <motion.div variants={fadeUp}>
          <GlassCard>
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <SectionLabel>All Expenses</SectionLabel>
            </div>
            {isLoading ? (
              <div className="p-8 space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <motion.div
                    key={i}
                    className="flex items-center justify-between py-3"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.1 }}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <Skeleton className="h-12 w-12 rounded-xl" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-48 mb-2" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                    </div>
                    <Skeleton className="h-5 w-24" />
                  </motion.div>
                ))}
              </div>
            ) : filteredExpenses && filteredExpenses.length > 0 ? (
              <motion.div className="divide-y divide-slate-200 dark:divide-slate-700" variants={stagger}>
                {filteredExpenses.map((expense, index) => (
                  <AnimatedListItem key={expense.id} delay={index * 0.05}>
                    <div
                      className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                      onClick={() => handleViewDetail(expense)}
                      data-testid={`expense-row-${expense.id}`}
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-400 to-violet-600 flex items-center justify-center font-bold text-white shrink-0 shadow-md">
                          {expense.merchant[0]?.toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{expense.merchant}</p>
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <Badge variant="secondary" className={`text-xs font-medium rounded-lg ${getTypeColor(expense.expenseType)}`}>
                              {getTypeIcon(expense.expenseType)}
                              <span className="ml-1">{expense.expenseType === 'spent' ? 'Reimbursement' : 'Request'}</span>
                            </Badge>
                            <Badge variant="outline" className="text-xs rounded-lg">
                              {expense.category}
                            </Badge>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {new Date(expense.date).toLocaleDateString()}
                            </span>
                            {expense.attachments && expense.attachments.length > 0 && (
                              <Badge variant="outline" className="text-xs rounded-lg">
                                <Paperclip className="h-3 w-3 mr-1" />
                                {expense.attachments.length}
                              </Badge>
                            )}
                            {expense.taggedReviewers && expense.taggedReviewers.length > 0 && (
                              <Badge variant="outline" className="text-xs rounded-lg">
                                <Users className="h-3 w-3 mr-1" />
                                {expense.taggedReviewers.length}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-auto md:ml-0" onClick={(e) => e.stopPropagation()}>
                        <div className="text-right">
                          <p className="text-base font-bold text-slate-900 dark:text-slate-100">
                            {formatCurrency(expense.amount)}
                          </p>
                          <StatusBadge
                            status={expense.status.toLowerCase()}
                            className="text-xs"
                          />
                        </div>
                        {expense.status === "PENDING" && (
                          <div className="flex gap-1">
                            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }} onClick={() => approveExpense.mutate({ id: expense.id, vendorId: expense.vendorId || undefined })} disabled={approveExpense.isPending} className="p-2 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 rounded-lg transition-colors" data-testid={`button-approve-${expense.id}`}>
                              <CheckCircle className="h-4 w-4 text-emerald-600" />
                            </motion.button>
                            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }} onClick={() => rejectExpense.mutate(expense.id)} disabled={rejectExpense.isPending} className="p-2 hover:bg-rose-100 dark:hover:bg-rose-900/30 rounded-lg transition-colors" data-testid={`button-reject-${expense.id}`}>
                              <XCircle className="h-4 w-4 text-rose-600" />
                            </motion.button>
                          </div>
                        )}
                        {expense.status === "APPROVED" && (
                          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }} onClick={() => markAsPaid.mutate(expense.id)} disabled={markAsPaid.isPending} className="p-2 hover:bg-cyan-100 dark:hover:bg-cyan-900/30 rounded-lg transition-colors" data-testid={`button-pay-${expense.id}`}>
                            <DollarSign className="h-4 w-4 text-cyan-600" />
                          </motion.button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" className="rounded-lg" data-testid={`button-expense-menu-${expense.id}`}>
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
                            <DropdownMenuItem onClick={() => handleDelete(expense)} className="text-rose-600">
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </AnimatedListItem>
                ))}
              </motion.div>
            ) : (
              <EmptyState
                icon={Receipt}
                title="No expenses yet"
                subtitle="Start by adding your first expense to track company spending"
                action={
                  <Button onClick={() => setOpen(true)} className="bg-gradient-to-r from-violet-600 to-violet-700">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Expense
                  </Button>
                }
              />
            )}
          </GlassCard>
        </motion.div>

        {/* Expense Detail Dialog */}
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Expense Details</DialogTitle>
            </DialogHeader>
            {selectedExpense && (
              <motion.div className="space-y-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-violet-400 to-violet-600 flex items-center justify-center font-bold text-white text-2xl shadow-lg">
                    {selectedExpense.merchant[0]?.toUpperCase()}
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">{selectedExpense.merchant}</h3>
                    <div className="flex gap-2 flex-wrap">
                      <StatusBadge status={selectedExpense.status.toLowerCase()} />
                      <Badge className={`text-xs font-medium rounded-lg ${getTypeColor(selectedExpense.expenseType)}`}>
                        {getTypeIcon(selectedExpense.expenseType)}
                        <span className="ml-1">{selectedExpense.expenseType === 'spent' ? 'Reimbursement' : 'Request'}</span>
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-900/30 rounded-2xl p-4">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider">Amount</p>
                    <p className="font-bold text-lg text-slate-900 dark:text-slate-100 mt-1">{formatCurrency(selectedExpense.amount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider">Category</p>
                    <p className="font-semibold text-slate-900 dark:text-slate-100 mt-1">{selectedExpense.category}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider">Date</p>
                    <p className="font-semibold text-slate-900 dark:text-slate-100 mt-1">{new Date(selectedExpense.date).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider">Submitted By</p>
                    <p className="font-semibold text-slate-900 dark:text-slate-100 mt-1">{selectedExpense.user}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider">Department</p>
                    <p className="font-semibold text-slate-900 dark:text-slate-100 mt-1">{selectedExpense.department}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider">Currency</p>
                    <p className="font-semibold text-slate-900 dark:text-slate-100 mt-1">{selectedExpense.currency}</p>
                  </div>
                </div>

                {selectedExpense.note && (
                  <div className="bg-slate-50 dark:bg-slate-900/30 rounded-2xl p-4">
                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider mb-2">Note</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300">{selectedExpense.note}</p>
                  </div>
                )}

                {/* Attachments Display */}
                {selectedExpense.attachments && selectedExpense.attachments.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider mb-3">
                      Attachments ({selectedExpense.attachments.length})
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {selectedExpense.attachments.map((url, index) => (
                        <motion.a
                          key={index}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          whileHover={{ scale: 1.05 }}
                          className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                          {url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                            <Image className="h-4 w-4 text-cyan-500 shrink-0" />
                          ) : (
                            <FileText className="h-4 w-4 text-amber-500 shrink-0" />
                          )}
                          <span className="text-xs truncate text-slate-600 dark:text-slate-400">Attachment {index + 1}</span>
                        </motion.a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tagged Reviewers Display */}
                {selectedExpense.taggedReviewers && selectedExpense.taggedReviewers.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider mb-3">
                      Tagged Reviewers ({selectedExpense.taggedReviewers.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {selectedExpense.taggedReviewers.map((reviewerId) => {
                        const member = getMemberById(reviewerId);
                        return (
                          <motion.div
                            key={reviewerId}
                            whileHover={{ scale: 1.05 }}
                            className="flex items-center gap-2 bg-gradient-to-r from-violet-100 to-violet-50 dark:from-violet-900/30 dark:to-violet-800/20 rounded-full px-3 py-1.5"
                          >
                            <Avatar className="h-5 w-5">
                              <AvatarFallback className="text-xs font-semibold bg-gradient-to-br from-violet-400 to-violet-600 text-white">
                                {member?.name.split(' ').map(n => n[0]).join('').toUpperCase() || '?'}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">{member?.name || 'Unknown'}</span>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {selectedExpense.receiptUrl && (
                  <div className="bg-slate-50 dark:bg-slate-900/30 rounded-2xl p-4">
                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider mb-2">Receipt</p>
                    <a href={selectedExpense.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 underline text-sm font-medium transition-colors">
                      View Receipt
                    </a>
                  </div>
                )}

                <DialogFooter className="flex gap-2 flex-wrap">
                  {selectedExpense.status === "PENDING" && (
                    <>
                      <Button
                        variant="outline"
                        className="text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl"
                        onClick={() => { rejectExpense.mutate(selectedExpense.id); setDetailOpen(false); }}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Reject
                      </Button>
                      <Button
                        className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 rounded-xl"
                        onClick={() => { approveExpense.mutate({ id: selectedExpense.id, vendorId: selectedExpense.vendorId || undefined }); setDetailOpen(false); }}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Approve & Pay
                      </Button>
                    </>
                  )}
                  {selectedExpense.status === "APPROVED" && (
                    <Button
                      className="bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-700 hover:to-cyan-800 rounded-xl"
                      onClick={() => { markAsPaid.mutate(selectedExpense.id); setDetailOpen(false); }}
                    >
                      <DollarSign className="h-4 w-4 mr-2" />
                      Mark as Paid
                    </Button>
                  )}
                </DialogFooter>
              </motion.div>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Expense Dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Expense</DialogTitle>
            </DialogHeader>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-5">
              <FormField label="Merchant" required>
                <Input
                  id="edit-merchant"
                  placeholder="e.g., Amazon, Uber"
                  {...editForm.register("merchant", { required: true })}
                  className="bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-700 rounded-xl h-11"
                  data-testid="input-edit-merchant"
                />
              </FormField>

              <FormField label="Amount" required>
                <Input
                  id="edit-amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  {...editForm.register("amount", { required: true })}
                  className="bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-700 rounded-xl h-11"
                  data-testid="input-edit-amount"
                />
              </FormField>

              <div className="space-y-2">
                <SectionLabel>Category</SectionLabel>
                <Select onValueChange={(value) => editForm.setValue("category", value)} value={editForm.watch("category")}>
                  <SelectTrigger className="rounded-xl h-11 bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-700" data-testid="select-edit-category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <FormField label="Note (Optional)">
                <Textarea
                  id="edit-note"
                  placeholder="Add a note..."
                  {...editForm.register("note")}
                  className="bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-700 rounded-xl"
                  data-testid="input-edit-note"
                />
              </FormField>

              <DialogFooter className="flex gap-2">
                <Button type="button" variant="outline" className="rounded-xl" onClick={() => setEditOpen(false)}>Cancel</Button>
                <Button
                  type="submit"
                  disabled={updateExpense.isPending}
                  className="bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-700 hover:to-violet-800 rounded-xl"
                  data-testid="button-update-expense"
                >
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
            <WarningFeedback className="py-3">
              Are you sure you want to delete this expense from <strong>{selectedExpense?.merchant}</strong>? This action cannot be undone.
            </WarningFeedback>
            <DialogFooter className="flex gap-2">
              <Button variant="outline" className="rounded-xl" onClick={() => setDeleteOpen(false)}>Cancel</Button>
              <Button
                variant="destructive"
                className="rounded-xl"
                onClick={() => selectedExpense && deleteExpense.mutate(selectedExpense.id)}
                disabled={deleteExpense.isPending}
                data-testid="button-confirm-delete"
              >
                {deleteExpense.isPending ? "Deleting..." : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>
    </PageWrapper>
  );
}
