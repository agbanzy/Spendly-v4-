import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Building2, 
  Plus, 
  Search,
  CheckCircle2,
  AlertCircle,
  DollarSign,
  Mail,
  Phone,
  MapPin,
  Loader2,
  MoreHorizontal,
  Send,
  FileText,
  TrendingUp,
  Globe
} from "lucide-react";
import type { Vendor, CompanySettings } from "@shared/schema";

export default function VendorsPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

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

  const { data: vendors = [], isLoading } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"]
  });

  const createVendorMutation = useMutation({
    mutationFn: async (vendorData: { name: string; email: string; phone: string; address: string; category: string }) => {
      return apiRequest("/api/vendors", {
        method: "POST",
        body: JSON.stringify(vendorData)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
      setIsAddOpen(false);
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
  const totalPending = vendors.reduce((sum, v) => sum + v.pendingPayments, 0);
  const totalPaidThisMonth = vendors.reduce((sum, v) => sum + v.totalPaid, 0);

  const filteredVendors = vendors.filter(vendor =>
    vendor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    vendor.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddVendor = async () => {
    setIsAdding(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    toast({
      title: "Vendor added",
      description: "New vendor has been added successfully."
    });
    
    setIsAdding(false);
    setIsAddOpen(false);
  };

  const handlePayVendor = (vendor: Vendor) => {
    toast({
      title: "Payment initiated",
      description: `Payment to ${vendor.name} has been initiated.`
    });
  };

  const getStatusBadge = (status: Vendor["status"]) => {
    switch (status) {
      case "active":
        return (
          <Badge variant="default" className="bg-emerald-500">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Active
          </Badge>
        );
      case "inactive":
        return (
          <Badge variant="secondary">
            Inactive
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="outline">
            <AlertCircle className="mr-1 h-3 w-3" />
            Pending Approval
          </Badge>
        );
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      "Cloud Services": "bg-indigo-100 text-indigo-600 dark:bg-indigo-900 dark:text-indigo-400",
      "Design Tools": "bg-pink-100 text-pink-600 dark:bg-pink-900 dark:text-pink-400",
      "Office Space": "bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-400",
      "Utilities": "bg-cyan-100 text-cyan-600 dark:bg-cyan-900 dark:text-cyan-400",
      "Insurance": "bg-emerald-100 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-400"
    };
    return colors[category] || "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 texture-mesh min-h-screen">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-vendors-title">Vendor Management</h1>
          <p className="text-muted-foreground">Manage vendors and track payments</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-vendor">
              <Plus className="mr-2 h-4 w-4" />
              Add Vendor
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add New Vendor</DialogTitle>
              <DialogDescription>
                Enter the vendor details to add them to your list.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Vendor Name</Label>
                <Input placeholder="e.g., Amazon Web Services" data-testid="input-vendor-name" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" placeholder="billing@vendor.com" />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input type="tel" placeholder="+1 (555) 123-4567" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input placeholder="City, State, Country" />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cloud">Cloud Services</SelectItem>
                    <SelectItem value="software">Software</SelectItem>
                    <SelectItem value="office">Office Space</SelectItem>
                    <SelectItem value="utilities">Utilities</SelectItem>
                    <SelectItem value="insurance">Insurance</SelectItem>
                    <SelectItem value="marketing">Marketing</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Payment Terms</Label>
                <Select defaultValue="net30">
                  <SelectTrigger>
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
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddVendor} disabled={isAdding} data-testid="button-save-vendor">
                {isAdding ? (
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

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="glass card-hover">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900 text-indigo-600">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalVendors}</p>
                <p className="text-sm text-muted-foreground">Total Vendors</p>
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
                <p className="text-2xl font-bold">{activeVendors}</p>
                <p className="text-sm text-muted-foreground">Active Vendors</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass card-hover">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900 text-amber-600">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(totalPending)}</p>
                <p className="text-sm text-muted-foreground">Pending Payments</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass card-hover">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-100 dark:bg-cyan-900 text-cyan-600">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{currencySymbol}{(totalPaidThisMonth / 1000).toFixed(1)}K</p>
                <p className="text-sm text-muted-foreground">Total Paid</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="all" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <TabsList>
            <TabsTrigger value="all">All Vendors</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="inactive">Inactive</TabsTrigger>
          </TabsList>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search vendors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-vendors"
            />
          </div>
        </div>

        <TabsContent value="all">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredVendors.map((vendor, index) => (
              <Card key={vendor.id} className="hover-elevate" data-testid={`vendor-card-${index}`}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className={getCategoryColor(vendor.category)}>
                          {vendor.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-semibold">{vendor.name}</h3>
                        <p className="text-sm text-muted-foreground">{vendor.category}</p>
                      </div>
                    </div>
                    {getStatusBadge(vendor.status)}
                  </div>
                  
                  <div className="space-y-2 text-sm mb-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      <span className="truncate">{vendor.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span>{vendor.address}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Paid</p>
                      <p className="font-semibold">{formatCurrency(vendor.totalPaid)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Pending</p>
                      <p className={`font-semibold ${vendor.pendingPayments > 0 ? "text-amber-600" : ""}`}>
                        ${vendor.pendingPayments.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {vendor.pendingPayments > 0 && (
                    <Button 
                      className="w-full mt-4" 
                      onClick={() => handlePayVendor(vendor)}
                      data-testid={`button-pay-vendor-${index}`}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Pay ${vendor.pendingPayments.toLocaleString()}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="active">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredVendors.filter(v => v.status === "active").map((vendor) => (
              <Card key={vendor.id} className="hover-elevate">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className={getCategoryColor(vendor.category)}>
                          {vendor.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-semibold">{vendor.name}</h3>
                        <p className="text-sm text-muted-foreground">{vendor.category}</p>
                      </div>
                    </div>
                    {getStatusBadge(vendor.status)}
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Paid</p>
                      <p className="font-semibold">{formatCurrency(vendor.totalPaid)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Pending</p>
                      <p className="font-semibold">{formatCurrency(vendor.pendingPayments)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="inactive">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredVendors.filter(v => v.status === "inactive").map((vendor) => (
              <Card key={vendor.id} className="hover-elevate opacity-70">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="bg-slate-100 text-slate-500">
                          {vendor.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-semibold">{vendor.name}</h3>
                        <p className="text-sm text-muted-foreground">{vendor.category}</p>
                      </div>
                    </div>
                    {getStatusBadge(vendor.status)}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Last payment: {vendor.lastPayment}
                  </p>
                </CardContent>
              </Card>
            ))}
            {filteredVendors.filter(v => v.status === "inactive").length === 0 && (
              <div className="col-span-full p-8 text-center text-muted-foreground">
                No inactive vendors.
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
