import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatCurrencyAmount, SUPPORTED_COUNTRIES, getCountryConfig, getCurrencyForCountry, getBankDetailFormat, getBankDetailLabel, getBankListKey } from "@/lib/constants";
import { PageWrapper, PageHeader, MetricCard, StatusBadge, EmptyState, GlassCard, fadeUp, stagger } from "@/components/ui-extended";
import {
  Building2,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Mail,
  MapPin,
  Loader2,
  Send,
  TrendingUp,
  Clock,
  FileText,
  Eye,
  Edit2,
  AlertTriangle,
  Receipt,
  StickyNote,
  Landmark,
  ShieldCheck,
  Trash2,
  CreditCard,
} from "lucide-react";
import type { Vendor, Payout, CompanySettings, PayoutDestination } from "@shared/schema";

// ── Vendor payment status helpers ──────────────────────────────

type VendorPaymentStatus = "active" | "inactive" | "pending_setup";

function derivePaymentStatus(vendor: Vendor, hasPayoutDestinations: boolean): VendorPaymentStatus {
  if (!hasPayoutDestinations) return "pending_setup";

  if (vendor.lastPayment) {
    const lastDate = new Date(vendor.lastPayment);
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    if (lastDate >= ninetyDaysAgo) return "active";
    return "inactive";
  }

  // No last payment recorded - check if there's any totalPaid
  if (parseFloat(String(vendor.totalPaid) || "0") > 0) return "active";
  return "inactive";
}

function PaymentStatusBadge({ status }: { status: VendorPaymentStatus }) {
  switch (status) {
    case "active":
      return (
        <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-[11px] font-semibold gap-1 px-2 py-0.5" variant="outline">
          <CheckCircle2 className="h-3 w-3" />
          Active
        </Badge>
      );
    case "inactive":
      return (
        <Badge className="bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20 text-[11px] font-semibold gap-1 px-2 py-0.5" variant="outline">
          <Clock className="h-3 w-3" />
          Inactive
        </Badge>
      );
    case "pending_setup":
      return (
        <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 text-[11px] font-semibold gap-1 px-2 py-0.5" variant="outline">
          <AlertTriangle className="h-3 w-3" />
          Pending Setup
        </Badge>
      );
  }
}

// ── Main page ────────────────────────────────────────────────

export default function VendorsPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [detailVendor, setDetailVendor] = useState<Vendor | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [vendorForm, setVendorForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    category: "",
    paymentTerms: "net30",
    taxId: "",
    notes: "",
    bankCountry: "NG",
    bankCode: "",
    bankName: "",
    accountNumber: "",
    accountName: "",
    routingNumber: "",
  });

  const { data: settings } = useQuery<CompanySettings>({
    queryKey: ["/api/settings"],
  });

  const currency = settings?.currency || "USD";

  const formatCurrency = (amount: number | string) => {
    return formatCurrencyAmount(amount, currency);
  };

  const { data: vendors = [], isLoading } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"]
  });

  // Fetch payout destinations for all vendors to determine payment status
  const { data: allPayoutDestinations = [] } = useQuery<PayoutDestination[]>({
    queryKey: ["/api/payout-destinations"],
  });

  // Build a set of vendor IDs that have at least one payout destination
  const vendorIdsWithDestinations = new Set(
    allPayoutDestinations
      .filter((d) => d.vendorId)
      .map((d) => d.vendorId!)
  );

  const [isAddingVendor, setIsAddingVendor] = useState(false);

  const updateVendorMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      return apiRequest("PATCH", `/api/vendors/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
      setIsEditOpen(false);
      setEditingVendor(null);
      resetForm();
      toast({
        title: "Vendor updated",
        description: "The vendor has been updated successfully."
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update vendor. Please try again.",
        variant: "destructive"
      });
    }
  });

  const resetForm = () => {
    setVendorForm({ name: "", email: "", phone: "", address: "", category: "", paymentTerms: "net30", taxId: "", notes: "", bankCountry: "NG", bankCode: "", bankName: "", accountNumber: "", accountName: "", routingNumber: "" });
    setVendorAccountValidation(null);
  };

  // Account validation for vendor bank fields
  const [vendorAccountValidation, setVendorAccountValidation] = useState<{ validated: boolean; name: string } | null>(null);
  const [isVendorValidating, setIsVendorValidating] = useState(false);

  const validateVendorAccount = async () => {
    if (!vendorForm.bankCode || !vendorForm.accountNumber || vendorForm.bankCode === "OTHER") return;
    setIsVendorValidating(true);
    setVendorAccountValidation(null);
    try {
      const res = await apiRequest("POST", "/api/payment/verify-account", {
        bankCode: vendorForm.bankCode,
        accountNumber: vendorForm.accountNumber,
        country: vendorForm.bankCountry,
      });
      const data = await res.json();
      if (data.verified && data.accountName) {
        setVendorAccountValidation({ validated: true, name: data.accountName });
        setVendorForm((f) => ({ ...f, accountName: data.accountName }));
        toast({ title: "Account verified", description: data.accountName });
      } else {
        setVendorAccountValidation({ validated: false, name: "" });
        toast({ title: "Could not verify account", variant: "destructive" });
      }
    } catch {
      setVendorAccountValidation({ validated: false, name: "" });
      toast({ title: "Verification failed", variant: "destructive" });
    } finally {
      setIsVendorValidating(false);
    }
  };

  const totalVendors = vendors.length;
  const activeVendors = vendors.filter(v => v.status === "active").length;
  const totalPending = vendors.reduce((sum, v) => sum + parseFloat(String(v.pendingPayments) || "0"), 0);
  const totalPaidThisMonth = vendors.reduce((sum, v) => sum + parseFloat(String(v.totalPaid) || "0"), 0);

  const filteredVendors = vendors.filter(vendor =>
    vendor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    vendor.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddVendor = async () => {
    if (!vendorForm.name || !vendorForm.email) {
      toast({ title: "Name and email are required", variant: "destructive" });
      return;
    }
    setIsAddingVendor(true);
    try {
      const res = await apiRequest("POST", "/api/vendors", {
        name: vendorForm.name,
        email: vendorForm.email,
        phone: vendorForm.phone,
        address: vendorForm.address,
        category: vendorForm.category || "Other",
        paymentTerms: vendorForm.paymentTerms || "net30",
        taxId: vendorForm.taxId || undefined,
        notes: vendorForm.notes || undefined,
      });
      const newVendor = await res.json();
      // If bank details were provided, create a payout destination
      if (vendorForm.bankCode && vendorForm.accountNumber) {
        const countryConfig = getCountryConfig(vendorForm.bankCountry);
        try {
          await apiRequest("POST", "/api/payout-destinations", {
            vendorId: newVendor.id,
            type: "bank_account",
            bankName: vendorForm.bankName,
            bankCode: vendorForm.bankCode,
            accountNumber: vendorForm.accountNumber,
            accountName: vendorForm.accountName || vendorForm.name,
            routingNumber: vendorForm.routingNumber,
            provider: countryConfig?.provider || "stripe",
            currency: countryConfig?.currency || "USD",
            country: vendorForm.bankCountry,
          });
        } catch {
          // Vendor was created but bank failed — user can add bank later from detail dialog
          toast({ title: "Vendor added, but bank account could not be saved", description: "You can add it from the vendor detail page.", variant: "destructive" });
        }
      }
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payout-destinations"] });
      setIsAddOpen(false);
      resetForm();
      toast({ title: "Vendor added", description: "The vendor has been added successfully." });
    } catch {
      toast({ title: "Error", description: "Failed to add vendor. Please try again.", variant: "destructive" });
    } finally {
      setIsAddingVendor(false);
    }
  };

  const handleEditVendor = () => {
    if (!editingVendor) return;
    if (!vendorForm.name || !vendorForm.email) {
      toast({ title: "Name and email are required", variant: "destructive" });
      return;
    }
    updateVendorMutation.mutate({
      id: editingVendor.id,
      data: {
        name: vendorForm.name,
        email: vendorForm.email,
        phone: vendorForm.phone,
        address: vendorForm.address,
        category: vendorForm.category || "Other",
        paymentTerms: vendorForm.paymentTerms || "net30",
        taxId: vendorForm.taxId || undefined,
        notes: vendorForm.notes || undefined,
      },
    });
  };

  const openEditDialog = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setVendorForm({
      name: vendor.name,
      email: vendor.email,
      phone: vendor.phone,
      address: vendor.address,
      category: vendor.category,
      paymentTerms: vendor.paymentTerms || "net30",
      taxId: vendor.taxId || "",
      notes: vendor.notes || "",
      bankCountry: "NG",
      bankCode: "",
      bankName: "",
      accountNumber: "",
      accountName: "",
      routingNumber: "",
    });
    setVendorAccountValidation(null);
    setIsEditOpen(true);
  };

  const openDetailDialog = (vendor: Vendor) => {
    setDetailVendor(vendor);
    setIsDetailOpen(true);
  };

  const handlePayVendor = (vendor: Vendor) => {
    toast({
      title: "Payment initiated",
      description: `Payment to ${vendor.name} has been initiated.`
    });
  };

  const getStatusVariant = (status: Vendor["status"]): "success" | "secondary" | "warning" => {
    switch (status) {
      case "active":
        return "success";
      case "inactive":
        return "secondary";
      case "pending":
        return "warning";
      default:
        return "secondary";
    }
  };

  const getCategoryGradient = (category: string) => {
    const gradients: Record<string, string> = {
      "Cloud Services": "from-violet-500 to-violet-600",
      "Software": "from-cyan-500 to-cyan-600",
      "Design Tools": "from-rose-500 to-rose-600",
      "Office Space": "from-amber-500 to-amber-600",
      "Utilities": "from-emerald-500 to-emerald-600",
      "Insurance": "from-violet-500 to-violet-600",
      "Marketing": "from-rose-500 to-rose-600",
      "Other": "from-slate-500 to-slate-600"
    };
    return gradients[category] || "from-slate-500 to-slate-600";
  };

  return (
    <PageWrapper>
      <motion.div variants={fadeUp} initial="initial" animate="animate" className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <PageHeader
            title="Vendor Management"
            subtitle="Manage vendors and track payments"
          />
          <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-vendor" className="bg-violet-600 hover:bg-violet-700 w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                Add Vendor
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-xl">Add New Vendor</DialogTitle>
                <DialogDescription>
                  Enter the vendor details to add them to your list.
                </DialogDescription>
              </DialogHeader>
              <VendorFormFields
                vendorForm={vendorForm}
                setVendorForm={setVendorForm}
                accountValidation={vendorAccountValidation}
                setAccountValidation={setVendorAccountValidation}
                isValidating={isVendorValidating}
                onValidateAccount={validateVendorAccount}
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddOpen(false)} className="border-slate-200 dark:border-slate-700">
                  Cancel
                </Button>
                <Button onClick={handleAddVendor} disabled={isAddingVendor} data-testid="button-save-vendor" className="bg-violet-600 hover:bg-violet-700">
                  {isAddingVendor ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    "Add Vendor"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <motion.div
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
          variants={stagger}
          initial="initial"
          animate="animate"
        >
          <MetricCard
            title="Total Vendors"
            value={totalVendors.toString()}
            icon={Building2}
            color="violet"
          />
          <MetricCard
            title="Active Vendors"
            value={activeVendors.toString()}
            icon={CheckCircle2}
            color="emerald"
          />
          <MetricCard
            title="Pending Payments"
            value={formatCurrency(totalPending)}
            icon={AlertCircle}
            color="amber"
          />
          <MetricCard
            title="Total Paid"
            value={formatCurrency(totalPaidThisMonth)}
            icon={TrendingUp}
            color="cyan"
          />
        </motion.div>

        <GlassCard className="border-slate-200 dark:border-slate-700">
          <Tabs defaultValue="all" className="w-full">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4">
            <TabsList className="bg-slate-100 dark:bg-slate-800">
              <TabsTrigger value="all">All Vendors</TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="inactive">Inactive</TabsTrigger>
            </TabsList>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search vendors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                data-testid="input-search-vendors"
              />
            </div>
          </div>
            <TabsContent value="all" className="p-4">
              {filteredVendors.length === 0 ? (
                <EmptyState
                  icon={Building2}
                  title="No vendors found"
                  subtitle="Add your first vendor to get started"
                />
              ) : (
                <motion.div
                  className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
                  variants={stagger}
                  initial="initial"
                  animate="animate"
                >
                  {filteredVendors.map((vendor, index) => (
                    <VendorCard
                      key={vendor.id}
                      vendor={vendor}
                      index={index}
                      onPay={handlePayVendor}
                      onView={openDetailDialog}
                      onEdit={openEditDialog}
                      getCategoryGradient={getCategoryGradient}
                      getStatusVariant={getStatusVariant}
                      formatCurrency={formatCurrency}
                      hasPayoutDestinations={vendorIdsWithDestinations.has(vendor.id)}
                    />
                  ))}
                </motion.div>
              )}
            </TabsContent>

            <TabsContent value="active" className="p-4">
              {filteredVendors.filter(v => v.status === "active").length === 0 ? (
                <EmptyState
                  icon={CheckCircle2}
                  title="No active vendors"
                  subtitle="All vendors are inactive or pending approval"
                />
              ) : (
                <motion.div
                  className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
                  variants={stagger}
                  initial="initial"
                  animate="animate"
                >
                  {filteredVendors.filter(v => v.status === "active").map((vendor, index) => (
                    <VendorCard
                      key={vendor.id}
                      vendor={vendor}
                      index={index}
                      onPay={handlePayVendor}
                      onView={openDetailDialog}
                      onEdit={openEditDialog}
                      getCategoryGradient={getCategoryGradient}
                      getStatusVariant={getStatusVariant}
                      formatCurrency={formatCurrency}
                      hasPayoutDestinations={vendorIdsWithDestinations.has(vendor.id)}
                    />
                  ))}
                </motion.div>
              )}
            </TabsContent>

            <TabsContent value="inactive" className="p-4">
              {filteredVendors.filter(v => v.status === "inactive").length === 0 ? (
                <EmptyState
                  icon={AlertCircle}
                  title="No inactive vendors"
                  subtitle="All vendors are active or pending approval"
                />
              ) : (
                <motion.div
                  className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
                  variants={stagger}
                  initial="initial"
                  animate="animate"
                >
                  {filteredVendors.filter(v => v.status === "inactive").map((vendor, index) => (
                    <VendorCard
                      key={vendor.id}
                      vendor={vendor}
                      index={index}
                      onPay={handlePayVendor}
                      onView={openDetailDialog}
                      onEdit={openEditDialog}
                      getCategoryGradient={getCategoryGradient}
                      getStatusVariant={getStatusVariant}
                      formatCurrency={formatCurrency}
                      isInactive
                      hasPayoutDestinations={vendorIdsWithDestinations.has(vendor.id)}
                    />
                  ))}
                </motion.div>
              )}
            </TabsContent>
          </Tabs>
        </GlassCard>

        {/* Edit Vendor Dialog */}
        <Dialog open={isEditOpen} onOpenChange={(open) => { setIsEditOpen(open); if (!open) { setEditingVendor(null); resetForm(); } }}>
          <DialogContent className="sm:max-w-[500px] border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl">Edit Vendor</DialogTitle>
              <DialogDescription>
                Update the vendor details below.
              </DialogDescription>
            </DialogHeader>
            <VendorFormFields
              vendorForm={vendorForm}
              setVendorForm={setVendorForm}
              accountValidation={vendorAccountValidation}
              setAccountValidation={setVendorAccountValidation}
              isValidating={isVendorValidating}
              onValidateAccount={validateVendorAccount}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditOpen(false)} className="border-slate-200 dark:border-slate-700">
                Cancel
              </Button>
              <Button onClick={handleEditVendor} disabled={updateVendorMutation.isPending} className="bg-violet-600 hover:bg-violet-700">
                {updateVendorMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Vendor Detail Dialog */}
        {detailVendor && (
          <VendorDetailDialog
            vendor={detailVendor}
            open={isDetailOpen}
            onOpenChange={(open) => { setIsDetailOpen(open); if (!open) setDetailVendor(null); }}
            formatCurrency={formatCurrency}
            getCategoryGradient={getCategoryGradient}
            hasPayoutDestinations={vendorIdsWithDestinations.has(detailVendor.id)}
          />
        )}

      </motion.div>
    </PageWrapper>
  );
}

// ── Shared form fields component ─────────────────────────────

interface VendorFormState {
  name: string;
  email: string;
  phone: string;
  address: string;
  category: string;
  paymentTerms: string;
  taxId: string;
  notes: string;
  bankCountry: string;
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  routingNumber: string;
}

function VendorFormFields({
  vendorForm,
  setVendorForm,
  accountValidation,
  setAccountValidation,
  isValidating,
  onValidateAccount,
}: {
  vendorForm: VendorFormState;
  setVendorForm: React.Dispatch<React.SetStateAction<VendorFormState>>;
  accountValidation: { validated: boolean; name: string } | null;
  setAccountValidation: React.Dispatch<React.SetStateAction<{ validated: boolean; name: string } | null>>;
  isValidating: boolean;
  onValidateAccount: () => void;
}) {
  const isPaystack = (() => {
    const africanCountries = ['NG', 'GH', 'KE', 'ZA', 'EG', 'RW', 'CI'];
    return africanCountries.includes(vendorForm.bankCountry);
  })();

  // Fetch banks for the selected country
  const { data: bankList = [] } = useQuery<{ name: string; code: string }[]>({
    queryKey: ["/api/payment/banks", vendorForm.bankCountry],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/payment/banks/${vendorForm.bankCountry}`);
      return res.json();
    },
  });

  return (
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <Label className="text-slate-700 dark:text-slate-300">Vendor Name</Label>
        <Input placeholder="e.g., Amazon Web Services" data-testid="input-vendor-name" className="border-slate-200 dark:border-slate-700" value={vendorForm.name} onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-slate-700 dark:text-slate-300">Email</Label>
          <Input type="email" placeholder="billing@vendor.com" className="border-slate-200 dark:border-slate-700" value={vendorForm.email} onChange={(e) => setVendorForm({ ...vendorForm, email: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label className="text-slate-700 dark:text-slate-300">Phone</Label>
          <Input type="tel" placeholder="+1 (555) 123-4567" className="border-slate-200 dark:border-slate-700" value={vendorForm.phone} onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })} />
        </div>
      </div>
      <div className="space-y-2">
        <Label className="text-slate-700 dark:text-slate-300">Address</Label>
        <Input placeholder="City, State, Country" className="border-slate-200 dark:border-slate-700" value={vendorForm.address} onChange={(e) => setVendorForm({ ...vendorForm, address: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label className="text-slate-700 dark:text-slate-300">Category</Label>
        <Select value={vendorForm.category} onValueChange={(value) => setVendorForm({ ...vendorForm, category: value })}>
          <SelectTrigger className="border-slate-200 dark:border-slate-700">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Cloud Services">Cloud Services</SelectItem>
            <SelectItem value="Software">Software</SelectItem>
            <SelectItem value="Office Space">Office Space</SelectItem>
            <SelectItem value="Utilities">Utilities</SelectItem>
            <SelectItem value="Insurance">Insurance</SelectItem>
            <SelectItem value="Marketing">Marketing</SelectItem>
            <SelectItem value="Other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label className="text-slate-700 dark:text-slate-300">Payment Terms</Label>
        <Select value={vendorForm.paymentTerms} onValueChange={(value) => setVendorForm({ ...vendorForm, paymentTerms: value })}>
          <SelectTrigger className="border-slate-200 dark:border-slate-700">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="net15">Net 15</SelectItem>
            <SelectItem value="net30">Net 30</SelectItem>
            <SelectItem value="net45">Net 45</SelectItem>
            <SelectItem value="net60">Net 60</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label className="text-slate-700 dark:text-slate-300">Tax ID / EIN</Label>
        <Input
          placeholder="e.g., 12-3456789, VAT123456"
          className="border-slate-200 dark:border-slate-700"
          value={vendorForm.taxId}
          onChange={(e) => setVendorForm({ ...vendorForm, taxId: e.target.value })}
          data-testid="input-vendor-tax-id"
        />
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Tax identification number (EIN, VAT, TIN, etc.)
        </p>
      </div>
      <div className="space-y-2">
        <Label className="text-slate-700 dark:text-slate-300">Internal Notes</Label>
        <Textarea
          placeholder="Add any internal notes about this vendor..."
          className="border-slate-200 dark:border-slate-700 resize-none"
          rows={3}
          value={vendorForm.notes}
          onChange={(e) => setVendorForm({ ...vendorForm, notes: e.target.value })}
          data-testid="input-vendor-notes"
        />
        <p className="text-xs text-slate-500 dark:text-slate-400">
          These notes are only visible to your team.
        </p>
      </div>

      {/* Bank Account Details */}
      <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
        <div className="flex items-center gap-2 mb-3">
          <Landmark className="h-4 w-4 text-slate-500" />
          <h4 className="font-medium text-slate-900 dark:text-white text-sm">Payout Bank Account</h4>
          <span className="text-xs text-slate-400">(optional)</span>
        </div>
        <div className="space-y-3">
          {/* Country / Region */}
          <div className="space-y-1">
            <Label className="text-slate-700 dark:text-slate-300 text-xs">Country / Region</Label>
            <Select
              value={vendorForm.bankCountry}
              onValueChange={(val) => {
                setVendorForm((f) => ({
                  ...f,
                  bankCountry: val,
                  bankCode: "",
                  bankName: "",
                  routingNumber: "",
                  accountNumber: "",
                  accountName: "",
                }));
                setAccountValidation(null);
              }}
            >
              <SelectTrigger className="border-slate-200 dark:border-slate-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {SUPPORTED_COUNTRIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>{c.name} ({c.currency})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Bank selector */}
          <div className="space-y-1">
            <Label className="text-slate-700 dark:text-slate-300 text-xs">Bank</Label>
            <Select
              value={vendorForm.bankCode}
              onValueChange={(val) => {
                const bank = bankList.find((b) => b.code === val);
                if (val === "OTHER") {
                  setVendorForm((f) => ({ ...f, bankCode: val, bankName: "" }));
                } else {
                  setVendorForm((f) => ({ ...f, bankCode: val, bankName: bank?.name || "" }));
                }
                setAccountValidation(null);
              }}
            >
              <SelectTrigger className="border-slate-200 dark:border-slate-700">
                <SelectValue placeholder="Select bank..." />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {bankList.map((bank) => (
                  <SelectItem key={bank.code} value={bank.code}>{bank.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Manual bank name when "Other" */}
          {vendorForm.bankCode === "OTHER" && (
            <div className="space-y-1">
              <Label className="text-slate-700 dark:text-slate-300 text-xs">Bank Name</Label>
              <Input
                value={vendorForm.bankName}
                onChange={(e) => setVendorForm((f) => ({ ...f, bankName: e.target.value }))}
                placeholder="Enter bank name"
                className="border-slate-200 dark:border-slate-700"
              />
            </div>
          )}

          {/* Routing number for Stripe regions */}
          {(() => {
            const format = getBankDetailFormat(vendorForm.bankCountry);
            if (format === "bank_code") return null;
            return (
              <div className="space-y-1">
                <Label className="text-slate-700 dark:text-slate-300 text-xs">{getBankDetailLabel(format)}</Label>
                <Input
                  value={vendorForm.routingNumber}
                  onChange={(e) => setVendorForm((f) => ({ ...f, routingNumber: e.target.value }))}
                  placeholder={`Enter ${getBankDetailLabel(format).toLowerCase()}`}
                  className="border-slate-200 dark:border-slate-700"
                />
              </div>
            );
          })()}

          {/* Account number + verify button */}
          <div className="space-y-1">
            <Label className="text-slate-700 dark:text-slate-300 text-xs">Account Number</Label>
            <div className="flex gap-2">
              <Input
                value={vendorForm.accountNumber}
                onChange={(e) => {
                  setVendorForm((f) => ({ ...f, accountNumber: e.target.value }));
                  setAccountValidation(null);
                }}
                placeholder="0123456789"
                className="border-slate-200 dark:border-slate-700 flex-1"
              />
              {isPaystack && vendorForm.bankCode && vendorForm.bankCode !== "OTHER" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onValidateAccount}
                  disabled={isValidating || !vendorForm.accountNumber || vendorForm.accountNumber.length < 10}
                  className="shrink-0"
                >
                  {isValidating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : accountValidation?.validated ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <ShieldCheck className="h-4 w-4" />
                  )}
                  <span className="ml-1 text-xs">{isValidating ? "Verifying" : accountValidation?.validated ? "Verified" : "Verify"}</span>
                </Button>
              )}
            </div>
          </div>

          {/* Account name */}
          <div className="space-y-1">
            <Label className="text-slate-700 dark:text-slate-300 text-xs">Account Name</Label>
            <Input
              value={vendorForm.accountName}
              onChange={(e) => setVendorForm((f) => ({ ...f, accountName: e.target.value }))}
              placeholder="Account holder name"
              readOnly={isPaystack && accountValidation?.validated}
              className={`border-slate-200 dark:border-slate-700 ${isPaystack && accountValidation?.validated ? "bg-slate-50 dark:bg-slate-800" : ""}`}
            />
            {accountValidation?.validated && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-1">
                <CheckCircle2 className="h-3 w-3" /> Verified: {accountValidation.name}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Vendor Card ──────────────────────────────────────────────

function VendorCard({
  vendor,
  index,
  onPay,
  onView,
  onEdit,
  getCategoryGradient,
  getStatusVariant,
  formatCurrency,
  isInactive = false,
  hasPayoutDestinations,
}: {
  vendor: Vendor;
  index: number;
  onPay: (vendor: Vendor) => void;
  onView: (vendor: Vendor) => void;
  onEdit: (vendor: Vendor) => void;
  getCategoryGradient: (category: string) => string;
  getStatusVariant: (status: Vendor["status"]) => "success" | "secondary" | "warning";
  formatCurrency: (amount: number | string) => string;
  isInactive?: boolean;
  hasPayoutDestinations: boolean;
}) {
  const initials = vendor.name
    .split(" ")
    .map(n => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const paymentStatus = derivePaymentStatus(vendor, hasPayoutDestinations);

  return (
    <motion.div
      variants={fadeUp}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
    >
      <GlassCard
        className={`card-hover border-slate-200 dark:border-slate-700 ${isInactive ? "opacity-60" : ""}`}
        data-testid={`vendor-card-${index}`}
      >
        <div className="p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-14 w-14 border-2 border-slate-200 dark:border-slate-700">
                <AvatarFallback className={`bg-gradient-to-br ${getCategoryGradient(vendor.category)} text-white font-semibold text-sm`}>
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {vendor.name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {vendor.category}
                </p>
              </div>
            </div>
            <div className="ml-2 flex-shrink-0 flex flex-col items-end gap-1">
              <StatusBadge status={vendor.status} variant={getStatusVariant(vendor.status)} className="flex-shrink-0">
                {vendor.status === "active"
                  ? "Active"
                  : vendor.status === "pending"
                    ? "Pending"
                    : "Inactive"}
              </StatusBadge>
              <PaymentStatusBadge status={paymentStatus} />
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 truncate">
              <Mail className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{vendor.email}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 truncate">
              <MapPin className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{vendor.address}</span>
            </div>
            {vendor.taxId && (
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 truncate">
                <FileText className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">Tax ID: {vendor.taxId}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Total Paid
              </p>
              <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm mt-1">
                {formatCurrency(vendor.totalPaid)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Pending
              </p>
              <p
                className={`font-semibold text-sm mt-1 ${
                  parseFloat(String(vendor.pendingPayments)) > 0
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-slate-900 dark:text-slate-100"
                }`}
              >
                {formatCurrency(vendor.pendingPayments)}
              </p>
            </div>
          </div>

          {/* Payment History */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide font-medium">Payment History</p>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400">Last Paid</span>
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {vendor.lastPayment
                  ? new Date(vendor.lastPayment).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                  : "No payments yet"}
              </span>
            </div>
            {vendor.paymentTerms && (
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-slate-600 dark:text-slate-400">Terms</span>
                <span className="font-medium text-slate-900 dark:text-slate-100 capitalize">
                  {vendor.paymentTerms.replace("net", "Net ")}
                </span>
              </div>
            )}
          </div>

          {/* Notes preview */}
          {vendor.notes && (
            <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-1">
                <StickyNote className="h-3.5 w-3.5 text-slate-400" />
                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide font-medium">Notes</p>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                {vendor.notes}
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 border-slate-200 dark:border-slate-700"
              onClick={() => onView(vendor)}
            >
              <Eye className="mr-1.5 h-3.5 w-3.5" />
              View
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 border-slate-200 dark:border-slate-700"
              onClick={() => onEdit(vendor)}
            >
              <Edit2 className="mr-1.5 h-3.5 w-3.5" />
              Edit
            </Button>
          </div>

          {parseFloat(String(vendor.pendingPayments)) > 0 && !isInactive && (
            <Button
              className="w-full bg-violet-600 hover:bg-violet-700 text-white"
              onClick={() => onPay(vendor)}
              data-testid={`button-pay-vendor-${index}`}
            >
              <Send className="mr-2 h-4 w-4" />
              Pay {formatCurrency(vendor.pendingPayments)}
            </Button>
          )}
        </div>
      </GlassCard>
    </motion.div>
  );
}

// ── Vendor Detail Dialog with Payment History ────────────────

function VendorDetailDialog({
  vendor,
  open,
  onOpenChange,
  formatCurrency,
  getCategoryGradient,
  hasPayoutDestinations,
}: {
  vendor: Vendor;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formatCurrency: (amount: number | string) => string;
  getCategoryGradient: (category: string) => string;
  hasPayoutDestinations: boolean;
}) {
  const { toast } = useToast();
  const paymentStatus = derivePaymentStatus(vendor, hasPayoutDestinations);

  // Fetch bank accounts (payout destinations) for this vendor
  const { data: destinations = [], isLoading: destinationsLoading } = useQuery<PayoutDestination[]>({
    queryKey: ["/api/payout-destinations", { vendorId: vendor.id }],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/payout-destinations?vendorId=${vendor.id}`);
      return res.json();
    },
    enabled: open,
  });

  // Fetch available banks for the selected country (unified endpoint: Paystack dynamic + Stripe static)
  const [bankCountry, setBankCountry] = useState("NG");
  const { data: bankList = [] } = useQuery<{ name: string; code: string }[]>({
    queryKey: ["/api/payment/banks", bankCountry],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/payment/banks/${bankCountry}`);
      return res.json();
    },
    enabled: open,
  });

  // Add bank account mutation
  const [showAddBank, setShowAddBank] = useState(false);
  const [bankForm, setBankForm] = useState({
    bankName: "",
    bankCode: "",
    accountNumber: "",
    accountName: vendor.name,
    provider: "paystack",
    currency: "NGN",
    country: "NG",
    routingNumber: "",
  });

  const addBankMutation = useMutation({
    mutationFn: async (data: typeof bankForm) => {
      return apiRequest("POST", "/api/payout-destinations", {
        ...data,
        vendorId: vendor.id,
        type: "bank_account",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payout-destinations"] });
      setShowAddBank(false);
      setBankForm({ bankName: "", bankCode: "", accountNumber: "", accountName: vendor.name, provider: "paystack", currency: "NGN", country: "NG", routingNumber: "" });
      toast({ title: "Bank account added", description: "The account has been verified and saved." });
    },
    onError: (err: any) => {
      toast({ title: "Failed to add bank account", description: err.message || "Verification failed. Check account details.", variant: "destructive" });
    },
  });

  const deleteBankMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/payout-destinations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payout-destinations"] });
      toast({ title: "Bank account removed" });
    },
  });

  // Use shared constants for country → provider/currency/bankListKey lookup
  // No more hardcoded map — getCountryConfig() has everything

  // Fetch payment history (payouts for this vendor)
  const { data: payouts = [], isLoading: payoutsLoading } = useQuery<Payout[]>({
    queryKey: ["/api/payouts", { recipientId: vendor.id }],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/payouts?recipientId=${vendor.id}`);
      return res.json();
    },
    enabled: open,
  });

  const initials = vendor.name
    .split(" ")
    .map(n => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const getPayoutStatusVariant = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20";
      case "pending":
        return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20";
      case "failed":
        return "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20";
      case "processing":
        return "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20";
      default:
        return "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14 border-2 border-slate-200 dark:border-slate-700">
              <AvatarFallback className={`bg-gradient-to-br ${getCategoryGradient(vendor.category)} text-white font-semibold text-sm`}>
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <DialogTitle className="text-xl">{vendor.name}</DialogTitle>
              <DialogDescription className="flex items-center gap-2 mt-1">
                {vendor.category}
                <span className="inline-block mx-1">--</span>
                <PaymentStatusBadge status={paymentStatus} />
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="details" className="w-full mt-4">
          <TabsList className="bg-slate-100 dark:bg-slate-800 w-full">
            <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
            <TabsTrigger value="bank" className="flex-1">Bank Accounts</TabsTrigger>
            <TabsTrigger value="payments" className="flex-1">Payments</TabsTrigger>
          </TabsList>

          {/* Details Tab */}
          <TabsContent value="details" className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Email</p>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{vendor.email || "N/A"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Phone</p>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{vendor.phone || "N/A"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Address</p>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{vendor.address || "N/A"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Payment Terms</p>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100 capitalize">
                  {vendor.paymentTerms ? vendor.paymentTerms.replace("net", "Net ") : "N/A"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Tax ID / EIN</p>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{vendor.taxId || "N/A"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Status</p>
                <StatusBadge status={vendor.status}>
                  {vendor.status === "active" ? "Active" : vendor.status === "pending" ? "Pending" : "Inactive"}
                </StatusBadge>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
              <div className="space-y-1">
                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Total Paid</p>
                <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(vendor.totalPaid)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Pending Payments</p>
                <p className={`text-lg font-semibold ${parseFloat(String(vendor.pendingPayments)) > 0 ? "text-amber-600 dark:text-amber-400" : "text-slate-900 dark:text-slate-100"}`}>
                  {formatCurrency(vendor.pendingPayments)}
                </p>
              </div>
            </div>

            {vendor.notes && (
              <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2 mb-2">
                  <StickyNote className="h-4 w-4 text-slate-400" />
                  <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide font-medium">Internal Notes</p>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap bg-slate-50 dark:bg-slate-900 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                  {vendor.notes}
                </p>
              </div>
            )}
          </TabsContent>

          {/* Bank Accounts Tab */}
          <TabsContent value="bank" className="mt-4 space-y-4">
            {destinationsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                <span className="ml-2 text-sm text-slate-500">Loading bank accounts...</span>
              </div>
            ) : (
              <>
                {destinations.length > 0 && (
                  <div className="space-y-3">
                    {destinations.map((dest) => (
                      <div key={dest.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                            <Landmark className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                {dest.bankName || dest.provider}
                              </p>
                              {dest.isVerified ? (
                                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 gap-1">
                                  <ShieldCheck className="h-3 w-3" /> Verified
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20">
                                  Unverified
                                </Badge>
                              )}
                              {dest.isDefault && (
                                <Badge variant="outline" className="text-[10px] bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20">
                                  Default
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              {dest.accountName} &middot; ****{dest.accountNumber?.slice(-4)} &middot; {dest.currency}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-rose-500"
                          onClick={() => {
                            if (confirm("Remove this bank account?")) {
                              deleteBankMutation.mutate(dest.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {destinations.length === 0 && !showAddBank && (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <CreditCard className="h-10 w-10 text-slate-300 dark:text-slate-600 mb-3" />
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No bank accounts</p>
                    <p className="text-xs text-slate-500 mt-1">Add a bank account to enable instant payouts to this vendor.</p>
                  </div>
                )}

                {!showAddBank ? (
                  <Button variant="outline" className="w-full" onClick={() => setShowAddBank(true)}>
                    <Plus className="h-4 w-4 mr-2" /> Add Bank Account
                  </Button>
                ) : (
                  <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">New Bank Account</p>
                      <Button variant="ghost" size="sm" onClick={() => setShowAddBank(false)}>Cancel</Button>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs">Country / Region</Label>
                        <Select
                          value={bankForm.country}
                          onValueChange={(val) => {
                            const config = getCountryConfig(val);
                            setBankForm((f) => ({
                              ...f,
                              country: val,
                              provider: config?.provider || "stripe",
                              currency: config?.currency || "USD",
                              bankCode: "",
                              bankName: "",
                            }));
                            setBankCountry(val);
                          }}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent className="max-h-60">
                            {SUPPORTED_COUNTRIES.map(c => (
                              <SelectItem key={c.code} value={c.code}>{c.name} ({c.currency})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Bank selector — works for all countries (Paystack dynamic, Stripe static) */}
                      <div>
                        <Label className="text-xs">Bank</Label>
                        <Select
                          value={bankForm.bankCode}
                          onValueChange={(val) => {
                            const bank = bankList.find((b) => b.code === val);
                            if (val === 'OTHER') {
                              setBankForm((f) => ({ ...f, bankCode: val, bankName: "" }));
                            } else {
                              setBankForm((f) => ({ ...f, bankCode: val, bankName: bank?.name || "" }));
                            }
                          }}
                        >
                          <SelectTrigger><SelectValue placeholder="Select bank..." /></SelectTrigger>
                          <SelectContent className="max-h-60">
                            {bankList.map((bank) => (
                              <SelectItem key={bank.code} value={bank.code}>{bank.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Manual bank name input when "Other" is selected */}
                      {bankForm.bankCode === 'OTHER' && (
                        <div>
                          <Label className="text-xs">Bank Name</Label>
                          <Input
                            value={bankForm.bankName}
                            onChange={(e) => setBankForm((f) => ({ ...f, bankName: e.target.value }))}
                            placeholder="Enter bank name"
                          />
                        </div>
                      )}

                      {/* Country-specific routing field */}
                      {(() => {
                        const format = getBankDetailFormat(bankForm.country);
                        if (format === 'bank_code') return null; // Paystack countries use bank code from selector
                        return (
                          <div>
                            <Label className="text-xs">{getBankDetailLabel(format)}</Label>
                            <Input
                              value={bankForm.routingNumber}
                              onChange={(e) => setBankForm((f) => ({ ...f, routingNumber: e.target.value }))}
                              placeholder={`Enter ${getBankDetailLabel(format).toLowerCase()}`}
                            />
                          </div>
                        );
                      })()}

                      <div>
                        <Label className="text-xs">Account Number</Label>
                        <Input
                          value={bankForm.accountNumber}
                          onChange={(e) => setBankForm((f) => ({ ...f, accountNumber: e.target.value }))}
                          placeholder="Enter account number"
                        />
                      </div>

                      <div>
                        <Label className="text-xs">Account Name</Label>
                        <Input
                          value={bankForm.accountName}
                          onChange={(e) => setBankForm((f) => ({ ...f, accountName: e.target.value }))}
                          placeholder="Account holder name"
                        />
                      </div>
                    </div>

                    <Button
                      className="w-full"
                      disabled={addBankMutation.isPending || !bankForm.accountNumber || !bankForm.bankCode}
                      onClick={() => addBankMutation.mutate(bankForm)}
                    >
                      {addBankMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Verifying & Saving...
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="h-4 w-4 mr-2" /> Verify & Save Account
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* Payment History Tab */}
          <TabsContent value="payments" className="mt-4">
            {payoutsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                <span className="ml-2 text-sm text-slate-500">Loading payment history...</span>
              </div>
            ) : payouts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Receipt className="h-10 w-10 text-slate-300 dark:text-slate-600 mb-3" />
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No payment history</p>
                <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                  Payments to this vendor will appear here.
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 dark:bg-slate-900">
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">Date</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">Amount</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">Method</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payouts
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .map((payout) => (
                      <TableRow key={payout.id}>
                        <TableCell className="text-sm text-slate-700 dark:text-slate-300">
                          {new Date(payout.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </TableCell>
                        <TableCell className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {formatCurrency(payout.amount)}
                        </TableCell>
                        <TableCell className="text-sm text-slate-600 dark:text-slate-400 capitalize">
                          {payout.provider || "N/A"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-[11px] font-semibold capitalize ${getPayoutStatusVariant(payout.status)}`}
                          >
                            {payout.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {payouts.length > 0 && (
              <div className="flex items-center justify-between mt-4 px-1">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {payouts.length} payment{payouts.length !== 1 ? "s" : ""} found
                </p>
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Total: {formatCurrency(payouts.reduce((sum, p) => sum + parseFloat(String(p.amount) || "0"), 0))}
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
