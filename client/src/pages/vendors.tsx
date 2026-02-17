import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatCurrencyAmount } from "@/lib/constants";
import { PageWrapper, PageHeader, MetricCard, StatusBadge, EmptyState, GlassCard, fadeUp, stagger } from "@/components/ui-extended";
import {
  Building2,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  DollarSign,
  Mail,
  MapPin,
  Loader2,
  Send,
  TrendingUp
} from "lucide-react";
import type { Vendor, CompanySettings } from "@shared/schema";

export default function VendorsPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [vendorForm, setVendorForm] = useState({ name: "", email: "", phone: "", address: "", category: "", paymentTerms: "net30" });

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

  const createVendorMutation = useMutation({
    mutationFn: async (vendorData: { name: string; email: string; phone: string; address: string; category: string }) => {
      return apiRequest("POST", "/api/vendors", vendorData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
      setIsAddOpen(false);
      setVendorForm({ name: "", email: "", phone: "", address: "", category: "", paymentTerms: "net30" });
      toast({
        title: "Vendor added",
        description: "The vendor has been added successfully."
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add vendor. Please try again.",
        variant: "destructive"
      });
    }
  });

  const totalVendors = vendors.length;
  const activeVendors = vendors.filter(v => v.status === "active").length;
  const totalPending = vendors.reduce((sum, v) => sum + parseFloat(String(v.pendingPayments) || "0"), 0);
  const totalPaidThisMonth = vendors.reduce((sum, v) => sum + parseFloat(String(v.totalPaid) || "0"), 0);

  const filteredVendors = vendors.filter(vendor =>
    vendor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    vendor.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddVendor = () => {
    if (!vendorForm.name || !vendorForm.email) {
      toast({ title: "Name and email are required", variant: "destructive" });
      return;
    }
    createVendorMutation.mutate({
      name: vendorForm.name,
      email: vendorForm.email,
      phone: vendorForm.phone,
      address: vendorForm.address,
      category: vendorForm.category || "Other",
    });
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
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-vendor" className="bg-violet-600 hover:bg-violet-700 w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                Add Vendor
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] border-slate-200 dark:border-slate-700">
              <DialogHeader>
                <DialogTitle className="text-xl">Add New Vendor</DialogTitle>
                <DialogDescription>
                  Enter the vendor details to add them to your list.
                </DialogDescription>
              </DialogHeader>
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
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddOpen(false)} className="border-slate-200 dark:border-slate-700">
                  Cancel
                </Button>
                <Button onClick={handleAddVendor} disabled={createVendorMutation.isPending} data-testid="button-save-vendor" className="bg-violet-600 hover:bg-violet-700">
                  {createVendorMutation.isPending ? (
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

          <Tabs defaultValue="all" className="w-full">
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
                      getCategoryGradient={getCategoryGradient}
                      getStatusVariant={getStatusVariant}
                      formatCurrency={formatCurrency}
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
                      getCategoryGradient={getCategoryGradient}
                      getStatusVariant={getStatusVariant}
                      formatCurrency={formatCurrency}
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
                      getCategoryGradient={getCategoryGradient}
                      getStatusVariant={getStatusVariant}
                      formatCurrency={formatCurrency}
                      isInactive
                    />
                  ))}
                </motion.div>
              )}
            </TabsContent>
          </Tabs>
        </GlassCard>
      </motion.div>
    </PageWrapper>
  );
}

function VendorCard({
  vendor,
  index,
  onPay,
  getCategoryGradient,
  getStatusVariant,
  formatCurrency,
  isInactive = false
}: {
  vendor: Vendor;
  index: number;
  onPay: (vendor: Vendor) => void;
  getCategoryGradient: (category: string) => string;
  getStatusVariant: (status: Vendor["status"]) => "success" | "secondary" | "warning";
  formatCurrency: (amount: number | string) => string;
  isInactive?: boolean;
}) {
  const initials = vendor.name
    .split(" ")
    .map(n => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

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
            <StatusBadge status={vendor.status} variant={getStatusVariant(vendor.status)} className="ml-2 flex-shrink-0">
              {vendor.status === "active"
                ? "Active"
                : vendor.status === "pending"
                  ? "Pending"
                  : "Inactive"}
            </StatusBadge>
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

          {parseFloat(String(vendor.pendingPayments)) > 0 && !isInactive && (
            <Button
              className="w-full mt-4 bg-violet-600 hover:bg-violet-700 text-white"
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
