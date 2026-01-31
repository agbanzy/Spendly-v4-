import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building,
  Bell,
  Shield,
  CreditCard,
  Globe,
  Palette,
  HelpCircle,
  Save,
  Loader2,
  Landmark,
  Wallet,
  CheckCircle2,
  XCircle,
  Upload,
  FileText,
  Briefcase,
  Users,
  Link,
  Hash,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { isPaystackRegion } from "@/lib/constants";
import { useAuth } from "@/lib/auth";

interface UserSettings {
  emailNotifications: boolean;
  pushNotifications: boolean;
  smsNotifications: boolean;
  expenseAlerts: boolean;
  budgetWarnings: boolean;
  paymentReminders: boolean;
  weeklyDigest: boolean;
  preferredCurrency: string;
  preferredLanguage: string;
  preferredTimezone: string;
  preferredDateFormat: string;
  darkMode: boolean;
  twoFactorEnabled: boolean;
  transactionPinEnabled: boolean;
  sessionTimeout: number;
}

interface CompanySettings {
  companyName: string;
  companyEmail: string;
  companyPhone: string;
  companyAddress: string;
  currency: string;
  timezone: string;
  fiscalYearStart: string;
  dateFormat: string;
  language: string;
  notificationsEnabled: boolean;
  twoFactorEnabled: boolean;
  autoApproveBelow: number;
  requireReceipts: boolean;
  expenseCategories: string[];
  countryCode: string;
  region: string;
  paymentProvider: 'stripe' | 'paystack';
  paystackEnabled: boolean;
  stripeEnabled: boolean;
  companyLogo: string | null;
  companyTagline: string | null;
  primaryColor: string;
  secondaryColor: string;
  industry: string | null;
  companySize: string | null;
  taxId: string | null;
  registrationNumber: string | null;
  website: string | null;
  invoicePrefix: string;
  invoiceFooter: string | null;
  invoiceTerms: string;
  showLogoOnInvoice: boolean;
  showLogoOnReceipts: boolean;
}

interface RegionConfig {
  region: string;
  countries: string[];
  currency: string;
  paymentProvider: 'stripe' | 'paystack';
  currencySymbol: string;
}

const COUNTRY_OPTIONS = [
  { code: 'US', name: 'United States', region: 'North America' },
  { code: 'CA', name: 'Canada', region: 'North America' },
  { code: 'GB', name: 'United Kingdom', region: 'Europe' },
  { code: 'DE', name: 'Germany', region: 'Europe' },
  { code: 'FR', name: 'France', region: 'Europe' },
  { code: 'NG', name: 'Nigeria', region: 'Africa' },
  { code: 'GH', name: 'Ghana', region: 'Africa' },
  { code: 'KE', name: 'Kenya', region: 'Africa' },
  { code: 'ZA', name: 'South Africa', region: 'Africa' },
  { code: 'EG', name: 'Egypt', region: 'Africa' },
  { code: 'RW', name: 'Rwanda', region: 'Africa' },
  { code: 'CI', name: "Côte d'Ivoire", region: 'Africa' },
];

export default function Settings() {
  const { toast } = useToast();
  const { user } = useAuth();
  
  const { data: settings, isLoading } = useQuery<CompanySettings>({
    queryKey: ["/api/settings"],
  });

  const { data: regions } = useQuery<RegionConfig[]>({
    queryKey: ["/api/regions"],
  });

  const { data: paymentKeys } = useQuery<{ stripe: string | null; paystack: string | null }>({
    queryKey: ["/api/payment/keys"],
  });

  // Fetch user-specific settings
  const { data: userSettings } = useQuery<UserSettings>({
    queryKey: ["/api/user-settings", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const res = await fetch(`/api/user-settings/${user.id}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!user?.id,
  });

  const [formData, setFormData] = useState<Partial<CompanySettings>>({});
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [expenseAlerts, setExpenseAlerts] = useState(true);
  const [budgetWarnings, setBudgetWarnings] = useState(true);
  const [transactionPin, setTransactionPin] = useState(false);

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  // Update user settings from fetched data
  useEffect(() => {
    if (userSettings) {
      setEmailNotifications(userSettings.emailNotifications);
      setExpenseAlerts(userSettings.expenseAlerts);
      setBudgetWarnings(userSettings.budgetWarnings);
      setTransactionPin(userSettings.transactionPinEnabled);
    }
  }, [userSettings]);

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: Partial<CompanySettings>) => {
      return apiRequest("PATCH", "/api/settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Settings saved",
        description: "Your changes have been saved successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Mutation for user-specific settings
  const updateUserSettingsMutation = useMutation({
    mutationFn: async (data: Partial<UserSettings>) => {
      if (!user?.id) throw new Error("Not authenticated");
      return apiRequest("PATCH", `/api/user-settings/${user.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-settings", user?.id] });
      toast({
        title: "Preferences saved",
        description: "Your preferences have been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save preferences. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSaveCompany = () => {
    updateSettingsMutation.mutate({
      companyName: formData.companyName,
      companyAddress: formData.companyAddress,
      companyEmail: formData.companyEmail,
      companyPhone: formData.companyPhone,
    });
  };

  const handleCountryChange = (countryCode: string) => {
    const isAfrican = isPaystackRegion(countryCode);
    const country = COUNTRY_OPTIONS.find(c => c.code === countryCode);
    const regionConfig = regions?.find(r => r.countries.includes(countryCode));
    
    const updates: Partial<CompanySettings> = {
      countryCode,
      region: country?.region || 'North America',
      paymentProvider: isAfrican ? 'paystack' : 'stripe',
      currency: regionConfig?.currency || 'USD',
    };
    
    setFormData({ ...formData, ...updates });
    updateSettingsMutation.mutate(updates);
  };

  const handleSaveRegion = () => {
    updateSettingsMutation.mutate({
      countryCode: formData.countryCode,
      region: formData.region,
      paymentProvider: formData.paymentProvider,
      currency: formData.currency,
      timezone: formData.timezone,
    });
  };

  const handleUserSettingChange = (key: keyof UserSettings, value: boolean | string | number) => {
    // Update local state
    if (key === "emailNotifications") setEmailNotifications(value as boolean);
    if (key === "expenseAlerts") setExpenseAlerts(value as boolean);
    if (key === "budgetWarnings") setBudgetWarnings(value as boolean);
    if (key === "transactionPinEnabled") setTransactionPin(value as boolean);
    
    // Save to server
    updateUserSettingsMutation.mutate({ [key]: value });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isPaystack = isPaystackRegion(formData.countryCode || 'US');

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500 texture-mesh min-h-screen">
      <div>
        <h1 className="text-3xl font-black tracking-tight" data-testid="text-settings-title">
          Settings
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage your account, company preferences, and payment settings.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building className="h-5 w-5 text-primary" />
            <CardTitle>Company Information</CardTitle>
          </div>
          <CardDescription>
            Basic information about your company.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                value={formData.companyName || ""}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                data-testid="input-company-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyEmail">Company Email</Label>
              <Input
                id="companyEmail"
                type="email"
                value={formData.companyEmail || ""}
                onChange={(e) => setFormData({ ...formData, companyEmail: e.target.value })}
                data-testid="input-company-email"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="companyPhone">Phone Number</Label>
              <Input
                id="companyPhone"
                value={formData.companyPhone || ""}
                onChange={(e) => setFormData({ ...formData, companyPhone: e.target.value })}
                data-testid="input-company-phone"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Business Address</Label>
              <Input
                id="address"
                value={formData.companyAddress || ""}
                onChange={(e) => setFormData({ ...formData, companyAddress: e.target.value })}
                data-testid="input-address"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button 
              onClick={handleSaveCompany}
              disabled={updateSettingsMutation.isPending}
              data-testid="button-save-company"
            >
              {updateSettingsMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            <CardTitle>Organization Details</CardTitle>
          </div>
          <CardDescription>
            Additional information about your organization for legal and compliance purposes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <Select 
                value={formData.industry || ""} 
                onValueChange={(value) => setFormData({ ...formData, industry: value })}
              >
                <SelectTrigger data-testid="select-industry">
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="technology">Technology</SelectItem>
                  <SelectItem value="finance">Finance & Banking</SelectItem>
                  <SelectItem value="healthcare">Healthcare</SelectItem>
                  <SelectItem value="retail">Retail & E-commerce</SelectItem>
                  <SelectItem value="manufacturing">Manufacturing</SelectItem>
                  <SelectItem value="education">Education</SelectItem>
                  <SelectItem value="consulting">Consulting</SelectItem>
                  <SelectItem value="real_estate">Real Estate</SelectItem>
                  <SelectItem value="logistics">Logistics & Transportation</SelectItem>
                  <SelectItem value="media">Media & Entertainment</SelectItem>
                  <SelectItem value="hospitality">Hospitality</SelectItem>
                  <SelectItem value="agriculture">Agriculture</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="companySize">Company Size</Label>
              <Select 
                value={formData.companySize || ""} 
                onValueChange={(value) => setFormData({ ...formData, companySize: value })}
              >
                <SelectTrigger data-testid="select-company-size">
                  <SelectValue placeholder="Select size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1-10">1-10 employees</SelectItem>
                  <SelectItem value="11-50">11-50 employees</SelectItem>
                  <SelectItem value="51-200">51-200 employees</SelectItem>
                  <SelectItem value="201-500">201-500 employees</SelectItem>
                  <SelectItem value="501-1000">501-1,000 employees</SelectItem>
                  <SelectItem value="1001+">1,000+ employees</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="taxId">Tax ID / VAT Number</Label>
              <Input
                id="taxId"
                placeholder="e.g., 12-3456789"
                value={formData.taxId || ""}
                onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                data-testid="input-tax-id"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="registrationNumber">Registration Number</Label>
              <Input
                id="registrationNumber"
                placeholder="e.g., RC123456"
                value={formData.registrationNumber || ""}
                onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
                data-testid="input-registration-number"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="website">Company Website</Label>
            <Input
              id="website"
              type="url"
              placeholder="https://example.com"
              value={formData.website || ""}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              data-testid="input-website"
            />
          </div>
          <div className="flex justify-end">
            <Button 
              onClick={() => updateSettingsMutation.mutate({
                industry: formData.industry,
                companySize: formData.companySize,
                taxId: formData.taxId,
                registrationNumber: formData.registrationNumber,
                website: formData.website,
              })}
              disabled={updateSettingsMutation.isPending}
              data-testid="button-save-organization"
            >
              {updateSettingsMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Organization Details
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            <CardTitle>Branding</CardTitle>
          </div>
          <CardDescription>
            Customize your company branding for invoices, receipts, and emails.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Company Logo</Label>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center bg-muted/30">
                  {formData.companyLogo ? (
                    <img 
                      src={formData.companyLogo} 
                      alt="Company logo" 
                      className="w-full h-full object-contain rounded-lg"
                    />
                  ) : (
                    <Upload className="h-8 w-8 text-muted-foreground/50" />
                  )}
                </div>
                <div className="space-y-2">
                  <Input
                    type="url"
                    placeholder="Enter logo URL"
                    value={formData.companyLogo || ""}
                    onChange={(e) => setFormData({ ...formData, companyLogo: e.target.value })}
                    className="w-64"
                    data-testid="input-logo-url"
                  />
                  <p className="text-xs text-muted-foreground">
                    Recommended: 200x200 pixels, PNG or SVG format
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="tagline">Company Tagline</Label>
              <Input
                id="tagline"
                placeholder="e.g., Simplifying expense management"
                value={formData.companyTagline || ""}
                onChange={(e) => setFormData({ ...formData, companyTagline: e.target.value })}
                data-testid="input-tagline"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="primaryColor">Primary Brand Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    id="primaryColor"
                    value={formData.primaryColor || "#4f46e5"}
                    onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                    className="w-10 h-10 rounded cursor-pointer border-0"
                    data-testid="input-primary-color"
                  />
                  <Input
                    value={formData.primaryColor || "#4f46e5"}
                    onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                    className="w-28 font-mono text-sm"
                    placeholder="#4f46e5"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="secondaryColor">Secondary Brand Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    id="secondaryColor"
                    value={formData.secondaryColor || "#10b981"}
                    onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                    className="w-10 h-10 rounded cursor-pointer border-0"
                    data-testid="input-secondary-color"
                  />
                  <Input
                    value={formData.secondaryColor || "#10b981"}
                    onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                    className="w-28 font-mono text-sm"
                    placeholder="#10b981"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm font-medium mb-2">Preview</p>
              <div className="flex items-center gap-3">
                <div 
                  className="w-8 h-8 rounded"
                  style={{ backgroundColor: formData.primaryColor || "#4f46e5" }}
                />
                <div 
                  className="w-8 h-8 rounded"
                  style={{ backgroundColor: formData.secondaryColor || "#10b981" }}
                />
                <span className="text-sm text-muted-foreground">Your brand colors</span>
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>App Theme</Label>
                <p className="text-sm text-muted-foreground">
                  Switch between light and dark mode.
                </p>
              </div>
              <ThemeToggle />
            </div>
          </div>

          <div className="flex justify-end">
            <Button 
              onClick={() => updateSettingsMutation.mutate({
                companyLogo: formData.companyLogo,
                companyTagline: formData.companyTagline,
                primaryColor: formData.primaryColor,
                secondaryColor: formData.secondaryColor,
              })}
              disabled={updateSettingsMutation.isPending}
              data-testid="button-save-branding"
            >
              {updateSettingsMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Branding
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <CardTitle>Invoice Settings</CardTitle>
          </div>
          <CardDescription>
            Customize how your invoices and receipts appear to clients.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="invoicePrefix">Invoice Number Prefix</Label>
              <Input
                id="invoicePrefix"
                placeholder="INV"
                value={formData.invoicePrefix || "INV"}
                onChange={(e) => setFormData({ ...formData, invoicePrefix: e.target.value })}
                data-testid="input-invoice-prefix"
              />
              <p className="text-xs text-muted-foreground">
                Example: {formData.invoicePrefix || "INV"}-2024-0001
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fiscalYear">Fiscal Year Start</Label>
              <Select 
                value={formData.fiscalYearStart || "January"} 
                onValueChange={(value) => setFormData({ ...formData, fiscalYearStart: value })}
              >
                <SelectTrigger data-testid="select-fiscal-year">
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="January">January</SelectItem>
                  <SelectItem value="February">February</SelectItem>
                  <SelectItem value="March">March</SelectItem>
                  <SelectItem value="April">April</SelectItem>
                  <SelectItem value="July">July</SelectItem>
                  <SelectItem value="October">October</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="invoiceTerms">Default Payment Terms</Label>
            <Input
              id="invoiceTerms"
              placeholder="Payment due within 30 days"
              value={formData.invoiceTerms || ""}
              onChange={(e) => setFormData({ ...formData, invoiceTerms: e.target.value })}
              data-testid="input-invoice-terms"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="invoiceFooter">Invoice Footer Text</Label>
            <textarea
              id="invoiceFooter"
              className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Thank you for your business! Questions? Contact us at finance@company.com"
              value={formData.invoiceFooter || ""}
              onChange={(e) => setFormData({ ...formData, invoiceFooter: e.target.value })}
              data-testid="input-invoice-footer"
            />
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Show Logo on Invoices</Label>
                <p className="text-sm text-muted-foreground">
                  Display your company logo on generated invoices.
                </p>
              </div>
              <Switch 
                checked={formData.showLogoOnInvoice ?? true}
                onCheckedChange={(checked) => {
                  setFormData({ ...formData, showLogoOnInvoice: checked });
                  updateSettingsMutation.mutate({ showLogoOnInvoice: checked });
                }}
                data-testid="switch-logo-invoice" 
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Show Logo on Receipts</Label>
                <p className="text-sm text-muted-foreground">
                  Display your company logo on expense receipts.
                </p>
              </div>
              <Switch 
                checked={formData.showLogoOnReceipts ?? true}
                onCheckedChange={(checked) => {
                  setFormData({ ...formData, showLogoOnReceipts: checked });
                  updateSettingsMutation.mutate({ showLogoOnReceipts: checked });
                }}
                data-testid="switch-logo-receipts" 
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button 
              onClick={() => updateSettingsMutation.mutate({
                invoicePrefix: formData.invoicePrefix,
                fiscalYearStart: formData.fiscalYearStart,
                invoiceTerms: formData.invoiceTerms,
                invoiceFooter: formData.invoiceFooter,
              })}
              disabled={updateSettingsMutation.isPending}
              data-testid="button-save-invoice"
            >
              {updateSettingsMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Invoice Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-2 border-primary/20">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            <CardTitle>Region & Payment Settings</CardTitle>
            <Badge variant="outline" className="ml-auto">Important</Badge>
          </div>
          <CardDescription>
            Your country determines your payment provider. African countries use Paystack, others use Stripe.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="country">Country / Region</Label>
              <Select 
                value={formData.countryCode || "US"} 
                onValueChange={handleCountryChange}
              >
                <SelectTrigger data-testid="select-country">
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="US">🇺🇸 United States</SelectItem>
                  <SelectItem value="CA">🇨🇦 Canada</SelectItem>
                  <SelectItem value="GB">🇬🇧 United Kingdom</SelectItem>
                  <SelectItem value="DE">🇩🇪 Germany</SelectItem>
                  <SelectItem value="FR">🇫🇷 France</SelectItem>
                  <SelectItem value="NG">🇳🇬 Nigeria</SelectItem>
                  <SelectItem value="GH">🇬🇭 Ghana</SelectItem>
                  <SelectItem value="KE">🇰🇪 Kenya</SelectItem>
                  <SelectItem value="ZA">🇿🇦 South Africa</SelectItem>
                  <SelectItem value="EG">🇪🇬 Egypt</SelectItem>
                  <SelectItem value="RW">🇷🇼 Rwanda</SelectItem>
                  <SelectItem value="CI">🇨🇮 Côte d'Ivoire</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Default Currency</Label>
              <Select 
                value={formData.currency || "USD"} 
                onValueChange={(value) => setFormData({ ...formData, currency: value })}
              >
                <SelectTrigger data-testid="select-currency">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">$ USD - US Dollar</SelectItem>
                  <SelectItem value="EUR">€ EUR - Euro</SelectItem>
                  <SelectItem value="GBP">£ GBP - British Pound</SelectItem>
                  <SelectItem value="NGN">₦ NGN - Nigerian Naira</SelectItem>
                  <SelectItem value="KES">KSh KES - Kenyan Shilling</SelectItem>
                  <SelectItem value="GHS">GH₵ GHS - Ghanaian Cedi</SelectItem>
                  <SelectItem value="ZAR">R ZAR - South African Rand</SelectItem>
                  <SelectItem value="EGP">E£ EGP - Egyptian Pound</SelectItem>
                  <SelectItem value="RWF">RF RWF - Rwandan Franc</SelectItem>
                  <SelectItem value="XOF">CFA XOF - West African CFA</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-muted/50 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isPaystack ? 'bg-teal-100 dark:bg-teal-900/30' : 'bg-indigo-100 dark:bg-indigo-900/30'}`}>
                  <Landmark className={`h-6 w-6 ${isPaystack ? 'text-teal-600' : 'text-indigo-600'}`} />
                </div>
                <div>
                  <p className="font-semibold">
                    Payment Provider: {isPaystack ? 'Paystack' : 'Stripe'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {isPaystack 
                      ? 'Optimized for African payments with local bank support'
                      : 'Global payment processing with card and bank support'
                    }
                  </p>
                </div>
              </div>
              <Badge className={isPaystack ? 'bg-teal-600' : 'bg-indigo-600'}>
                {isPaystack ? 'Paystack' : 'Stripe'}
              </Badge>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                {paymentKeys?.stripe ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-sm">Stripe {paymentKeys?.stripe ? 'Connected' : 'Not configured'}</span>
              </div>
              <div className="flex items-center gap-2">
                {paymentKeys?.paystack ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-sm">Paystack {paymentKeys?.paystack ? 'Connected' : 'Not configured'}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Select 
                value={formData.timezone || "America/Los_Angeles"}
                onValueChange={(value) => setFormData({ ...formData, timezone: value })}
              >
                <SelectTrigger data-testid="select-timezone">
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                  <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                  <SelectItem value="UTC">UTC</SelectItem>
                  <SelectItem value="Europe/London">GMT (London)</SelectItem>
                  <SelectItem value="Africa/Lagos">West Africa Time</SelectItem>
                  <SelectItem value="Africa/Nairobi">East Africa Time</SelectItem>
                  <SelectItem value="Africa/Cairo">Egypt Time</SelectItem>
                  <SelectItem value="Africa/Johannesburg">South Africa Time</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateFormat">Date Format</Label>
              <Select 
                value={formData.dateFormat || "MM/DD/YYYY"}
                onValueChange={(value) => setFormData({ ...formData, dateFormat: value })}
              >
                <SelectTrigger data-testid="select-date-format">
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                  <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                  <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end">
            <Button 
              onClick={handleSaveRegion}
              disabled={updateSettingsMutation.isPending}
              data-testid="button-save-region"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Region Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            <CardTitle>Virtual Accounts</CardTitle>
          </div>
          <CardDescription>
            Create virtual bank accounts for receiving payments.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 border rounded-lg bg-muted/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Virtual Account</p>
                <p className="text-sm text-muted-foreground">
                  {isPaystack 
                    ? 'Create a dedicated bank account number for your company'
                    : 'Connect your bank for direct deposits via Stripe Treasury'
                  }
                </p>
              </div>
              <Button variant="outline" data-testid="button-create-virtual-account">
                {isPaystack ? 'Create Account' : 'Connect Bank'}
              </Button>
            </div>
          </div>
          
          {isPaystack && (
            <div className="text-sm text-muted-foreground">
              <p>Supported banks: Wema Bank, Access Bank, Providus Bank</p>
              <p>Receive instant notifications for deposits</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <CardTitle>Notifications</CardTitle>
          </div>
          <CardDescription>
            Manage your notification preferences.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Email Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive email updates about transactions.
              </p>
            </div>
            <Switch 
              checked={emailNotifications}
              onCheckedChange={(checked) => handleUserSettingChange("emailNotifications", checked)}
              data-testid="switch-email-notifications" 
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Expense Alerts</Label>
              <p className="text-sm text-muted-foreground">
                Get notified when expenses need approval.
              </p>
            </div>
            <Switch 
              checked={expenseAlerts}
              onCheckedChange={(checked) => handleUserSettingChange("expenseAlerts", checked)}
              data-testid="switch-expense-alerts" 
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Budget Warnings</Label>
              <p className="text-sm text-muted-foreground">
                Alerts when budgets are near their limits.
              </p>
            </div>
            <Switch 
              checked={budgetWarnings}
              onCheckedChange={(checked) => handleUserSettingChange("budgetWarnings", checked)}
              data-testid="switch-budget-warnings" 
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle>Security</CardTitle>
          </div>
          <CardDescription>
            Secure your account with additional protections.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Label>Two-Factor Authentication</Label>
                <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800">
                  Recommended
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Add an extra layer of security to your account.
              </p>
            </div>
            <Button variant="outline" data-testid="button-enable-2fa">
              Enable
            </Button>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Transaction PIN</Label>
              <p className="text-sm text-muted-foreground">
                Require PIN for sensitive transactions.
              </p>
            </div>
            <Switch 
              checked={transactionPin}
              onCheckedChange={(checked) => handleUserSettingChange("transactionPinEnabled", checked)}
              data-testid="switch-transaction-pin" 
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Require Receipts</Label>
              <p className="text-sm text-muted-foreground">
                Require receipt uploads for all expenses.
              </p>
            </div>
            <Switch 
              checked={formData.requireReceipts ?? true}
              onCheckedChange={(checked) => {
                setFormData({ ...formData, requireReceipts: checked });
                updateSettingsMutation.mutate({ requireReceipts: checked });
              }}
              data-testid="switch-require-receipts" 
            />
          </div>
          <Separator />
          <div className="space-y-2">
            <Label>Auto-Approve Threshold</Label>
            <p className="text-sm text-muted-foreground mb-2">
              Automatically approve expenses below this amount ({formData.currency || 'USD'}).
            </p>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground font-medium">
                {formData.currency === 'NGN' ? '₦' : 
                 formData.currency === 'EUR' ? '€' : 
                 formData.currency === 'GBP' ? '£' : 
                 formData.currency === 'KES' ? 'KSh' : 
                 formData.currency === 'GHS' ? '₵' : 
                 formData.currency === 'ZAR' ? 'R' : '$'}
              </span>
              <Input 
                type="number"
                className="w-32"
                value={formData.autoApproveBelow || 100}
                onChange={(e) => setFormData({ ...formData, autoApproveBelow: parseInt(e.target.value) })}
                data-testid="input-auto-approve"
              />
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => updateSettingsMutation.mutate({ autoApproveBelow: formData.autoApproveBelow })}
                disabled={updateSettingsMutation.isPending}
              >
                {updateSettingsMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Update'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            <CardTitle>Help & Support</CardTitle>
          </div>
          <CardDescription>
            Get help with Spendly.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" className="w-full justify-start" data-testid="button-docs">
            View Documentation
          </Button>
          <Button variant="outline" className="w-full justify-start" data-testid="button-support">
            Contact Support
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
