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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
  Smartphone,
  Wifi,
  Zap,
  Tv,
  Phone,
  Globe,
  CreditCard,
  Building2,
  Sparkles,
} from "lucide-react";
import type { Bill, CompanySettings, Wallet } from "@shared/schema";

// Country-specific utility providers
const utilityProvidersByRegion = {
  Africa: {
    airtime: [
      { id: "mtn", name: "MTN", color: "text-yellow-500" },
      { id: "glo", name: "Glo", color: "text-green-500" },
      { id: "airtel", name: "Airtel", color: "text-red-500" },
      { id: "9mobile", name: "9Mobile", color: "text-green-600" },
      { id: "safaricom", name: "Safaricom", color: "text-emerald-500" },
      { id: "vodacom", name: "Vodacom", color: "text-red-600" },
    ],
    data: [
      { id: "mtn-data", name: "MTN Data", color: "text-yellow-500" },
      { id: "glo-data", name: "Glo Data", color: "text-green-500" },
      { id: "airtel-data", name: "Airtel Data", color: "text-red-500" },
      { id: "9mobile-data", name: "9Mobile Data", color: "text-green-600" },
      { id: "spectranet", name: "Spectranet", color: "text-blue-500" },
      { id: "smile", name: "Smile", color: "text-purple-500" },
    ],
    electricity: [
      { id: "eko", name: "Eko Electric (EKEDC)", color: "text-yellow-500" },
      { id: "ikeja", name: "Ikeja Electric (IKEDC)", color: "text-yellow-600" },
      { id: "abuja", name: "Abuja Electric (AEDC)", color: "text-amber-500" },
      { id: "ibadan", name: "Ibadan Electric (IBEDC)", color: "text-orange-500" },
      { id: "kplc", name: "Kenya Power", color: "text-yellow-500" },
      { id: "eskom", name: "Eskom", color: "text-yellow-600" },
    ],
    cable: [
      { id: "dstv", name: "DSTV", color: "text-blue-500" },
      { id: "gotv", name: "GOTV", color: "text-purple-500" },
      { id: "startimes", name: "Startimes", color: "text-orange-500" },
      { id: "showmax", name: "Showmax", color: "text-red-500" },
    ],
    internet: [
      { id: "spectranet", name: "Spectranet", color: "text-blue-500" },
      { id: "smile", name: "Smile", color: "text-purple-500" },
      { id: "swift", name: "Swift Networks", color: "text-indigo-500" },
      { id: "ntel", name: "ntel", color: "text-cyan-500" },
    ],
  },
  "US/Europe": {
    airtime: [
      { id: "verizon", name: "Verizon", color: "text-red-500" },
      { id: "tmobile", name: "T-Mobile", color: "text-pink-500" },
      { id: "att", name: "AT&T", color: "text-blue-500" },
      { id: "vodafone", name: "Vodafone", color: "text-red-600" },
      { id: "ee", name: "EE", color: "text-green-500" },
      { id: "o2", name: "O2", color: "text-blue-600" },
    ],
    data: [
      { id: "verizon-data", name: "Verizon Data", color: "text-red-500" },
      { id: "tmobile-data", name: "T-Mobile Data", color: "text-pink-500" },
      { id: "att-data", name: "AT&T Data", color: "text-blue-500" },
    ],
    electricity: [
      { id: "pge", name: "PG&E", color: "text-yellow-500" },
      { id: "coned", name: "Con Edison", color: "text-orange-500" },
      { id: "duke", name: "Duke Energy", color: "text-amber-500" },
      { id: "edf", name: "EDF Energy", color: "text-blue-500" },
      { id: "british-gas", name: "British Gas", color: "text-blue-600" },
    ],
    cable: [
      { id: "netflix", name: "Netflix", color: "text-red-500" },
      { id: "hulu", name: "Hulu", color: "text-green-500" },
      { id: "hbo", name: "HBO Max", color: "text-purple-500" },
      { id: "disney", name: "Disney+", color: "text-blue-500" },
      { id: "sky", name: "Sky", color: "text-blue-600" },
    ],
    internet: [
      { id: "xfinity", name: "Xfinity", color: "text-indigo-500" },
      { id: "spectrum", name: "Spectrum", color: "text-blue-500" },
      { id: "att-fiber", name: "AT&T Fiber", color: "text-blue-600" },
      { id: "virgin", name: "Virgin Media", color: "text-red-500" },
      { id: "bt", name: "BT Broadband", color: "text-indigo-600" },
    ],
  },
};

// Currency-specific placeholders
const currencyPlaceholders: Record<string, { phone: string; meter: string; smartcard: string }> = {
  NGN: { phone: "0801 234 5678", meter: "45678901234", smartcard: "1234567890" },
  KES: { phone: "0712 345 678", meter: "12345678", smartcard: "1234567890" },
  GHS: { phone: "024 123 4567", meter: "12345678901", smartcard: "1234567890" },
  ZAR: { phone: "082 123 4567", meter: "12345678901234", smartcard: "1234567890" },
  USD: { phone: "(555) 123-4567", meter: "123456789", smartcard: "1234567890" },
  EUR: { phone: "+49 123 456789", meter: "DE12345678", smartcard: "1234567890" },
  GBP: { phone: "07123 456789", meter: "A12B34567", smartcard: "1234567890" },
};

// Data plan options
const dataPlanOptions = [
  { value: "1gb", label: "1GB", price: 5 },
  { value: "2gb", label: "2GB", price: 10 },
  { value: "5gb", label: "5GB", price: 20 },
  { value: "10gb", label: "10GB", price: 35 },
  { value: "unlimited", label: "Unlimited", price: 50 },
];

// Cable TV plan options
const cablePlans = [
  { value: "basic", label: "Basic", price: 15 },
  { value: "standard", label: "Standard", price: 30 },
  { value: "premium", label: "Premium", price: 50 },
  { value: "sports", label: "Sports+", price: 65 },
  { value: "ultimate", label: "Ultimate", price: 85 },
];

// Country code mapping from currency
const currencyToCountry: Record<string, string> = {
  NGN: 'NG', KES: 'KE', GHS: 'GH', ZAR: 'ZA', USD: 'US', EUR: 'EU', GBP: 'GB'
};

// Validation patterns per country
const getValidationPattern = (countryCode: string, type: 'phone' | 'meter' | 'smartcard'): RegExp => {
  const patterns: Record<string, { phone: RegExp; meter: RegExp; smartcard: RegExp }> = {
    NG: { phone: /^0[789][01]\d{8}$/, meter: /^\d{11,13}$/, smartcard: /^\d{10,12}$/ },
    KE: { phone: /^0[17]\d{8}$/, meter: /^\d{8,11}$/, smartcard: /^\d{10}$/ },
    GH: { phone: /^0[235]\d{8}$/, meter: /^\d{11,13}$/, smartcard: /^\d{10}$/ },
    ZA: { phone: /^0[678]\d{8}$/, meter: /^\d{13,14}$/, smartcard: /^\d{10}$/ },
    US: { phone: /^\d{10}$/, meter: /^\d{9,12}$/, smartcard: /^\d{10}$/ },
    GB: { phone: /^0[1-9]\d{9}$/, meter: /^[A-Z0-9]{8,12}$/i, smartcard: /^\d{10}$/ },
    EU: { phone: /^\+?[0-9]{8,15}$/, meter: /^[A-Z]{2}[0-9A-Z]{8,16}$/i, smartcard: /^\d{10,14}$/ },
    DE: { phone: /^\+?49[0-9]{9,12}$/, meter: /^DE[0-9A-Z]{10,14}$/i, smartcard: /^\d{10,12}$/ },
    FR: { phone: /^\+?33[0-9]{9}$/, meter: /^[0-9]{14}$/, smartcard: /^\d{10}$/ },
  };
  return patterns[countryCode]?.[type] || patterns['EU']?.[type] || patterns['US'][type];
};

export default function Bills() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [utilityDialogOpen, setUtilityDialogOpen] = useState(false);
  const [utilityType, setUtilityType] = useState<"airtime" | "data" | "electricity" | "cable" | "internet">("airtime");
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [utilityForm, setUtilityForm] = useState({
    provider: "",
    phoneNumber: "",
    amount: "",
    meterNumber: "",
    smartCardNumber: "",
    plan: "",
  });
  const [formData, setFormData] = useState({
    name: "",
    provider: "",
    amount: "",
    dueDate: "",
    category: "Software",
  });

  const { data: settings } = useQuery<CompanySettings>({
    queryKey: ["/api/settings"],
  });

  // Currency and region configuration
  const currencySymbols: Record<string, string> = {
    USD: "$", EUR: "€", GBP: "£", NGN: "₦", KES: "KSh", GHS: "₵", ZAR: "R"
  };
  const currency = settings?.currency || "USD";
  const currencySymbol = currencySymbols[currency] || "$";
  const region = settings?.region === "Africa" ? "Africa" : "US/Europe";
  const placeholders = currencyPlaceholders[currency] || currencyPlaceholders["USD"];
  
  const formatCurrency = (amount: number) => {
    return `${currencySymbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Get region-specific utility providers
  const utilityProviders = utilityProvidersByRegion[region];
  const countryCode = currencyToCountry[currency] || 'US';

  const { data: bills, isLoading } = useQuery<Bill[]>({
    queryKey: ["/api/bills"],
  });

  // Fetch user wallet for balance display
  const { data: wallets } = useQuery<Wallet[]>({
    queryKey: ["/api/wallets"],
  });
  const userWallet = wallets?.[0];
  const walletBalance = parseFloat(String(userWallet?.balance || 0));

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

  const payUtilityMutation = useMutation({
    mutationFn: async (data: { 
      type: string; 
      provider: string; 
      amount: number; 
      reference: string;
      walletId?: string;
      countryCode: string;
      phoneNumber?: string;
      meterNumber?: string;
      smartCardNumber?: string;
    }) => {
      return apiRequest("POST", "/api/payments/utility", data);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
      toast({ 
        title: "Payment successful!", 
        description: `Your ${data?.type || 'utility'} payment has been processed via ${data?.paymentProvider || 'wallet'}.`
      });
      setUtilityDialogOpen(false);
      resetUtilityForm();
    },
    onError: (error: any) => {
      const errorMessage = error?.message || "Please try again or contact support.";
      toast({ 
        title: "Payment failed", 
        variant: "destructive", 
        description: errorMessage 
      });
    },
  });

  const resetForm = () => {
    setFormData({ name: "", provider: "", amount: "", dueDate: "", category: "Software" });
  };

  const resetUtilityForm = () => {
    setUtilityForm({ provider: "", phoneNumber: "", amount: "", meterNumber: "", smartCardNumber: "", plan: "" });
    setValidationErrors({});
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
      updateMutation.mutate({ id: editingBill.id, data: { ...formData, amount: formData.amount } });
    } else {
      createMutation.mutate(formData);
    }
  };

  const validateUtilityForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!utilityForm.provider) {
      errors.provider = "Please select a provider";
    }

    if (utilityType === "airtime" || utilityType === "data") {
      const cleanPhone = utilityForm.phoneNumber.replace(/[\s\-\(\)]/g, '');
      const pattern = getValidationPattern(countryCode, 'phone');
      if (!cleanPhone) {
        errors.phoneNumber = "Phone number is required";
      } else if (!pattern.test(cleanPhone)) {
        errors.phoneNumber = `Invalid phone number format for ${countryCode}`;
      }
    }

    if (utilityType === "electricity" || utilityType === "internet") {
      const pattern = getValidationPattern(countryCode, 'meter');
      if (!utilityForm.meterNumber) {
        errors.meterNumber = "Meter/Account number is required";
      } else if (!pattern.test(utilityForm.meterNumber)) {
        errors.meterNumber = `Invalid meter number format for ${countryCode}`;
      }
    }

    if (utilityType === "cable") {
      const pattern = getValidationPattern(countryCode, 'smartcard');
      if (!utilityForm.smartCardNumber) {
        errors.smartCardNumber = "Smart card number is required";
      } else if (!pattern.test(utilityForm.smartCardNumber)) {
        errors.smartCardNumber = `Invalid smart card format for ${countryCode}`;
      }
    }

    if ((utilityType === "data" || utilityType === "cable") && !utilityForm.plan) {
      errors.plan = "Please select a plan";
    }

    if ((utilityType === "airtime" || utilityType === "electricity" || utilityType === "internet")) {
      const amount = parseFloat(utilityForm.amount);
      if (!utilityForm.amount || isNaN(amount) || amount <= 0) {
        errors.amount = "Please enter a valid amount";
      } else if (amount > walletBalance) {
        errors.amount = `Insufficient balance. Available: ${formatCurrency(walletBalance)}`;
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleUtilityPayment = () => {
    if (!validateUtilityForm()) {
      toast({ 
        title: "Validation Error", 
        variant: "destructive", 
        description: "Please fix the errors in the form" 
      });
      return;
    }

    const amount = utilityType === "data" 
      ? dataPlanOptions.find(p => p.value === utilityForm.plan)?.price || 0
      : utilityType === "cable"
      ? cablePlans.find(p => p.value === utilityForm.plan)?.price || 0
      : parseFloat(utilityForm.amount) || 0;
    
    // Check wallet balance
    if (amount > walletBalance) {
      toast({ 
        title: "Insufficient Balance", 
        variant: "destructive", 
        description: `You need ${formatCurrency(amount)} but only have ${formatCurrency(walletBalance)}` 
      });
      return;
    }
    
    const reference = utilityType === "electricity" || utilityType === "internet" 
      ? utilityForm.meterNumber 
      : utilityType === "cable" 
      ? utilityForm.smartCardNumber 
      : utilityForm.phoneNumber;
    
    payUtilityMutation.mutate({
      type: utilityType,
      provider: utilityForm.provider,
      amount,
      reference,
      walletId: userWallet?.id,
      countryCode,
      phoneNumber: utilityForm.phoneNumber || undefined,
      meterNumber: utilityForm.meterNumber || undefined,
      smartCardNumber: utilityForm.smartCardNumber || undefined,
    });
  };

  const openUtilityDialog = (type: typeof utilityType) => {
    setUtilityType(type);
    resetUtilityForm();
    setUtilityDialogOpen(true);
  };

  const filteredBills = bills?.filter(
    (bill) =>
      bill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bill.provider.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalBills = bills?.reduce((sum, b) => sum + Number(b.amount), 0) || 0;
  const paidBills = bills?.filter((b) => b.status === "Paid").reduce((sum, b) => sum + Number(b.amount), 0) || 0;
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

  const utilityServices = [
    { type: "airtime" as const, icon: Phone, label: "Airtime", color: "bg-green-500", description: "Top up mobile credit" },
    { type: "data" as const, icon: Wifi, label: "Data", color: "bg-blue-500", description: "Buy internet data" },
    { type: "electricity" as const, icon: Zap, label: "Electricity", color: "bg-yellow-500", description: "Pay power bills" },
    { type: "cable" as const, icon: Tv, label: "Cable TV", color: "bg-purple-500", description: "TV subscriptions" },
    { type: "internet" as const, icon: Globe, label: "Internet", color: "bg-indigo-500", description: "Broadband bills" },
  ];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 texture-mesh min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="secondary" className="text-xs font-bold uppercase tracking-widest bg-primary/10 text-primary">
              <Sparkles className="h-3 w-3 mr-1" />Bills & Utilities
            </Badge>
          </div>
          <h1 className="text-3xl font-black tracking-tight" data-testid="text-bills-title">Bills & Payments</h1>
          <p className="text-muted-foreground mt-1">Manage bills, utilities, and recurring payments.</p>
        </div>
        <Button onClick={() => { resetForm(); setEditingBill(null); setIsOpen(true); }} className="gap-2" data-testid="button-add-bill">
          <Plus className="h-4 w-4" />
          Add Bill
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {utilityServices.map((service) => (
          <Card 
            key={service.type}
            className="card-hover cursor-pointer group border-2 border-transparent hover:border-primary/20 transition-all"
            onClick={() => openUtilityDialog(service.type)}
            data-testid={`button-utility-${service.type}`}
          >
            <CardContent className="p-4 text-center">
              <div className={`w-12 h-12 rounded-2xl ${service.color} flex items-center justify-center mx-auto mb-3 shadow-lg group-hover:scale-110 transition-transform`}>
                <service.icon className="h-6 w-6 text-white" />
              </div>
              <p className="font-bold text-sm">{service.label}</p>
              <p className="text-xs text-muted-foreground mt-1">{service.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Total Bills</p>
              <div className="p-2 bg-primary/10 rounded-xl">
                <DollarSign className="h-4 w-4 text-primary" />
              </div>
            </div>
            {isLoading ? <Skeleton className="h-8 w-24" /> : (
              <p className="text-2xl font-black" data-testid="text-total-bills">{formatCurrency(totalBills)}</p>
            )}
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Paid</p>
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl">
                <CheckCircle className="h-4 w-4 text-emerald-600" />
              </div>
            </div>
            {isLoading ? <Skeleton className="h-8 w-24" /> : (
              <p className="text-2xl font-black text-emerald-600">{formatCurrency(paidBills)}</p>
            )}
          </CardContent>
        </Card>
        <Card className="glass">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Unpaid</p>
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-xl">
                <Clock className="h-4 w-4 text-amber-600" />
              </div>
            </div>
            {isLoading ? <Skeleton className="h-8 w-24" /> : (
              <p className="text-2xl font-black text-amber-600">{formatCurrency(unpaidBills)}</p>
            )}
          </CardContent>
        </Card>
        <Card className={`glass ${overdueBills > 0 ? "border-red-200 dark:border-red-900" : ""}`}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Overdue</p>
              <div className={`p-2 rounded-xl ${overdueBills > 0 ? "bg-red-100 dark:bg-red-900/30" : "bg-muted"}`}>
                <AlertTriangle className={`h-4 w-4 ${overdueBills > 0 ? "text-red-600" : "text-muted-foreground"}`} />
              </div>
            </div>
            {isLoading ? <Skeleton className="h-8 w-24" /> : (
              <p className={`text-2xl font-black ${overdueBills > 0 ? "text-red-600" : ""}`}>{overdueBills}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="glass">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search bills..."
              className="pl-10 bg-background/50"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-search-bills"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="glass overflow-hidden">
        <CardHeader className="border-b bg-muted/30">
          <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            All Bills
          </CardTitle>
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
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
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
                      <p className="text-base font-bold">{formatCurrency(Number(bill.amount))}</p>
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
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto mb-4">
                <FileText className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-bold mb-1">No bills yet</h3>
              <p className="text-sm text-muted-foreground mb-4">Start by adding your first bill.</p>
              <Button onClick={() => setIsOpen(true)}><Plus className="h-4 w-4 mr-2" />Add Bill</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {editingBill ? "Edit Bill" : "Add New Bill"}
            </DialogTitle>
            <DialogDescription>{editingBill ? "Update the bill details." : "Add a new recurring bill to track."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Bill Name</Label>
              <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g., AWS Hosting" className="bg-muted/50" data-testid="input-bill-name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="provider">Provider</Label>
              <Input id="provider" value={formData.provider} onChange={(e) => setFormData({ ...formData, provider: e.target.value })} placeholder="e.g., Amazon Web Services" className="bg-muted/50" data-testid="input-bill-provider" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount ({currencySymbol})</Label>
                <Input id="amount" type="number" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} placeholder="0.00" className="bg-muted/50" data-testid="input-bill-amount" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dueDate">Due Date</Label>
                <Input id="dueDate" type="date" value={formData.dueDate} onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })} className="bg-muted/50" data-testid="input-bill-due-date" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                <SelectTrigger className="bg-muted/50" data-testid="select-bill-category"><SelectValue /></SelectTrigger>
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

      <Dialog open={utilityDialogOpen} onOpenChange={setUtilityDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {utilityType === "airtime" && <Phone className="h-5 w-5 text-green-500" />}
              {utilityType === "data" && <Wifi className="h-5 w-5 text-blue-500" />}
              {utilityType === "electricity" && <Zap className="h-5 w-5 text-yellow-500" />}
              {utilityType === "cable" && <Tv className="h-5 w-5 text-purple-500" />}
              {utilityType === "internet" && <Globe className="h-5 w-5 text-indigo-500" />}
              Pay {utilityType.charAt(0).toUpperCase() + utilityType.slice(1)}
            </DialogTitle>
            <DialogDescription>
              {utilityType === "airtime" && "Top up your mobile phone instantly"}
              {utilityType === "data" && "Purchase data bundles for your device"}
              {utilityType === "electricity" && "Pay your electricity bill securely"}
              {utilityType === "cable" && "Renew your TV subscription"}
              {utilityType === "internet" && "Pay your internet service bill"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 bg-primary/10 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Wallet Balance</span>
              </div>
              <span className="font-bold text-primary" data-testid="text-wallet-balance">
                {formatCurrency(walletBalance)}
              </span>
            </div>
            
            <div className="space-y-2">
              <Label>Select Provider {validationErrors.provider && <span className="text-red-500 text-xs ml-2">{validationErrors.provider}</span>}</Label>
              <div className="grid grid-cols-3 gap-2">
                {utilityProviders[utilityType]?.slice(0, 6).map((provider) => {
                  const ProviderIcon = utilityType === "airtime" ? Phone 
                    : utilityType === "data" ? Wifi 
                    : utilityType === "electricity" ? Zap 
                    : utilityType === "cable" ? Tv 
                    : Globe;
                  return (
                    <button
                      key={provider.id}
                      type="button"
                      onClick={() => {
                        setUtilityForm({ ...utilityForm, provider: provider.id });
                        setValidationErrors(prev => ({ ...prev, provider: '' }));
                      }}
                      className={`p-3 rounded-xl border-2 text-center transition-all ${
                        utilityForm.provider === provider.id 
                          ? "border-primary bg-primary/10" 
                          : validationErrors.provider
                          ? "border-red-300 hover:border-red-400"
                          : "border-border hover:border-primary/50"
                      }`}
                      data-testid={`provider-${provider.id}`}
                    >
                      <ProviderIcon className={`h-5 w-5 mx-auto ${provider.color}`} />
                      <p className="text-xs font-medium mt-1 truncate">{provider.name}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {(utilityType === "airtime" || utilityType === "data") && (
              <div className="space-y-2">
                <Label htmlFor="phone">
                  Phone Number
                  {validationErrors.phoneNumber && <span className="text-red-500 text-xs ml-2">{validationErrors.phoneNumber}</span>}
                </Label>
                <Input 
                  id="phone" 
                  type="tel" 
                  value={utilityForm.phoneNumber} 
                  onChange={(e) => {
                    setUtilityForm({ ...utilityForm, phoneNumber: e.target.value });
                    setValidationErrors(prev => ({ ...prev, phoneNumber: '' }));
                  }} 
                  placeholder={placeholders.phone} 
                  className={`bg-muted/50 ${validationErrors.phoneNumber ? 'border-red-500' : ''}`}
                  data-testid="input-phone"
                />
              </div>
            )}

            {utilityType === "electricity" && (
              <div className="space-y-2">
                <Label htmlFor="meter">
                  Meter Number
                  {validationErrors.meterNumber && <span className="text-red-500 text-xs ml-2">{validationErrors.meterNumber}</span>}
                </Label>
                <Input 
                  id="meter" 
                  value={utilityForm.meterNumber} 
                  onChange={(e) => {
                    setUtilityForm({ ...utilityForm, meterNumber: e.target.value });
                    setValidationErrors(prev => ({ ...prev, meterNumber: '' }));
                  }} 
                  placeholder={placeholders.meter} 
                  className={`bg-muted/50 ${validationErrors.meterNumber ? 'border-red-500' : ''}`}
                  data-testid="input-meter"
                />
              </div>
            )}

            {utilityType === "cable" && (
              <div className="space-y-2">
                <Label htmlFor="smartcard">
                  Smart Card Number
                  {validationErrors.smartCardNumber && <span className="text-red-500 text-xs ml-2">{validationErrors.smartCardNumber}</span>}
                </Label>
                <Input 
                  id="smartcard" 
                  value={utilityForm.smartCardNumber} 
                  onChange={(e) => {
                    setUtilityForm({ ...utilityForm, smartCardNumber: e.target.value });
                    setValidationErrors(prev => ({ ...prev, smartCardNumber: '' }));
                  }} 
                  placeholder={placeholders.smartcard} 
                  className={`bg-muted/50 ${validationErrors.smartCardNumber ? 'border-red-500' : ''}`}
                  data-testid="input-smartcard"
                />
              </div>
            )}

            {utilityType === "internet" && (
              <div className="space-y-2">
                <Label htmlFor="account">
                  Account Number
                  {validationErrors.meterNumber && <span className="text-red-500 text-xs ml-2">{validationErrors.meterNumber}</span>}
                </Label>
                <Input 
                  id="account" 
                  value={utilityForm.meterNumber} 
                  onChange={(e) => {
                    setUtilityForm({ ...utilityForm, meterNumber: e.target.value });
                    setValidationErrors(prev => ({ ...prev, meterNumber: '' }));
                  }} 
                  placeholder={placeholders.meter} 
                  className={`bg-muted/50 ${validationErrors.meterNumber ? 'border-red-500' : ''}`}
                  data-testid="input-account"
                />
              </div>
            )}

            {utilityType === "data" && (
              <div className="space-y-2">
                <Label>
                  Select Data Plan
                  {validationErrors.plan && <span className="text-red-500 text-xs ml-2">{validationErrors.plan}</span>}
                </Label>
                <Select 
                  value={utilityForm.plan} 
                  onValueChange={(value) => {
                    setUtilityForm({ ...utilityForm, plan: value });
                    setValidationErrors(prev => ({ ...prev, plan: '' }));
                  }}
                >
                  <SelectTrigger className={`bg-muted/50 ${validationErrors.plan ? 'border-red-500' : ''}`} data-testid="select-data-plan">
                    <SelectValue placeholder="Choose a plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {dataPlanOptions.map((plan) => (
                      <SelectItem key={plan.value} value={plan.value}>
                        {plan.label} - {formatCurrency(plan.price)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {utilityType === "cable" && (
              <div className="space-y-2">
                <Label>
                  Select Package
                  {validationErrors.plan && <span className="text-red-500 text-xs ml-2">{validationErrors.plan}</span>}
                </Label>
                <Select 
                  value={utilityForm.plan} 
                  onValueChange={(value) => {
                    setUtilityForm({ ...utilityForm, plan: value });
                    setValidationErrors(prev => ({ ...prev, plan: '' }));
                  }}
                >
                  <SelectTrigger className={`bg-muted/50 ${validationErrors.plan ? 'border-red-500' : ''}`} data-testid="select-cable-plan">
                    <SelectValue placeholder="Choose a package" />
                  </SelectTrigger>
                  <SelectContent>
                    {cablePlans.map((plan) => (
                      <SelectItem key={plan.value} value={plan.value}>
                        {plan.label} - {formatCurrency(plan.price)}/month
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {(utilityType === "airtime" || utilityType === "electricity" || utilityType === "internet") && (
              <div className="space-y-2">
                <Label htmlFor="utility-amount">
                  Amount ({currencySymbol})
                  {validationErrors.amount && <span className="text-red-500 text-xs ml-2">{validationErrors.amount}</span>}
                </Label>
                <Input 
                  id="utility-amount" 
                  type="number" 
                  value={utilityForm.amount} 
                  onChange={(e) => {
                    setUtilityForm({ ...utilityForm, amount: e.target.value });
                    setValidationErrors(prev => ({ ...prev, amount: '' }));
                  }} 
                  placeholder="0.00" 
                  className={`bg-muted/50 ${validationErrors.amount ? 'border-red-500' : ''}`}
                  data-testid="input-utility-amount"
                />
                {utilityType === "airtime" && (
                  <div className="grid grid-cols-4 gap-2 mt-2">
                    {[5, 10, 20, 50].map((amount) => (
                      <Button 
                        key={amount} 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setUtilityForm({ ...utilityForm, amount: String(amount) })}
                        className="text-xs"
                      >
                        {formatCurrency(amount)}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="p-4 bg-muted/50 rounded-xl space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-bold">
                  {currencySymbol}{utilityType === "data" 
                    ? (dataPlanOptions.find(p => p.value === utilityForm.plan)?.price || 0).toFixed(2)
                    : utilityType === "cable"
                    ? (cablePlans.find(p => p.value === utilityForm.plan)?.price || 0).toFixed(2)
                    : parseFloat(utilityForm.amount || "0").toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Fee</span>
                <span className="font-bold text-emerald-600">{currencySymbol}0.00</span>
              </div>
              <div className="border-t pt-2 flex justify-between">
                <span className="font-bold">Total</span>
                <span className="font-bold text-primary">
                  {currencySymbol}{utilityType === "data" 
                    ? (dataPlanOptions.find(p => p.value === utilityForm.plan)?.price || 0).toFixed(2)
                    : utilityType === "cable"
                    ? (cablePlans.find(p => p.value === utilityForm.plan)?.price || 0).toFixed(2)
                    : parseFloat(utilityForm.amount || "0").toFixed(2)}
                </span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUtilityDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleUtilityPayment} 
              disabled={
                payUtilityMutation.isPending || 
                !utilityForm.provider ||
                ((utilityType === "airtime" || utilityType === "data") && !utilityForm.phoneNumber) ||
                (utilityType === "electricity" && !utilityForm.meterNumber) ||
                (utilityType === "cable" && !utilityForm.smartCardNumber) ||
                (utilityType === "internet" && !utilityForm.meterNumber) ||
                ((utilityType === "data" || utilityType === "cable") && !utilityForm.plan) ||
                ((utilityType === "airtime" || utilityType === "electricity" || utilityType === "internet") && !utilityForm.amount)
              } 
              data-testid="button-pay-utility"
            >
              {payUtilityMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Pay Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
