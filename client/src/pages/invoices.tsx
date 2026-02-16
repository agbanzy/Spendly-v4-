import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  PageWrapper,
  PageHeader,
  MetricCard,
  StatusBadge,
  AnimatedListItem,
  EmptyState,
  GlassCard,
  fadeUp,
  stagger
} from "@/components/ui-extended";
import {
  FileText,
  Plus,
  Search,
  Clock,
  AlertTriangle,
  CheckCircle,
  Download,
  Send,
  Loader2,
  DollarSign,
  Building2,
  Eye,
  Mail,
  CreditCard,
  Copy,
  Banknote,
  Trash2,
  TrendingUp
} from "lucide-react";
import type { Invoice, CompanySettings } from "@shared/schema";

interface VirtualAccount {
  id: string;
  accountNumber: string;
  bankName: string;
  accountName: string;
  provider: string;
  currency: string;
}

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

const emptyLineItem = (): LineItem => ({
  id: crypto.randomUUID(),
  description: "",
  quantity: 1,
  unitPrice: 0
});

export default function InvoicesPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);

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
    return `${currencySymbol}${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
  
  const [invoiceForm, setInvoiceForm] = useState({
    clientName: "",
    clientEmail: "",
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    notes: ""
  });
  const [lineItems, setLineItems] = useState<LineItem[]>([emptyLineItem()]);
  
  const addLineItem = () => {
    setLineItems([...lineItems, emptyLineItem()]);
  };
  
  const removeLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter(item => item.id !== id));
    }
  };
  
  const updateLineItem = (id: string, field: keyof LineItem, value: string | number) => {
    setLineItems(lineItems.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };
  
  const calculateLineTotal = (item: LineItem) => item.quantity * item.unitPrice;
  const calculateSubtotal = () => lineItems.reduce((sum, item) => sum + calculateLineTotal(item), 0);
  
  const resetForm = () => {
    setInvoiceForm({
      clientName: "",
      clientEmail: "",
      invoiceDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: ""
    });
    setLineItems([emptyLineItem()]);
  };

  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"]
  });

  // Fetch company virtual accounts for payment details
  const { data: virtualAccounts = [] } = useQuery<VirtualAccount[]>({
    queryKey: ["/api/funding-sources"],
    select: (data: any[]) => data.filter((f: any) => f.sourceType === "virtual_account")
  });

  const createInvoiceMutation = useMutation({
    mutationFn: async (invoiceData: { client: string; clientEmail: string; amount: number; dueDate: string; items: { description: string; quantity: number; rate: number }[] }) => {
      return apiRequest("/api/invoices", {
        method: "POST",
        body: JSON.stringify(invoiceData)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      setIsCreateOpen(false);
      toast({
        title: "Invoice created",
        description: "Your invoice has been created successfully."
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create invoice. Please try again.",
        variant: "destructive"
      });
    }
  });

  const totalOutstanding = invoices.filter(i => i.status === "pending" || i.status === "overdue").reduce((sum, i) => sum + i.amount, 0);
  const totalOverdue = invoices.filter(i => i.status === "overdue").reduce((sum, i) => sum + i.amount, 0);
  const totalPaid = invoices.filter(i => i.status === "paid").reduce((sum, i) => sum + i.amount, 0);

  const filteredInvoices = invoices.filter(invoice =>
    invoice.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    invoice.client.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateInvoice = async () => {
    if (!invoiceForm.clientName || !invoiceForm.clientEmail) {
      toast({
        title: "Error",
        description: "Please fill in client name and email.",
        variant: "destructive"
      });
      return;
    }
    
    if (lineItems.some(item => !item.description || item.unitPrice <= 0)) {
      toast({
        title: "Error",
        description: "Please fill in all line item details.",
        variant: "destructive"
      });
      return;
    }
    
    setIsCreating(true);
    
    try {
      await createInvoiceMutation.mutateAsync({
        client: invoiceForm.clientName,
        clientEmail: invoiceForm.clientEmail,
        amount: calculateSubtotal(),
        dueDate: invoiceForm.dueDate,
        items: lineItems.map(item => ({
          description: item.description,
          quantity: item.quantity,
          rate: item.unitPrice
        }))
      });
      resetForm();
    } catch (error) {
      // Error handled by mutation
    } finally {
      setIsCreating(false);
    }
  };

  const handleSendInvoice = (invoice: Invoice) => {
    toast({
      title: "Invoice sent",
      description: `Invoice ${invoice.invoiceNumber} has been sent to ${invoice.client}.`
    });
  };

  const handleViewInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setIsViewOpen(true);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: `${label} copied to clipboard.`
    });
  };

  const getStatusBadge = (status: Invoice["status"]) => {
    const statusConfig = {
      paid: { variant: "success" as const, label: "Paid", icon: CheckCircle },
      pending: { variant: "default" as const, label: "Pending", icon: Clock },
      overdue: { variant: "destructive" as const, label: "Overdue", icon: AlertTriangle },
      draft: { variant: "secondary" as const, label: "Draft", icon: FileText }
    };

    const config = statusConfig[status];
    return <StatusBadge variant={config.variant} label={config.label} icon={config.icon} />;
  };

  return (
    <PageWrapper>
      <motion.div
        className="space-y-8"
        initial="hidden"
        animate="visible"
        variants={stagger}
      >
        {/* Header Section */}
        <motion.div variants={fadeUp} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <PageHeader
            title="Invoices"
            subtitle="Create and manage client invoices"
            icon={FileText}
          />
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button
                className="bg-violet-600 hover:bg-violet-700 text-white shadow-lg hover:shadow-xl transition-all"
                data-testid="button-create-invoice"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Invoice
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-2xl">Create New Invoice</DialogTitle>
                <DialogDescription>
                  Fill in the details to create and send a new invoice to your client.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 py-4">
                {/* Client Information */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Client Information</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Client Name</Label>
                      <Input
                        placeholder="e.g., TechCorp Inc."
                        value={invoiceForm.clientName}
                        onChange={(e) => setInvoiceForm({ ...invoiceForm, clientName: e.target.value })}
                        className="border-slate-200 dark:border-slate-700 focus:ring-violet-500"
                        data-testid="input-client-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Client Email</Label>
                      <Input
                        type="email"
                        placeholder="billing@company.com"
                        value={invoiceForm.clientEmail}
                        onChange={(e) => setInvoiceForm({ ...invoiceForm, clientEmail: e.target.value })}
                        className="border-slate-200 dark:border-slate-700 focus:ring-violet-500"
                        data-testid="input-client-email"
                      />
                    </div>
                  </div>
                </div>

                {/* Dates */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Invoice Dates</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Invoice Date</Label>
                      <Input
                        type="date"
                        value={invoiceForm.invoiceDate}
                        onChange={(e) => setInvoiceForm({ ...invoiceForm, invoiceDate: e.target.value })}
                        className="border-slate-200 dark:border-slate-700 focus:ring-violet-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Due Date</Label>
                      <Input
                        type="date"
                        value={invoiceForm.dueDate}
                        onChange={(e) => setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })}
                        className="border-slate-200 dark:border-slate-700 focus:ring-violet-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Line Items */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Line Items</h3>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addLineItem}
                      className="border-violet-200 hover:bg-violet-50 dark:border-violet-800 dark:hover:bg-violet-950"
                      data-testid="button-add-line-item"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Item
                    </Button>
                  </div>

                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {lineItems.map((item, index) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900/30 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                            Item {index + 1}
                          </span>
                          {lineItems.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-950"
                              onClick={() => removeLineItem(item.id)}
                              data-testid={`button-remove-item-${index}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">Description</Label>
                          <Input
                            placeholder="Service or product description..."
                            value={item.description}
                            onChange={(e) => updateLineItem(item.id, "description", e.target.value)}
                            className="text-sm border-slate-200 dark:border-slate-700"
                            data-testid={`input-item-description-${index}`}
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <div className="space-y-2">
                            <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">Qty</Label>
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateLineItem(item.id, "quantity", parseInt(e.target.value) || 1)}
                              className="text-sm border-slate-200 dark:border-slate-700"
                              data-testid={`input-item-quantity-${index}`}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">Unit Price</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              value={item.unitPrice || ""}
                              onChange={(e) => updateLineItem(item.id, "unitPrice", parseFloat(e.target.value) || 0)}
                              className="text-sm border-slate-200 dark:border-slate-700"
                              data-testid={`input-item-price-${index}`}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">Total</Label>
                            <div className="h-10 px-3 py-2 rounded-md bg-slate-100 dark:bg-slate-800 text-sm font-semibold flex items-center justify-end text-violet-600 dark:text-violet-400">
                              {currencySymbol}{calculateLineTotal(item).toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Subtotal */}
                  <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-700">
                    <div className="text-right space-y-1">
                      <p className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                        Subtotal
                      </p>
                      <p className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-emerald-600 bg-clip-text text-transparent">
                        {currencySymbol}{calculateSubtotal().toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Additional Information</h3>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Notes</Label>
                    <Textarea
                      placeholder="Add payment terms, thank you message, or additional notes..."
                      value={invoiceForm.notes}
                      onChange={(e) => setInvoiceForm({ ...invoiceForm, notes: e.target.value })}
                      className="min-h-24 border-slate-200 dark:border-slate-700 focus:ring-violet-500"
                    />
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateInvoice}
                  disabled={isCreating}
                  className="bg-violet-600 hover:bg-violet-700 text-white"
                  data-testid="button-send-invoice"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Create & Send
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </motion.div>

        {/* Metrics Section */}
        <motion.div variants={fadeUp} className="grid gap-4 md:grid-cols-4 grid-cols-1 sm:grid-cols-2">
          <MetricCard
            title="Total Invoices"
            value={invoices.length.toString()}
            icon={FileText}
            color="primary"
          />
          <MetricCard
            title="Outstanding"
            value={formatCurrency(totalOutstanding)}
            icon={DollarSign}
            color="amber"
          />
          <MetricCard
            title="Overdue"
            value={formatCurrency(totalOverdue)}
            icon={AlertTriangle}
            color="rose"
          />
          <MetricCard
            title="Paid This Month"
            value={formatCurrency(totalPaid)}
            icon={CheckCircle}
            color="emerald"
          />
        </motion.div>

        {/* Invoices List */}
        <motion.div variants={fadeUp}>
          <Tabs defaultValue="all" className="space-y-4">
            {/* Tabs Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <TabsList className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="paid">Paid</TabsTrigger>
                <TabsTrigger value="overdue">Overdue</TabsTrigger>
                <TabsTrigger value="draft">Drafts</TabsTrigger>
              </TabsList>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search invoices..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 border-slate-200 dark:border-slate-700 focus:ring-violet-500"
                  data-testid="input-search-invoices"
                />
              </div>
            </div>

            {/* All Invoices Tab */}
            <TabsContent value="all" className="space-y-3">
              {filteredInvoices.length > 0 ? (
                <div className="space-y-2">
                  {filteredInvoices.map((invoice, index) => (
                    <AnimatedListItem key={invoice.id} index={index}>
                      <GlassCard className="p-4 hover:shadow-md transition-all">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-center gap-4 flex-1">
                            <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-900/40">
                              <FileText className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900 dark:text-slate-100">
                                {invoice.invoiceNumber}
                              </p>
                              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                <Building2 className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate">{invoice.client}</span>
                              </div>
                            </div>
                          </div>

                          <div className="hidden md:flex items-center gap-8 text-sm">
                            <div className="text-right">
                              <p className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                                Issued
                              </p>
                              <p className="font-medium text-slate-900 dark:text-slate-100">
                                {invoice.issuedDate}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                                Due
                              </p>
                              <p className="font-medium text-slate-900 dark:text-slate-100">
                                {invoice.dueDate}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 justify-between sm:justify-end">
                            <div className="text-right">
                              <p className="text-lg font-bold text-violet-600 dark:text-violet-400">
                                {formatCurrency(invoice.amount)}
                              </p>
                            </div>
                            {getStatusBadge(invoice.status)}
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-slate-200 dark:hover:bg-slate-700"
                                onClick={() => handleViewInvoice(invoice)}
                                data-testid={`button-view-invoice-${invoice.id}`}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {invoice.status !== "paid" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 hover:bg-slate-200 dark:hover:bg-slate-700"
                                  onClick={() => handleSendInvoice(invoice)}
                                >
                                  <Mail className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-slate-200 dark:hover:bg-slate-700"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </GlassCard>
                    </AnimatedListItem>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No invoices yet"
                  subtitle="Create your first invoice to get started"
                  icon={FileText}
                />
              )}
            </TabsContent>

            {/* Status Tabs */}
            {(["pending", "paid", "overdue", "draft"] as const).map((status) => {
              const statusInvoices = filteredInvoices.filter((i) => i.status === status);
              return (
                <TabsContent key={status} value={status} className="space-y-3">
                  {statusInvoices.length > 0 ? (
                    <div className="space-y-2">
                      {statusInvoices.map((invoice, index) => (
                        <AnimatedListItem key={invoice.id} index={index}>
                          <GlassCard className="p-4 hover:shadow-md transition-all">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                              <div className="flex items-center gap-4 flex-1">
                                <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-900/40">
                                  <FileText className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                                </div>
                                <div className="min-w-0">
                                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                                    {invoice.invoiceNumber}
                                  </p>
                                  <p className="text-sm text-slate-600 dark:text-slate-400 truncate">
                                    {invoice.client}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-4 justify-between sm:justify-end">
                                <p className="text-lg font-bold text-violet-600 dark:text-violet-400">
                                  {formatCurrency(invoice.amount)}
                                </p>
                                {getStatusBadge(invoice.status)}
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 hover:bg-slate-200 dark:hover:bg-slate-700"
                                    onClick={() => handleViewInvoice(invoice)}
                                    data-testid={`button-view-invoice-${invoice.id}`}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  {status !== "paid" && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 hover:bg-slate-200 dark:hover:bg-slate-700"
                                      onClick={() => handleSendInvoice(invoice)}
                                    >
                                      <Mail className="h-4 w-4" />
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 hover:bg-slate-200 dark:hover:bg-slate-700"
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </GlassCard>
                        </AnimatedListItem>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      title={`No ${status} invoices`}
                      description={`You don't have any ${status} invoices at the moment`}
                      icon={FileText}
                    />
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        </motion.div>
      </motion.div>

      {/* View Invoice Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-900/40">
                <FileText className="h-5 w-5 text-violet-600" />
              </div>
              Invoice Details
            </DialogTitle>
            <DialogDescription>
              View invoice information and payment details
            </DialogDescription>
          </DialogHeader>

          {selectedInvoice && (
            <div className="space-y-6 py-4">
              {/* Summary */}
              <GlassCard className="p-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                      Invoice Number
                    </p>
                    <p className="text-lg font-semibold text-slate-900 dark:text-slate-100 mt-1">
                      {selectedInvoice.invoiceNumber}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                      Status
                    </p>
                    <div className="mt-2">{getStatusBadge(selectedInvoice.status)}</div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                      Client
                    </p>
                    <p className="text-lg font-semibold text-slate-900 dark:text-slate-100 mt-1">
                      {selectedInvoice.client}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                      Amount Due
                    </p>
                    <p className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-emerald-600 bg-clip-text text-transparent mt-1">
                      {formatCurrency(selectedInvoice.amount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                      Issued
                    </p>
                    <p className="text-lg font-semibold text-slate-900 dark:text-slate-100 mt-1">
                      {selectedInvoice.issuedDate}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                      Due Date
                    </p>
                    <p className="text-lg font-semibold text-slate-900 dark:text-slate-100 mt-1">
                      {selectedInvoice.dueDate}
                    </p>
                  </div>
                </div>
              </GlassCard>

              {/* Line Items */}
              {selectedInvoice.items && (selectedInvoice.items as any[]).length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Line Items</h3>
                  <GlassCard className="overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-100 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                        <tr>
                          <th className="text-left p-4 font-semibold text-slate-900 dark:text-slate-100">
                            Description
                          </th>
                          <th className="text-right p-4 font-semibold text-slate-900 dark:text-slate-100">
                            Qty
                          </th>
                          <th className="text-right p-4 font-semibold text-slate-900 dark:text-slate-100">
                            Rate
                          </th>
                          <th className="text-right p-4 font-semibold text-slate-900 dark:text-slate-100">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {(selectedInvoice.items as { description: string; quantity: number; rate: number }[]).map(
                          (item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/30">
                              <td className="p-4 text-slate-900 dark:text-slate-100">{item.description}</td>
                              <td className="p-4 text-right text-slate-600 dark:text-slate-400">
                                {item.quantity}
                              </td>
                              <td className="p-4 text-right text-slate-600 dark:text-slate-400">
                                {currencySymbol}
                                {item.rate.toFixed(2)}
                              </td>
                              <td className="p-4 text-right font-semibold text-slate-900 dark:text-slate-100">
                                {currencySymbol}
                                {(item.quantity * item.rate).toFixed(2)}
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                      <tfoot className="bg-slate-100 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-700">
                        <tr>
                          <td colSpan={3} className="p-4 text-right font-semibold text-slate-900 dark:text-slate-100">
                            Total:
                          </td>
                          <td className="p-4 text-right font-bold text-violet-600 dark:text-violet-400 text-lg">
                            {currencySymbol}
                            {Number(selectedInvoice.amount).toFixed(2)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </GlassCard>
                </div>
              )}

              {/* Payment Instructions */}
              {selectedInvoice.status !== "paid" && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Banknote className="h-4 w-4 text-amber-600" />
                    Payment Instructions
                  </h3>

                  {virtualAccounts.length > 0 ? (
                    <div className="space-y-3">
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Please transfer the exact amount to one of the following accounts:
                      </p>

                      {virtualAccounts.map((account: VirtualAccount) => (
                        <motion.div
                          key={account.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                        >
                          <GlassCard className="p-4 border border-amber-200 dark:border-amber-900/40 bg-gradient-to-br from-amber-50/50 to-transparent dark:from-amber-900/20 dark:to-transparent">
                            <div className="space-y-3">
                              <div className="flex items-center gap-2">
                                <CreditCard className="h-4 w-4 text-amber-600" />
                                <span className="font-semibold text-slate-900 dark:text-slate-100">
                                  {account.bankName}
                                </span>
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200">
                                  {account.provider.toUpperCase()}
                                </span>
                              </div>

                              <div className="space-y-2 text-sm">
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-600 dark:text-slate-400">Account Number:</span>
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                                      {account.accountNumber}
                                    </span>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 hover:bg-amber-100 dark:hover:bg-amber-900/40"
                                      onClick={() =>
                                        copyToClipboard(account.accountNumber, "Account number")
                                      }
                                      data-testid={`button-copy-account-${account.id}`}
                                    >
                                      <Copy className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-600 dark:text-slate-400">Account Name:</span>
                                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                                    {account.accountName}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-600 dark:text-slate-400">Currency:</span>
                                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                                    {account.currency}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </GlassCard>
                        </motion.div>
                      ))}

                      <div className="p-3 bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-900/40 rounded-lg">
                        <p className="text-xs text-cyan-900 dark:text-cyan-200 font-medium">
                          Reference: Include <span className="font-mono font-bold">"{selectedInvoice.invoiceNumber}"</span> in
                          your payment reference
                        </p>
                      </div>
                    </div>
                  ) : (
                    <GlassCard className="p-4 text-center">
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Virtual account payment details are not available. Contact the sender for alternative
                        payment methods.
                      </p>
                    </GlassCard>
                  )}
                </div>
              )}

              {/* Paid Status */}
              {selectedInvoice.status === "paid" && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-900/40 rounded-lg flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-emerald-600" />
                  <span className="font-semibold text-emerald-900 dark:text-emerald-100">
                    This invoice has been paid
                  </span>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsViewOpen(false)}>
              Close
            </Button>
            {selectedInvoice && selectedInvoice.status !== "paid" && (
              <Button
                onClick={() => handleSendInvoice(selectedInvoice)}
                className="bg-violet-600 hover:bg-violet-700 text-white"
              >
                <Mail className="h-4 w-4 mr-2" />
                Send Invoice
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageWrapper>
  );
}
