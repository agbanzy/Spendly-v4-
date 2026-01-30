import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  FileText, 
  Plus, 
  Search,
  Clock,
  CheckCircle2,
  AlertCircle,
  Download,
  Send,
  Loader2,
  DollarSign,
  Building2,
  Calendar,
  Eye,
  MoreHorizontal,
  Mail,
  CreditCard,
  Copy,
  Banknote,
  Trash2
} from "lucide-react";
import type { Invoice } from "@shared/schema";

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
      case "overdue":
        return (
          <Badge variant="destructive">
            <AlertCircle className="mr-1 h-3 w-3" />
            Overdue
          </Badge>
        );
      case "draft":
        return (
          <Badge variant="secondary">
            <FileText className="mr-1 h-3 w-3" />
            Draft
          </Badge>
        );
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 texture-mesh min-h-screen">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-invoices-title">Invoices</h1>
          <p className="text-muted-foreground">Create and manage client invoices</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-invoice">
              <Plus className="mr-2 h-4 w-4" />
              Create Invoice
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Create New Invoice</DialogTitle>
              <DialogDescription>
                Fill in the details to create a new invoice.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Client Name</Label>
                  <Input 
                    placeholder="e.g., TechCorp Inc." 
                    value={invoiceForm.clientName}
                    onChange={(e) => setInvoiceForm({...invoiceForm, clientName: e.target.value})}
                    data-testid="input-client-name" 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Client Email</Label>
                  <Input 
                    type="email" 
                    placeholder="billing@company.com" 
                    value={invoiceForm.clientEmail}
                    onChange={(e) => setInvoiceForm({...invoiceForm, clientEmail: e.target.value})}
                    data-testid="input-client-email" 
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Invoice Date</Label>
                  <Input 
                    type="date" 
                    value={invoiceForm.invoiceDate}
                    onChange={(e) => setInvoiceForm({...invoiceForm, invoiceDate: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Due Date</Label>
                  <Input 
                    type="date" 
                    value={invoiceForm.dueDate}
                    onChange={(e) => setInvoiceForm({...invoiceForm, dueDate: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Line Items</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addLineItem} data-testid="button-add-line-item">
                    <Plus className="h-4 w-4 mr-1" />
                    Add Item
                  </Button>
                </div>
                
                <div className="space-y-3">
                  {lineItems.map((item, index) => (
                    <div key={item.id} className="p-3 border rounded-lg bg-muted/30 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">Item {index + 1}</span>
                        {lineItems.length > 1 && (
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => removeLineItem(item.id)}
                            data-testid={`button-remove-item-${index}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Description</Label>
                        <Input 
                          placeholder="Service or product description..."
                          value={item.description}
                          onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                          data-testid={`input-item-description-${index}`}
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-2">
                          <Label className="text-xs">Quantity</Label>
                          <Input 
                            type="number" 
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateLineItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                            data-testid={`input-item-quantity-${index}`}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Unit Price</Label>
                          <Input 
                            type="number" 
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={item.unitPrice || ""}
                            onChange={(e) => updateLineItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                            data-testid={`input-item-price-${index}`}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Total</Label>
                          <Input 
                            type="text" 
                            value={`$${calculateLineTotal(item).toFixed(2)}`}
                            disabled 
                            className="bg-muted"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="flex justify-end pt-2 border-t">
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Subtotal</p>
                    <p className="text-xl font-bold">${calculateSubtotal().toFixed(2)}</p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea 
                  placeholder="Additional notes or payment instructions..."
                  value={invoiceForm.notes}
                  onChange={(e) => setInvoiceForm({...invoiceForm, notes: e.target.value})}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Save as Draft
              </Button>
              <Button onClick={handleCreateInvoice} disabled={isCreating} data-testid="button-send-invoice">
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
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="glass card-hover">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900 text-indigo-600">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{invoices.length}</p>
                <p className="text-sm text-muted-foreground">Total Invoices</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass card-hover">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900 text-amber-600">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">${totalOutstanding.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Outstanding</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass card-hover">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-rose-100 dark:bg-rose-900 text-rose-600">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">${totalOverdue.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Overdue</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass card-hover">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900 text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">${totalPaid.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Paid This Month</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="all" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="paid">Paid</TabsTrigger>
            <TabsTrigger value="overdue">Overdue</TabsTrigger>
            <TabsTrigger value="draft">Drafts</TabsTrigger>
          </TabsList>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search invoices..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-invoices"
            />
          </div>
        </div>

        <TabsContent value="all">
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {filteredInvoices.map((invoice, index) => (
                  <div 
                    key={invoice.id} 
                    className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                    data-testid={`invoice-row-${index}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-lg bg-muted">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">{invoice.invoiceNumber}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Building2 className="h-3 w-3" />
                          <span>{invoice.client}</span>
                        </div>
                      </div>
                    </div>
                    <div className="hidden md:flex items-center gap-8">
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Issued</p>
                        <p className="font-medium">{invoice.issuedDate}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Due</p>
                        <p className="font-medium">{invoice.dueDate}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-lg font-bold">${invoice.amount.toLocaleString()}</p>
                      </div>
                      {getStatusBadge(invoice.status)}
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleViewInvoice(invoice)} data-testid={`button-view-invoice-${invoice.id}`}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {invoice.status !== "paid" && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleSendInvoice(invoice)}
                          >
                            <Mail className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon">
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {["pending", "paid", "overdue", "draft"].map((status) => (
          <TabsContent key={status} value={status}>
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {filteredInvoices.filter(i => i.status === status).map((invoice) => (
                    <div 
                      key={invoice.id} 
                      className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-2 rounded-lg bg-muted">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">{invoice.invoiceNumber}</p>
                          <p className="text-sm text-muted-foreground">{invoice.client}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <p className="text-lg font-bold">${invoice.amount.toLocaleString()}</p>
                        {getStatusBadge(invoice.status)}
                      </div>
                    </div>
                  ))}
                  {filteredInvoices.filter(i => i.status === status).length === 0 && (
                    <div className="p-8 text-center text-muted-foreground">
                      No {status} invoices found.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* View Invoice Dialog with Virtual Account Payment Details */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Invoice Details
            </DialogTitle>
            <DialogDescription>
              Invoice information and payment details
            </DialogDescription>
          </DialogHeader>
          
          {selectedInvoice && (
            <div className="space-y-6">
              {/* Invoice Summary */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Invoice Number</p>
                  <p className="font-medium">{selectedInvoice.invoiceNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  {getStatusBadge(selectedInvoice.status)}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Client</p>
                  <p className="font-medium">{selectedInvoice.client}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Amount</p>
                  <p className="text-xl font-bold">${selectedInvoice.amount.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Issued Date</p>
                  <p className="font-medium">{selectedInvoice.issuedDate}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Due Date</p>
                  <p className="font-medium">{selectedInvoice.dueDate}</p>
                </div>
              </div>

              {/* Line Items Section */}
              {selectedInvoice.items && (selectedInvoice.items as any[]).length > 0 && (
                <div className="border-t pt-4">
                  <h4 className="text-sm font-semibold mb-3">Line Items</h4>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-2 font-medium">Description</th>
                          <th className="text-right p-2 font-medium">Qty</th>
                          <th className="text-right p-2 font-medium">Rate</th>
                          <th className="text-right p-2 font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedInvoice.items as { description: string; quantity: number; rate: number }[]).map((item, idx) => (
                          <tr key={idx} className="border-t">
                            <td className="p-2">{item.description}</td>
                            <td className="p-2 text-right">{item.quantity}</td>
                            <td className="p-2 text-right">${item.rate.toFixed(2)}</td>
                            <td className="p-2 text-right font-medium">${(item.quantity * item.rate).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-muted/50 border-t">
                        <tr>
                          <td colSpan={3} className="p-2 text-right font-medium">Total:</td>
                          <td className="p-2 text-right font-bold">${Number(selectedInvoice.amount).toFixed(2)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* Payment Details Section */}
              {selectedInvoice.status !== "paid" && (
                <div className="border-t pt-4">
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Banknote className="h-4 w-4" />
                    Payment Instructions
                  </h4>
                  
                  {virtualAccounts.length > 0 ? (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Please transfer the exact amount to one of the following accounts:
                      </p>
                      
                      {virtualAccounts.map((account: VirtualAccount) => (
                        <Card key={account.id} className="bg-muted/50">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium">{account.bankName}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {account.provider.toUpperCase()}
                                  </Badge>
                                </div>
                                <div className="grid grid-cols-1 gap-1 text-sm">
                                  <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Account Number:</span>
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono font-medium">{account.accountNumber}</span>
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        onClick={() => copyToClipboard(account.accountNumber, 'Account number')}
                                        data-testid={`button-copy-account-${account.id}`}
                                      >
                                        <Copy className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Account Name:</span>
                                    <span className="font-medium">{account.accountName}</span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Currency:</span>
                                    <span className="font-medium">{account.currency}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      
                      <p className="text-xs text-muted-foreground mt-2">
                        Reference: Include "{selectedInvoice.invoiceNumber}" in your payment reference
                      </p>
                    </div>
                  ) : (
                    <div className="p-4 bg-muted/50 rounded-lg text-center">
                      <p className="text-sm text-muted-foreground">
                        Virtual account payment details are not available. 
                        Contact the sender for alternative payment methods.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {selectedInvoice.status === "paid" && (
                <div className="border-t pt-4">
                  <div className="flex items-center gap-2 text-emerald-600">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="font-medium">This invoice has been paid</span>
                  </div>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewOpen(false)}>
              Close
            </Button>
            {selectedInvoice && selectedInvoice.status !== "paid" && (
              <Button onClick={() => handleSendInvoice(selectedInvoice)}>
                <Mail className="h-4 w-4 mr-2" />
                Send Invoice
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
