import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
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
import { motion } from "framer-motion";
import type { Bill, CompanySettings, Wallet } from "@shared/schema";
import { getCurrencySymbol, formatCurrencyAmount, PAYMENT_LIMITS } from "@/lib/constants";
import { PinVerificationDialog, usePinVerification } from "@/components/pin-verification-dialog";
import {
  PageWrapper,
  PageHeader,
  MetricCard,
  StatusBadge,
  AnimatedListItem,
  EmptyState,
  GlassCard,
  FormField,
  SuccessFeedback,
  WarningFeedback,
  InfoFeedback,
  fadeUp,
  stagger,
} from "@/components/ui-extended";

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
  const [billFormErrors, setBillFormErrors] = useState<Record<string, string>>({});

  const { data: settings } = useQuery<CompanySettings>({
    queryKey: ["/api/settings"],
  });

  const { isPinRequired, isPinDialogOpen, setIsPinDialogOpen, requirePin, handlePinVerified } = usePinVerification();

  const currency = settings?.currency || "USD";
  const currencySymbol = getCurrencySymbol(currency);
  const region = settings?.region === "Africa" ? "Africa" : "US/Europe";
  const placeholders = currencyPlaceholders[currency] || currencyPlaceholders["USD"];
  
  const formatCurrency = (amount: number) => {
    return formatCurrencyAmount(amount, currency);
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
      if (userWallet?.id) {
        return apiRequest("POST", `/api/bills/${id}/pay`, { walletId: userWallet.id });
      }
      return apiRequest("PATCH", `/api/bills/${id}`, { status: "Paid" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bills"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/balances"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      toast({ title: "Bill paid successfully", description: "Payment has been deducted from your wallet." });
    },
    onError: (error: any) => {
      toast({ title: "Failed to pay bill", description: error.message, variant: "destructive" });
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
      queryClient.invalidateQueries({ queryKey: ["/api/balances"] });
      toast({ 
        title: "Payment successful!", 
        description: `Your ${data?.type || 'utility'} payment has been processed via ${data?.paymentProvider || 'wallet'}.`
      });
      setUtilityDialogOpen(false);
      resetUtilityForm();
    },
    onError: (error: any) => {
      // Extract detailed error message from response
      let errorMessage = "Please try again or contact support.";
      if (error?.message) {
        errorMessage = error.message;
      }
      // Check for specific balance error
      const isBalanceError = errorMessage.toLowerCase().includes('insufficient') || 
                            errorMessage.toLowerCase().includes('balance');
      toast({ 
        title: isBalanceError ? "Insufficient Balance" : "Payment failed", 
        variant: "destructive", 
        description: errorMessage 
      });
    },
  });

  const resetForm = () => {
    setFormData({ name: "", provider: "", amount: "", dueDate: "", category: "Software" });
    setBillFormErrors({});
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
    setBillFormErrors({});
    setIsOpen(true);
  };

  const validateBillForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      errors.name = "Bill name is required";
    } else if (formData.name.trim().length < 2) {
      errors.name = "Bill name must be at least 2 characters";
    } else if (formData.name.trim().length > 100) {
      errors.name = "Bill name must be less than 100 characters";
    }
    
    if (!formData.provider.trim()) {
      errors.provider = "Provider is required";
    } else if (formData.provider.trim().length < 2) {
      errors.provider = "Provider name must be at least 2 characters";
    }
    
    const amount = parseFloat(formData.amount);
    if (!formData.amount) {
      errors.amount = "Amount is required";
    } else if (isNaN(amount) || amount <= 0) {
      errors.amount = "Please enter a valid positive amount";
    } else if (amount > 1000000000) {
      errors.amount = "Amount exceeds maximum limit";
    }
    
    if (!formData.dueDate) {
      errors.dueDate = "Due date is required";
    } else {
      const selectedDate = new Date(formData.dueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selectedDate < today && !editingBill) {
        errors.dueDate = "Due date cannot be in the past";
      }
    }
    
    if (!formData.category) {
      errors.category = "Category is required";
    }
    
    setBillFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateBillForm()) {
      toast({ 
        title: "Validation Error", 
        variant: "destructive", 
        description: "Please fix the errors in the form" 
      });
      return;
    }
    
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

    if (utilityType === "data") {
      if (!utilityForm.plan) {
        errors.plan = "Please select a data plan";
      } else {
        const selectedPlan = dataPlanOptions.find(p => p.value === utilityForm.plan);
        if (selectedPlan && selectedPlan.price > walletBalance) {
          errors.plan = `Insufficient balance for this plan. Available: ${formatCurrency(walletBalance)}`;
        }
      }
    }

    if (utilityType === "cable") {
      if (!utilityForm.plan) {
        errors.plan = "Please select a cable package";
      } else {
        const selectedPlan = cablePlans.find(p => p.value === utilityForm.plan);
        if (selectedPlan && selectedPlan.price > walletBalance) {
          errors.plan = `Insufficient balance for this package. Available: ${formatCurrency(walletBalance)}`;
        }
      }
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
    
    requirePin(() => payUtilityMutation.mutate({
      type: utilityType,
      provider: utilityForm.provider,
      amount,
      reference,
      walletId: userWallet?.id,
      countryCode,
      phoneNumber: utilityForm.phoneNumber || undefined,
      meterNumber: utilityForm.meterNumber || undefined,
      smartCardNumber: utilityForm.smartCardNumber || undefined,
    }));
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
    <PageWrapper>
      <PageHeader
        title="Bills & Payments"
        subtitle="Manage bills, utilities, and recurring payments"
        badge="Bills & Utilities"
        badgeVariant="default"
        icon={Sparkles}
        actions={
          <Button
            onClick={() => {
              resetForm();
              setEditingBill(null);
              setIsOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Add Bill
          </Button>
        }
      />

      <motion.div
        className="space-y-8"
        initial="hidden"
        animate="visible"
        variants={stagger}
      >
        <motion.div variants={fadeUp}>
          <h3 className="text-lg font-bold mb-4 text-slate-900 dark:text-slate-100">
            Utility Services
          </h3>
          <div className="overflow-x-auto pb-2">
            <div className="flex gap-3 min-w-min md:grid md:grid-cols-5 md:gap-4">
              {utilityServices.map((service, idx) => (
                <motion.button
                  key={service.type}
                  variants={fadeUp}
                  onClick={() => openUtilityDialog(service.type)}
                  data-testid={`button-utility-${service.type}`}
                  className="flex-shrink-0 w-40 md:w-full group"
                >
                  <GlassCard className="p-4 text-center h-full hover:scale-105 transition-transform cursor-pointer">
                    <div className={`w-14 h-14 rounded-xl ${service.color} flex items-center justify-center mx-auto mb-3 shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all`}>
                      <service.icon className="h-6 w-6 text-white" />
                    </div>
                    <p className="font-bold text-sm text-slate-900 dark:text-slate-100">
                      {service.label}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {service.description}
                    </p>
                  </GlassCard>
                </motion.button>
              ))}
            </div>
          </div>
        </motion.div>

        <motion.div variants={fadeUp}>
          <h3 className="text-lg font-bold mb-4 text-slate-900 dark:text-slate-100">
            Summary
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Total Bills"
              value={isLoading ? <Skeleton className="h-8 w-24" /> : formatCurrency(totalBills)}
              icon={DollarSign}
              color="violet"
              data-testid="text-total-bills"
            />
            <MetricCard
              title="Paid"
              value={isLoading ? <Skeleton className="h-8 w-24" /> : formatCurrency(paidBills)}
              icon={CheckCircle}
              color="emerald"
            />
            <MetricCard
              title="Unpaid"
              value={isLoading ? <Skeleton className="h-8 w-24" /> : formatCurrency(unpaidBills)}
              icon={Clock}
              color="amber"
            />
            <MetricCard
              title="Overdue"
              value={isLoading ? <Skeleton className="h-8 w-24" /> : overdueBills}
              icon={AlertTriangle}
              color={overdueBills > 0 ? "rose" : "cyan"}
            />
          </div>
        </motion.div>

        <motion.div variants={fadeUp}>
          <GlassCard className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search bills by name or provider..."
                className="pl-10 bg-background/50 border-slate-200 dark:border-slate-700"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search-bills"
              />
            </div>
          </GlassCard>
        </motion.div>

        <motion.div variants={fadeUp}>
          <h3 className="text-lg font-bold mb-4 text-slate-900 dark:text-slate-100">
            All Bills
          </h3>
          <GlassCard className="overflow-hidden">
            {isLoading ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3, 4].map((i) => (
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
            ) : filteredBills && filteredBills.length > 0 ? (
              <motion.div
                className="divide-y divide-slate-200 dark:divide-slate-700"
                initial="hidden"
                animate="visible"
                variants={stagger}
              >
                {filteredBills.map((bill, idx) => (
                  <AnimatedListItem
                    key={bill.id}
                    delay={idx * 0.05}
                    data-testid={`bill-row-${bill.id}`}
                  >
                    <div
                      className={`flex items-center justify-between p-5 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors ${
                        bill.status === "Overdue"
                          ? "bg-rose-50/30 dark:bg-rose-900/10"
                          : ""
                      }`}
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-500/5 flex items-center justify-center flex-shrink-0">
                          <FileText className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                            {bill.name}
                          </p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {bill.provider}
                            </span>
                            <span className="text-xs text-slate-400">•</span>
                            <span className="text-xs px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {bill.category}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 ml-4">
                        <div className="text-right hidden sm:block">
                          <p className="text-base font-bold text-slate-900 dark:text-slate-100">
                            {formatCurrency(Number(bill.amount))}
                          </p>
                          <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 mt-1">
                            <Calendar className="h-3 w-3" />
                            <span>
                              {new Date(bill.dueDate).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        <StatusBadge status={bill.status} />

                        {bill.status === "Unpaid" && (
                          <Button
                            size="sm"
                            onClick={() => payBillMutation.mutate(bill.id)}
                            disabled={payBillMutation.isPending}
                            data-testid={`button-pay-${bill.id}`}
                            className="bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-700 hover:to-violet-800 text-white shadow-lg hover:shadow-xl transition-all"
                          >
                            {payBillMutation.isPending && (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            )}
                            Pay
                          </Button>
                        )}

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(bill)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-rose-600 dark:text-rose-400 focus:bg-rose-50 dark:focus:bg-rose-900/20"
                              onClick={() => deleteMutation.mutate(bill.id)}
                            >
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
                icon={FileText}
                title="No bills yet"
                description="Start by adding your first bill to track payments."
                action={{
                  label: "Add Bill",
                  icon: Plus,
                  onClick: () => setIsOpen(true),
                }}
              />
            )}
          </GlassCard>
        </motion.div>
      </motion.div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md bg-slate-950 dark:bg-slate-950 border-slate-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-100">
              <div className="p-2 bg-gradient-to-br from-violet-600/20 to-violet-700/20 rounded-lg">
                <FileText className="h-5 w-5 text-violet-500" />
              </div>
              {editingBill ? "Edit Bill" : "Add New Bill"}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {editingBill
                ? "Update the bill details."
                : "Add a new recurring bill to track."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <FormField
              label="Bill Name"
              error={billFormErrors.name}
              required
            >
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  setBillFormErrors((prev) => ({ ...prev, name: "" }));
                }}
                placeholder="e.g., AWS Hosting"
                className="bg-muted/30 border-slate-700 text-slate-100 placeholder:text-slate-500"
                data-testid="input-bill-name"
              />
            </FormField>

            <FormField
              label="Provider"
              error={billFormErrors.provider}
              required
            >
              <Input
                id="provider"
                value={formData.provider}
                onChange={(e) => {
                  setFormData({ ...formData, provider: e.target.value });
                  setBillFormErrors((prev) => ({ ...prev, provider: "" }));
                }}
                placeholder="e.g., Amazon Web Services"
                className="bg-muted/30 border-slate-700 text-slate-100 placeholder:text-slate-500"
                data-testid="input-bill-provider"
              />
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                label={`Amount (${currencySymbol})`}
                error={billFormErrors.amount}
                required
              >
                <Input
                  id="amount"
                  type="number"
                  value={formData.amount}
                  onChange={(e) => {
                    setFormData({ ...formData, amount: e.target.value });
                    setBillFormErrors((prev) => ({ ...prev, amount: "" }));
                  }}
                  placeholder="0.00"
                  className="bg-muted/30 border-slate-700 text-slate-100 placeholder:text-slate-500"
                  data-testid="input-bill-amount"
                />
              </FormField>

              <FormField
                label="Due Date"
                error={billFormErrors.dueDate}
                required
              >
                <Input
                  id="dueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => {
                    setFormData({ ...formData, dueDate: e.target.value });
                    setBillFormErrors((prev) => ({ ...prev, dueDate: "" }));
                  }}
                  className="bg-muted/30 border-slate-700 text-slate-100"
                  data-testid="input-bill-due-date"
                />
              </FormField>
            </div>

            <FormField
              label="Category"
              error={billFormErrors.category}
              required
            >
              <Select
                value={formData.category}
                onValueChange={(value) => {
                  setFormData({ ...formData, category: value });
                  setBillFormErrors((prev) => ({ ...prev, category: "" }));
                }}
              >
                <SelectTrigger
                  className="bg-muted/30 border-slate-700 text-slate-100"
                  data-testid="select-bill-category"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800">
                  <SelectItem value="Software">Software</SelectItem>
                  <SelectItem value="Office">Office</SelectItem>
                  <SelectItem value="Utilities">Utilities</SelectItem>
                  <SelectItem value="Marketing">Marketing</SelectItem>
                  <SelectItem value="Legal">Legal</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            {Object.keys(billFormErrors).length > 0 && (
              <WarningFeedback
                title="Please fix the errors"
                message="Check all required fields before submitting"
              />
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-submit-bill"
              className="bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-700 hover:to-violet-800 text-white shadow-lg"
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              )}
              {editingBill ? "Update Bill" : "Add Bill"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={utilityDialogOpen} onOpenChange={setUtilityDialogOpen}>
        <DialogContent className="sm:max-w-md bg-slate-950 dark:bg-slate-950 border-slate-800 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-100">
              <div className="p-2 bg-gradient-to-br from-violet-600/20 to-violet-700/20 rounded-lg">
                {utilityType === "airtime" && <Phone className="h-5 w-5 text-emerald-500" />}
                {utilityType === "data" && <Wifi className="h-5 w-5 text-cyan-500" />}
                {utilityType === "electricity" && <Zap className="h-5 w-5 text-amber-500" />}
                {utilityType === "cable" && <Tv className="h-5 w-5 text-violet-500" />}
                {utilityType === "internet" && <Globe className="h-5 w-5 text-cyan-500" />}
              </div>
              Pay {utilityType.charAt(0).toUpperCase() + utilityType.slice(1)}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {utilityType === "airtime" && "Top up your mobile phone instantly"}
              {utilityType === "data" && "Purchase data bundles for your device"}
              {utilityType === "electricity" && "Pay your electricity bill securely"}
              {utilityType === "cable" && "Renew your TV subscription"}
              {utilityType === "internet" && "Pay your internet service bill"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <InfoFeedback
              title="Wallet Balance"
              message={formatCurrency(walletBalance)}
              icon={CreditCard}
            />

            <FormField label="Select Provider" error={validationErrors.provider} required>
              <div className="grid grid-cols-3 gap-2">
                {utilityProviders[utilityType]?.slice(0, 6).map((provider) => {
                  const ProviderIcon =
                    utilityType === "airtime"
                      ? Phone
                      : utilityType === "data"
                        ? Wifi
                        : utilityType === "electricity"
                          ? Zap
                          : utilityType === "cable"
                            ? Tv
                            : Globe;
                  return (
                    <motion.button
                      key={provider.id}
                      type="button"
                      onClick={() => {
                        setUtilityForm({ ...utilityForm, provider: provider.id });
                        setValidationErrors((prev) => ({ ...prev, provider: "" }));
                      }}
                      whileHover={{ scale: 1.05 }}
                      className={`p-3 rounded-xl border-2 text-center transition-all ${
                        utilityForm.provider === provider.id
                          ? "border-violet-500 bg-violet-600/20"
                          : validationErrors.provider
                            ? "border-rose-400/50 bg-rose-900/10 hover:border-rose-400"
                            : "border-slate-700 bg-slate-800/50 hover:border-violet-500/50"
                      }`}
                      data-testid={`provider-${provider.id}`}
                    >
                      <ProviderIcon className={`h-5 w-5 mx-auto ${provider.color}`} />
                      <p className="text-xs font-medium mt-1 truncate text-slate-300">
                        {provider.name}
                      </p>
                    </motion.button>
                  );
                })}
              </div>
            </FormField>

            {(utilityType === "airtime" || utilityType === "data") && (
              <FormField
                label="Phone Number"
                error={validationErrors.phoneNumber}
                required
              >
                <Input
                  id="phone"
                  type="tel"
                  value={utilityForm.phoneNumber}
                  onChange={(e) => {
                    setUtilityForm({ ...utilityForm, phoneNumber: e.target.value });
                    setValidationErrors((prev) => ({ ...prev, phoneNumber: "" }));
                  }}
                  placeholder={placeholders.phone}
                  className="bg-muted/30 border-slate-700 text-slate-100 placeholder:text-slate-500"
                  data-testid="input-phone"
                />
              </FormField>
            )}

            {utilityType === "electricity" && (
              <FormField
                label="Meter Number"
                error={validationErrors.meterNumber}
                required
              >
                <Input
                  id="meter"
                  value={utilityForm.meterNumber}
                  onChange={(e) => {
                    setUtilityForm({ ...utilityForm, meterNumber: e.target.value });
                    setValidationErrors((prev) => ({ ...prev, meterNumber: "" }));
                  }}
                  placeholder={placeholders.meter}
                  className="bg-muted/30 border-slate-700 text-slate-100 placeholder:text-slate-500"
                  data-testid="input-meter"
                />
              </FormField>
            )}

            {utilityType === "cable" && (
              <FormField
                label="Smart Card Number"
                error={validationErrors.smartCardNumber}
                required
              >
                <Input
                  id="smartcard"
                  value={utilityForm.smartCardNumber}
                  onChange={(e) => {
                    setUtilityForm({ ...utilityForm, smartCardNumber: e.target.value });
                    setValidationErrors((prev) => ({ ...prev, smartCardNumber: "" }));
                  }}
                  placeholder={placeholders.smartcard}
                  className="bg-muted/30 border-slate-700 text-slate-100 placeholder:text-slate-500"
                  data-testid="input-smartcard"
                />
              </FormField>
            )}

            {utilityType === "internet" && (
              <FormField
                label="Account Number"
                error={validationErrors.meterNumber}
                required
              >
                <Input
                  id="account"
                  value={utilityForm.meterNumber}
                  onChange={(e) => {
                    setUtilityForm({ ...utilityForm, meterNumber: e.target.value });
                    setValidationErrors((prev) => ({ ...prev, meterNumber: "" }));
                  }}
                  placeholder={placeholders.meter}
                  className="bg-muted/30 border-slate-700 text-slate-100 placeholder:text-slate-500"
                  data-testid="input-account"
                />
              </FormField>
            )}

            {utilityType === "data" && (
              <FormField
                label="Select Data Plan"
                error={validationErrors.plan}
                required
              >
                <Select
                  value={utilityForm.plan}
                  onValueChange={(value) => {
                    setUtilityForm({ ...utilityForm, plan: value });
                    setValidationErrors((prev) => ({ ...prev, plan: "" }));
                  }}
                >
                  <SelectTrigger
                    className="bg-muted/30 border-slate-700 text-slate-100"
                    data-testid="select-data-plan"
                  >
                    <SelectValue placeholder="Choose a plan" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800">
                    {dataPlanOptions.map((plan) => (
                      <SelectItem key={plan.value} value={plan.value}>
                        {plan.label} - {formatCurrency(plan.price)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            )}

            {utilityType === "cable" && (
              <FormField
                label="Select Package"
                error={validationErrors.plan}
                required
              >
                <Select
                  value={utilityForm.plan}
                  onValueChange={(value) => {
                    setUtilityForm({ ...utilityForm, plan: value });
                    setValidationErrors((prev) => ({ ...prev, plan: "" }));
                  }}
                >
                  <SelectTrigger
                    className="bg-muted/30 border-slate-700 text-slate-100"
                    data-testid="select-cable-plan"
                  >
                    <SelectValue placeholder="Choose a package" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800">
                    {cablePlans.map((plan) => (
                      <SelectItem key={plan.value} value={plan.value}>
                        {plan.label} - {formatCurrency(plan.price)}/month
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            )}

            {(utilityType === "airtime" ||
              utilityType === "electricity" ||
              utilityType === "internet") && (
              <FormField
                label={`Amount (${currencySymbol})`}
                error={validationErrors.amount}
                required
              >
                <Input
                  id="utility-amount"
                  type="number"
                  value={utilityForm.amount}
                  onChange={(e) => {
                    setUtilityForm({ ...utilityForm, amount: e.target.value });
                    setValidationErrors((prev) => ({ ...prev, amount: "" }));
                  }}
                  placeholder="0.00"
                  className="bg-muted/30 border-slate-700 text-slate-100 placeholder:text-slate-500"
                  data-testid="input-utility-amount"
                />
                {utilityType === "airtime" && (
                  <div className="grid grid-cols-4 gap-2 mt-3">
                    {[5, 10, 20, 50].map((amount) => (
                      <Button
                        key={amount}
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setUtilityForm({
                            ...utilityForm,
                            amount: String(amount),
                          })
                        }
                        className="text-xs border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-slate-100 rounded-xl"
                      >
                        {formatCurrency(amount)}
                      </Button>
                    ))}
                  </div>
                )}
              </FormField>
            )}

            <div className="p-4 bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-xl space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Amount</span>
                <span className="font-bold text-slate-100">
                  {currencySymbol}
                  {utilityType === "data"
                    ? (
                        dataPlanOptions.find((p) => p.value === utilityForm.plan)
                          ?.price || 0
                      ).toFixed(2)
                    : utilityType === "cable"
                      ? (
                          cablePlans.find((p) => p.value === utilityForm.plan)
                            ?.price || 0
                        ).toFixed(2)
                      : parseFloat(utilityForm.amount || "0").toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Fee</span>
                <span className="font-bold text-emerald-400">{currencySymbol}0.00</span>
              </div>
              <div className="border-t border-slate-700 pt-2 flex justify-between">
                <span className="font-bold text-slate-200">Total</span>
                <span className="font-bold text-violet-400">
                  {currencySymbol}
                  {utilityType === "data"
                    ? (
                        dataPlanOptions.find((p) => p.value === utilityForm.plan)
                          ?.price || 0
                      ).toFixed(2)
                    : utilityType === "cable"
                      ? (
                          cablePlans.find((p) => p.value === utilityForm.plan)
                            ?.price || 0
                        ).toFixed(2)
                      : parseFloat(utilityForm.amount || "0").toFixed(2)}
                </span>
              </div>
            </div>

            {Object.keys(validationErrors).length > 0 && (
              <WarningFeedback
                title="Please fix the errors"
                message="Check all required fields before paying"
              />
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUtilityDialogOpen(false)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUtilityPayment}
              disabled={
                payUtilityMutation.isPending ||
                !utilityForm.provider ||
                ((utilityType === "airtime" || utilityType === "data") &&
                  !utilityForm.phoneNumber) ||
                (utilityType === "electricity" && !utilityForm.meterNumber) ||
                (utilityType === "cable" && !utilityForm.smartCardNumber) ||
                (utilityType === "internet" && !utilityForm.meterNumber) ||
                ((utilityType === "data" || utilityType === "cable") &&
                  !utilityForm.plan) ||
                ((utilityType === "airtime" ||
                  utilityType === "electricity" ||
                  utilityType === "internet") &&
                  !utilityForm.amount)
              }
              data-testid="button-pay-utility"
              className="bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-700 hover:to-violet-800 text-white shadow-lg"
            >
              {payUtilityMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              )}
              Pay Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PinVerificationDialog
        open={isPinDialogOpen}
        onOpenChange={setIsPinDialogOpen}
        onVerified={handlePinVerified}
      />
    </PageWrapper>
  );
}
