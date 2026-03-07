import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  Download,
  Database,
  Webhook,
  Key,
  Copy,
  Eye,
  EyeOff,
  RefreshCw,
  Trash2,
  Plus,
  Send,
  Clock,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  PageWrapper,
  PageHeader,
  GlassCard,
  SectionLabel,
  SuccessFeedback,
  WarningFeedback,
  fadeUp,
  stagger,
} from "@/components/ui-extended";
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

interface ApiKeyEntry {
  id: string;
  name: string;
  keyPreview: string;
  fullKey?: string;
  createdAt: string;
  lastUsedAt: string | null;
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

  // Fetch user-specific settings (uses default queryFn with auth headers)
  const { data: userSettings } = useQuery<UserSettings>({
    queryKey: [`/api/user-settings/${user?.id}`],
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

  // --- Data Export state ---
  const [exportLoading, setExportLoading] = useState<string | null>(null);

  const handleExport = async (endpoint: string, filename: string) => {
    setExportLoading(endpoint);
    try {
      const res = await apiRequest("GET", endpoint);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({
        title: "Export complete",
        description: `${filename} has been downloaded.`,
      });
    } catch {
      toast({
        title: "Export failed",
        description: "Could not export data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setExportLoading(null);
    }
  };

  // --- Webhook state ---
  const [webhookEvents, setWebhookEvents] = useState<Record<string, boolean>>({
    "payment.completed": true,
    "payment.failed": false,
    "card.created": true,
    "card.frozen": false,
    "expense.submitted": true,
    "expense.approved": true,
    "invoice.paid": false,
    "transfer.completed": false,
    "budget.exceeded": false,
    "team.member_added": false,
  });
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);

  const { data: webhookConfig } = useQuery<{
    webhookUrl: string;
    webhookSecret: string;
    events: Record<string, boolean>;
  }>({
    queryKey: ["/api/webhooks/config"],
  });

  useEffect(() => {
    if (webhookConfig?.events) {
      setWebhookEvents(webhookConfig.events);
    }
  }, [webhookConfig]);

  const updateWebhookMutation = useMutation({
    mutationFn: async (data: { events: Record<string, boolean> }) => {
      return apiRequest("PATCH", "/api/webhooks/config", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/webhooks/config"] });
      toast({
        title: "Webhooks updated",
        description: "Your webhook configuration has been saved.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update webhook settings.",
        variant: "destructive",
      });
    },
  });

  const handleWebhookToggle = (event: string, enabled: boolean) => {
    const updated = { ...webhookEvents, [event]: enabled };
    setWebhookEvents(updated);
    updateWebhookMutation.mutate({ events: updated });
  };

  const handleTestWebhook = async () => {
    setTestingWebhook(true);
    try {
      await apiRequest("POST", "/api/webhooks/test");
      toast({
        title: "Test webhook sent",
        description: "A test event has been dispatched to your webhook URL.",
      });
    } catch {
      toast({
        title: "Test failed",
        description: "Could not send test webhook. Please check your URL.",
        variant: "destructive",
      });
    } finally {
      setTestingWebhook(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: `${label} copied to clipboard.`,
    });
  };

  // --- API Keys state ---
  const [generatingKey, setGeneratingKey] = useState(false);
  const [revokingKeyId, setRevokingKeyId] = useState<string | null>(null);
  const [newlyGeneratedKey, setNewlyGeneratedKey] = useState<string | null>(null);

  const { data: apiKeys, refetch: refetchApiKeys } = useQuery<ApiKeyEntry[]>({
    queryKey: ["/api/api-keys"],
  });

  const handleGenerateApiKey = async () => {
    setGeneratingKey(true);
    try {
      const res = await apiRequest("POST", "/api/api-keys");
      const data = await res.json();
      setNewlyGeneratedKey(data.key);
      refetchApiKeys();
      toast({
        title: "API key generated",
        description: "Copy your new key now. It won't be shown again.",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to generate API key.",
        variant: "destructive",
      });
    } finally {
      setGeneratingKey(false);
    }
  };

  const handleRevokeApiKey = async (keyId: string) => {
    setRevokingKeyId(keyId);
    try {
      await apiRequest("DELETE", `/api/api-keys/${keyId}`);
      refetchApiKeys();
      toast({
        title: "API key revoked",
        description: "The API key has been permanently revoked.",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to revoke API key.",
        variant: "destructive",
      });
    } finally {
      setRevokingKeyId(null);
    }
  };

  const handleSaveCompany = () => {
    if (formData.companyEmail && !formData.companyEmail.includes("@")) {
      toast({
        title: "Invalid email format",
        description: "Company email must contain @.",
        variant: "destructive",
      });
      return;
    }
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
      <PageWrapper>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
        </div>
      </PageWrapper>
    );
  }

  const isPaystack = isPaystackRegion(formData.countryCode || 'US');

  return (
    <PageWrapper>
      <motion.div initial="hidden" animate="visible" variants={stagger}>
        <PageHeader
          title="Settings"
          subtitle="Manage your account, company preferences, and payment settings."
        />
      </motion.div>

      {/* Company Information */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible">
        <GlassCard>
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500/20 to-sky-500/10 flex items-center justify-center">
                <Building className="h-5 w-5 text-sky-600 dark:text-sky-400" />
              </div>
              <div>
                <SectionLabel>Company Information</SectionLabel>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Basic information about your company.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="companyName" className="text-sm font-medium">
                  Company Name
                </Label>
                <Input
                  id="companyName"
                  value={formData.companyName || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, companyName: e.target.value })
                  }
                  className="bg-slate-500/30 border-slate-500/50 rounded-xl h-11"
                  data-testid="input-company-name"
                  placeholder="Enter your company name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyEmail" className="text-sm font-medium">
                  Company Email
                </Label>
                <Input
                  id="companyEmail"
                  type="email"
                  value={formData.companyEmail || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, companyEmail: e.target.value })
                  }
                  className="bg-slate-500/30 border-slate-500/50 rounded-xl h-11"
                  data-testid="input-company-email"
                  placeholder="company@example.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="companyPhone" className="text-sm font-medium">
                  Phone Number
                </Label>
                <Input
                  id="companyPhone"
                  value={formData.companyPhone || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, companyPhone: e.target.value })
                  }
                  className="bg-slate-500/30 border-slate-500/50 rounded-xl h-11"
                  data-testid="input-company-phone"
                  placeholder="+1 (555) 000-0000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address" className="text-sm font-medium">
                  Business Address
                </Label>
                <Input
                  id="address"
                  value={formData.companyAddress || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      companyAddress: e.target.value,
                    })
                  }
                  className="bg-slate-500/30 border-slate-500/50 rounded-xl h-11"
                  data-testid="input-address"
                  placeholder="123 Business St, City, Country"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handleSaveCompany}
                disabled={updateSettingsMutation.isPending}
                className="bg-sky-600 hover:bg-sky-700 text-white"
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
          </div>
        </GlassCard>
      </motion.div>

      {/* Organization Details */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible">
        <GlassCard>
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/10 flex items-center justify-center">
                <Briefcase className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <SectionLabel>Organization Details</SectionLabel>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Legal and compliance information.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="industry" className="text-sm font-medium">
                  Industry
                </Label>
                <Select
                  value={formData.industry || ""}
                  onValueChange={(value) =>
                    setFormData({ ...formData, industry: value })
                  }
                >
                  <SelectTrigger
                    className="bg-slate-500/30 border-slate-500/50 rounded-xl h-11"
                    data-testid="select-industry"
                  >
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
                    <SelectItem value="logistics">
                      Logistics & Transportation
                    </SelectItem>
                    <SelectItem value="media">Media & Entertainment</SelectItem>
                    <SelectItem value="hospitality">Hospitality</SelectItem>
                    <SelectItem value="agriculture">Agriculture</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="companySize" className="text-sm font-medium">
                  Company Size
                </Label>
                <Select
                  value={formData.companySize || ""}
                  onValueChange={(value) =>
                    setFormData({ ...formData, companySize: value })
                  }
                >
                  <SelectTrigger
                    className="bg-slate-500/30 border-slate-500/50 rounded-xl h-11"
                    data-testid="select-company-size"
                  >
                    <SelectValue placeholder="Select size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1-10">1-10 employees</SelectItem>
                    <SelectItem value="11-50">11-50 employees</SelectItem>
                    <SelectItem value="51-200">51-200 employees</SelectItem>
                    <SelectItem value="201-500">201-500 employees</SelectItem>
                    <SelectItem value="501-1000">
                      501-1,000 employees
                    </SelectItem>
                    <SelectItem value="1001+">1,000+ employees</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="taxId" className="text-sm font-medium">
                  Tax ID / VAT Number
                </Label>
                <Input
                  id="taxId"
                  placeholder="e.g., 12-3456789"
                  value={formData.taxId || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, taxId: e.target.value })
                  }
                  className="bg-slate-500/30 border-slate-500/50 rounded-xl h-11"
                  data-testid="input-tax-id"
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="registrationNumber"
                  className="text-sm font-medium"
                >
                  Registration Number
                </Label>
                <Input
                  id="registrationNumber"
                  placeholder="e.g., RC123456"
                  value={formData.registrationNumber || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      registrationNumber: e.target.value,
                    })
                  }
                  className="bg-slate-500/30 border-slate-500/50 rounded-xl h-11"
                  data-testid="input-registration-number"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="website" className="text-sm font-medium">
                Company Website
              </Label>
              <Input
                id="website"
                type="url"
                placeholder="https://example.com"
                value={formData.website || ""}
                onChange={(e) =>
                  setFormData({ ...formData, website: e.target.value })
                }
                className="bg-slate-500/30 border-slate-500/50 rounded-xl h-11"
                data-testid="input-website"
              />
            </div>

            <div className="flex justify-end">
              <Button
                onClick={() =>
                  updateSettingsMutation.mutate({
                    industry: formData.industry,
                    companySize: formData.companySize,
                    taxId: formData.taxId,
                    registrationNumber: formData.registrationNumber,
                    website: formData.website,
                  })
                }
                disabled={updateSettingsMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                data-testid="button-save-organization"
              >
                {updateSettingsMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Details
              </Button>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Branding */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible">
        <GlassCard>
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-500/10 flex items-center justify-center">
                <Palette className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <SectionLabel>Branding</SectionLabel>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Customize your company branding.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Company Logo</Label>
                <div className="flex items-center gap-4">
                  <div className="w-24 h-24 rounded-xl border-2 border-dashed border-slate-500/30 flex items-center justify-center bg-slate-500/10">
                    {formData.companyLogo ? (
                      <img
                        src={formData.companyLogo}
                        alt="Company logo"
                        className="w-full h-full object-contain rounded-xl"
                      />
                    ) : (
                      <Upload className="h-8 w-8 text-slate-500/50" />
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <Input
                      type="url"
                      placeholder="Enter logo URL"
                      value={formData.companyLogo || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          companyLogo: e.target.value,
                        })
                      }
                      className="bg-slate-500/30 border-slate-500/50 rounded-xl h-11"
                      data-testid="input-logo-url"
                    />
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Recommended: 200x200 px, PNG or SVG
                    </p>
                  </div>
                </div>
              </div>

              <div className="h-px bg-slate-500/20" />

              <div className="space-y-2">
                <Label htmlFor="tagline" className="text-sm font-medium">
                  Company Tagline
                </Label>
                <Input
                  id="tagline"
                  placeholder="e.g., Simplifying expense management"
                  value={formData.companyTagline || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      companyTagline: e.target.value,
                    })
                  }
                  className="bg-slate-500/30 border-slate-500/50 rounded-xl h-11"
                  data-testid="input-tagline"
                />
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium">Brand Colors</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="primaryColor" className="text-xs text-slate-600 dark:text-slate-400">
                      Primary
                    </Label>
                    <div className="flex items-center gap-2">
                      <div className="relative h-11 w-14 rounded-xl overflow-hidden border-2 border-slate-500/50 bg-slate-500/10">
                        <input
                          type="color"
                          id="primaryColor"
                          value={formData.primaryColor || "#0284c7"}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              primaryColor: e.target.value,
                            })
                          }
                          className="absolute inset-0 w-full h-full cursor-pointer"
                          data-testid="input-primary-color"
                        />
                      </div>
                      <Input
                        value={formData.primaryColor || "#0284c7"}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            primaryColor: e.target.value,
                          })
                        }
                        className="bg-slate-500/30 border-slate-500/50 rounded-xl h-11 font-mono text-xs flex-1"
                        placeholder="#0284c7"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="secondaryColor" className="text-xs text-slate-600 dark:text-slate-400">
                      Secondary
                    </Label>
                    <div className="flex items-center gap-2">
                      <div className="relative h-11 w-14 rounded-xl overflow-hidden border-2 border-slate-500/50 bg-slate-500/10">
                        <input
                          type="color"
                          id="secondaryColor"
                          value={formData.secondaryColor || "#10b981"}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              secondaryColor: e.target.value,
                            })
                          }
                          className="absolute inset-0 w-full h-full cursor-pointer"
                          data-testid="input-secondary-color"
                        />
                      </div>
                      <Input
                        value={formData.secondaryColor || "#10b981"}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            secondaryColor: e.target.value,
                          })
                        }
                        className="bg-slate-500/30 border-slate-500/50 rounded-xl h-11 font-mono text-xs flex-1"
                        placeholder="#10b981"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-500/10 border border-slate-500/20 flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg ring-2 ring-slate-500/30"
                    style={{ backgroundColor: formData.primaryColor || "#0284c7" }}
                  />
                  <div
                    className="w-10 h-10 rounded-lg ring-2 ring-slate-500/30"
                    style={{ backgroundColor: formData.secondaryColor || "#10b981" }}
                  />
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    Your brand colors
                  </span>
                </div>
              </div>

              <div className="h-px bg-slate-500/20" />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">App Theme</Label>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Light or dark mode
                  </p>
                </div>
                <ThemeToggle />
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={() =>
                  updateSettingsMutation.mutate({
                    companyLogo: formData.companyLogo,
                    companyTagline: formData.companyTagline,
                    primaryColor: formData.primaryColor,
                    secondaryColor: formData.secondaryColor,
                  })
                }
                disabled={updateSettingsMutation.isPending}
                className="bg-amber-600 hover:bg-amber-700 text-white"
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
          </div>
        </GlassCard>
      </motion.div>

      {/* Invoice Settings */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible">
        <GlassCard>
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500/20 to-rose-500/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <SectionLabel>Invoice Settings</SectionLabel>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Customize your invoices and receipts.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="invoicePrefix" className="text-sm font-medium">
                  Invoice Number Prefix
                </Label>
                <Input
                  id="invoicePrefix"
                  placeholder="INV"
                  value={formData.invoicePrefix || "INV"}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      invoicePrefix: e.target.value,
                    })
                  }
                  className="bg-slate-500/30 border-slate-500/50 rounded-xl h-11"
                  data-testid="input-invoice-prefix"
                />
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Example: {formData.invoicePrefix || "INV"}-2024-0001
                </p>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="fiscalYear"
                  className="text-sm font-medium"
                >
                  Fiscal Year Start
                </Label>
                <Select
                  value={formData.fiscalYearStart || "January"}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      fiscalYearStart: value,
                    })
                  }
                >
                  <SelectTrigger
                    className="bg-slate-500/30 border-slate-500/50 rounded-xl h-11"
                    data-testid="select-fiscal-year"
                  >
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
              <Label htmlFor="invoiceTerms" className="text-sm font-medium">
                Default Payment Terms
              </Label>
              <Input
                id="invoiceTerms"
                placeholder="Payment due within 30 days"
                value={formData.invoiceTerms || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    invoiceTerms: e.target.value,
                  })
                }
                className="bg-slate-500/30 border-slate-500/50 rounded-xl h-11"
                data-testid="input-invoice-terms"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="invoiceFooter" className="text-sm font-medium">
                Invoice Footer Text
              </Label>
              <textarea
                id="invoiceFooter"
                className="w-full min-h-[80px] rounded-xl bg-slate-500/30 border border-slate-500/50 px-3 py-2 text-sm text-foreground placeholder:text-slate-600 dark:placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950"
                placeholder="Thank you for your business!"
                value={formData.invoiceFooter || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    invoiceFooter: e.target.value,
                  })
                }
                data-testid="input-invoice-footer"
              />
            </div>

            <div className="h-px bg-slate-500/20" />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">
                    Show Logo on Invoices
                  </Label>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Display on generated invoices
                  </p>
                </div>
                <Switch
                  checked={formData.showLogoOnInvoice ?? true}
                  onCheckedChange={(checked) => {
                    setFormData({
                      ...formData,
                      showLogoOnInvoice: checked,
                    });
                    updateSettingsMutation.mutate({
                      showLogoOnInvoice: checked,
                    });
                  }}
                  data-testid="switch-logo-invoice"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">
                    Show Logo on Receipts
                  </Label>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Display on expense receipts
                  </p>
                </div>
                <Switch
                  checked={formData.showLogoOnReceipts ?? true}
                  onCheckedChange={(checked) => {
                    setFormData({
                      ...formData,
                      showLogoOnReceipts: checked,
                    });
                    updateSettingsMutation.mutate({
                      showLogoOnReceipts: checked,
                    });
                  }}
                  data-testid="switch-logo-receipts"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={() =>
                  updateSettingsMutation.mutate({
                    invoicePrefix: formData.invoicePrefix,
                    fiscalYearStart: formData.fiscalYearStart,
                    invoiceTerms: formData.invoiceTerms,
                    invoiceFooter: formData.invoiceFooter,
                  })
                }
                disabled={updateSettingsMutation.isPending}
                className="bg-rose-600 hover:bg-rose-700 text-white"
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
          </div>
        </GlassCard>
      </motion.div>

      {/* Region & Payment Settings */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible">
        <GlassCard className="border-2 border-sky-500/30">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-cyan-500/10 flex items-center justify-center">
                <Globe className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div className="flex-1">
                <SectionLabel>Region & Payment</SectionLabel>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Your country determines payment provider.
                </p>
              </div>
              <Badge className="bg-sky-600 text-white">Important</Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="country" className="text-sm font-medium">
                  Country / Region
                </Label>
                <Select
                  value={formData.countryCode || "US"}
                  onValueChange={handleCountryChange}
                >
                  <SelectTrigger
                    className="bg-slate-500/30 border-slate-500/50 rounded-xl h-11"
                    data-testid="select-country"
                  >
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="US">United States</SelectItem>
                    <SelectItem value="CA">Canada</SelectItem>
                    <SelectItem value="GB">United Kingdom</SelectItem>
                    <SelectItem value="DE">Germany</SelectItem>
                    <SelectItem value="FR">France</SelectItem>
                    <SelectItem value="NG">Nigeria</SelectItem>
                    <SelectItem value="GH">Ghana</SelectItem>
                    <SelectItem value="KE">Kenya</SelectItem>
                    <SelectItem value="ZA">South Africa</SelectItem>
                    <SelectItem value="EG">Egypt</SelectItem>
                    <SelectItem value="RW">Rwanda</SelectItem>
                    <SelectItem value="CI">Côte d'Ivoire</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency" className="text-sm font-medium">
                  Default Currency
                </Label>
                <Select
                  value={formData.currency || "USD"}
                  onValueChange={(value) =>
                    setFormData({ ...formData, currency: value })
                  }
                >
                  <SelectTrigger
                    className="bg-slate-500/30 border-slate-500/50 rounded-xl h-11"
                    data-testid="select-currency"
                  >
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD - US Dollar</SelectItem>
                    <SelectItem value="EUR">EUR - Euro</SelectItem>
                    <SelectItem value="GBP">GBP - British Pound</SelectItem>
                    <SelectItem value="NGN">NGN - Nigerian Naira</SelectItem>
                    <SelectItem value="KES">KES - Kenyan Shilling</SelectItem>
                    <SelectItem value="GHS">GHS - Ghanaian Cedi</SelectItem>
                    <SelectItem value="ZAR">ZAR - South African Rand</SelectItem>
                    <SelectItem value="EGP">EGP - Egyptian Pound</SelectItem>
                    <SelectItem value="RWF">RWF - Rwandan Franc</SelectItem>
                    <SelectItem value="XOF">XOF - West African CFA</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-500/10 border border-slate-500/20 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br ${
                      isPaystack
                        ? "from-cyan-500/20 to-cyan-500/10"
                        : "from-sky-500/20 to-sky-500/10"
                    }`}
                  >
                    <Landmark
                      className={`h-6 w-6 ${
                        isPaystack
                          ? "text-cyan-600 dark:text-cyan-400"
                          : "text-sky-600 dark:text-sky-400"
                      }`}
                    />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">
                      {isPaystack ? "Paystack" : "Stripe"}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {isPaystack
                        ? "African payments"
                        : "Global processing"}
                    </p>
                  </div>
                </div>
                <Badge
                  className={`${
                    isPaystack
                      ? "bg-cyan-600"
                      : "bg-sky-600"
                  } text-white`}
                >
                  Active
                </Badge>
              </div>

              <div className="h-px bg-slate-500/20" />

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  {paymentKeys?.stripe ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-slate-500/50" />
                  )}
                  <span>
                    Stripe {paymentKeys?.stripe ? "Connected" : "—"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {paymentKeys?.paystack ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-slate-500/50" />
                  )}
                  <span>
                    Paystack {paymentKeys?.paystack ? "Connected" : "—"}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="timezone" className="text-sm font-medium">
                  Timezone
                </Label>
                <Select
                  value={formData.timezone || "America/Los_Angeles"}
                  onValueChange={(value) =>
                    setFormData({ ...formData, timezone: value })
                  }
                >
                  <SelectTrigger
                    className="bg-slate-500/30 border-slate-500/50 rounded-xl h-11"
                    data-testid="select-timezone"
                  >
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="America/Los_Angeles">
                      PT - Pacific
                    </SelectItem>
                    <SelectItem value="America/New_York">ET - Eastern</SelectItem>
                    <SelectItem value="UTC">UTC</SelectItem>
                    <SelectItem value="Europe/London">GMT - London</SelectItem>
                    <SelectItem value="Africa/Lagos">WAT - West Africa</SelectItem>
                    <SelectItem value="Africa/Nairobi">EAT - East Africa</SelectItem>
                    <SelectItem value="Africa/Cairo">Egypt Time</SelectItem>
                    <SelectItem value="Africa/Johannesburg">
                      SAST - South Africa
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dateFormat" className="text-sm font-medium">
                  Date Format
                </Label>
                <Select
                  value={formData.dateFormat || "MM/DD/YYYY"}
                  onValueChange={(value) =>
                    setFormData({ ...formData, dateFormat: value })
                  }
                >
                  <SelectTrigger
                    className="bg-slate-500/30 border-slate-500/50 rounded-xl h-11"
                    data-testid="select-date-format"
                  >
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
                className="bg-cyan-600 hover:bg-cyan-700 text-white"
                data-testid="button-save-region"
              >
                {updateSettingsMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Region Settings
              </Button>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Virtual Accounts */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible">
        <GlassCard>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/10 flex items-center justify-center">
                <Wallet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <SectionLabel>Virtual Accounts</SectionLabel>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Receive payments directly
                </p>
              </div>
            </div>

            <div className="p-4 border border-slate-500/20 rounded-xl bg-slate-500/10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Virtual Account Setup</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    {isPaystack
                      ? "Create a dedicated bank account for instant deposits"
                      : "Connect your bank via Stripe Treasury"}
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="border-slate-500/50 hover:bg-slate-500/10"
                  data-testid="button-create-virtual-account"
                >
                  {isPaystack ? "Create Account" : "Connect Bank"}
                </Button>
              </div>
            </div>

            {isPaystack && (
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Supported: Wema, Access, Providus • Instant notifications
              </p>
            )}
          </div>
        </GlassCard>
      </motion.div>

      {/* Notifications */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible">
        <GlassCard>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-500/10 flex items-center justify-center">
                <Bell className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <SectionLabel>Notifications</SectionLabel>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Manage your preferences
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-500/10">
                <div>
                  <p className="text-sm font-medium">Email Notifications</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Transaction updates
                  </p>
                </div>
                <Switch
                  checked={emailNotifications}
                  onCheckedChange={(checked) =>
                    handleUserSettingChange("emailNotifications", checked)
                  }
                  data-testid="switch-email-notifications"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-500/10">
                <div>
                  <p className="text-sm font-medium">Expense Alerts</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    When approval needed
                  </p>
                </div>
                <Switch
                  checked={expenseAlerts}
                  onCheckedChange={(checked) =>
                    handleUserSettingChange("expenseAlerts", checked)
                  }
                  data-testid="switch-expense-alerts"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-500/10">
                <div>
                  <p className="text-sm font-medium">Budget Warnings</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Near limit alerts
                  </p>
                </div>
                <Switch
                  checked={budgetWarnings}
                  onCheckedChange={(checked) =>
                    handleUserSettingChange("budgetWarnings", checked)
                  }
                  data-testid="switch-budget-warnings"
                />
              </div>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Security */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible">
        <GlassCard>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500/20 to-rose-500/10 flex items-center justify-center">
                <Shield className="h-5 w-5 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <SectionLabel>Security</SectionLabel>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Protect your account
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-500/10">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">Two-Factor Auth</p>
                    <Badge className="bg-emerald-600/20 text-emerald-700 dark:text-emerald-400 text-xs border-0">
                      Recommended
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Extra security layer
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-slate-500/50"
                  data-testid="button-enable-2fa"
                >
                  Enable
                </Button>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-500/10">
                <div>
                  <p className="text-sm font-medium">Transaction PIN</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    For sensitive actions
                  </p>
                </div>
                <Switch
                  checked={transactionPin}
                  onCheckedChange={(checked) =>
                    handleUserSettingChange(
                      "transactionPinEnabled",
                      checked
                    )
                  }
                  data-testid="switch-transaction-pin"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-500/10">
                <div>
                  <p className="text-sm font-medium">Require Receipts</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Upload for expenses
                  </p>
                </div>
                <Switch
                  checked={formData.requireReceipts ?? true}
                  onCheckedChange={(checked) => {
                    setFormData({
                      ...formData,
                      requireReceipts: checked,
                    });
                    updateSettingsMutation.mutate({
                      requireReceipts: checked,
                    });
                  }}
                  data-testid="switch-require-receipts"
                />
              </div>

              <div className="p-3 rounded-lg bg-slate-500/10 space-y-2">
                <Label className="text-sm font-medium block">
                  Auto-Approve Threshold
                </Label>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Below this amount in {formData.currency || "USD"}
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground font-medium text-sm">
                    {formData.currency === "NGN"
                      ? "₦"
                      : formData.currency === "EUR"
                        ? "€"
                        : formData.currency === "GBP"
                          ? "£"
                          : formData.currency === "KES"
                            ? "KSh"
                            : formData.currency === "GHS"
                              ? "₵"
                              : formData.currency === "ZAR"
                                ? "R"
                                : "$"}
                  </span>
                  <Input
                    type="number"
                    value={formData.autoApproveBelow || 100}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        autoApproveBelow: parseInt(e.target.value),
                      })
                    }
                    className="bg-slate-500/30 border-slate-500/50 rounded-xl h-10 text-sm flex-1"
                    data-testid="input-auto-approve"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-slate-500/50"
                    onClick={() =>
                      updateSettingsMutation.mutate({
                        autoApproveBelow: formData.autoApproveBelow,
                      })
                    }
                    disabled={updateSettingsMutation.isPending}
                  >
                    {updateSettingsMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      "Save"
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Data & Export */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible">
        <GlassCard>
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-indigo-500/10 flex items-center justify-center">
                <Database className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <SectionLabel>Data & Export</SectionLabel>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Download your data in CSV or JSON format.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="border-slate-500/50 hover:bg-slate-500/10 justify-start h-auto py-3"
                disabled={exportLoading === "/api/export/transactions?format=csv"}
                onClick={() =>
                  handleExport(
                    "/api/export/transactions?format=csv",
                    `transactions-${new Date().toISOString().slice(0, 10)}.csv`
                  )
                }
                data-testid="button-export-transactions"
              >
                {exportLoading === "/api/export/transactions?format=csv" ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2 shrink-0" />
                ) : (
                  <Download className="h-4 w-4 mr-2 shrink-0" />
                )}
                <div className="text-left">
                  <p className="text-sm font-medium">Export Transactions (CSV)</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    All transaction records
                  </p>
                </div>
              </Button>

              <Button
                variant="outline"
                className="border-slate-500/50 hover:bg-slate-500/10 justify-start h-auto py-3"
                disabled={exportLoading === "/api/export/expenses?format=csv"}
                onClick={() =>
                  handleExport(
                    "/api/export/expenses?format=csv",
                    `expenses-${new Date().toISOString().slice(0, 10)}.csv`
                  )
                }
                data-testid="button-export-expenses"
              >
                {exportLoading === "/api/export/expenses?format=csv" ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2 shrink-0" />
                ) : (
                  <Download className="h-4 w-4 mr-2 shrink-0" />
                )}
                <div className="text-left">
                  <p className="text-sm font-medium">Export Expenses (CSV)</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    All expense submissions
                  </p>
                </div>
              </Button>

              <Button
                variant="outline"
                className="border-slate-500/50 hover:bg-slate-500/10 justify-start h-auto py-3"
                disabled={exportLoading === "/api/export/team?format=csv"}
                onClick={() =>
                  handleExport(
                    "/api/export/team?format=csv",
                    `team-members-${new Date().toISOString().slice(0, 10)}.csv`
                  )
                }
                data-testid="button-export-team"
              >
                {exportLoading === "/api/export/team?format=csv" ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2 shrink-0" />
                ) : (
                  <Download className="h-4 w-4 mr-2 shrink-0" />
                )}
                <div className="text-left">
                  <p className="text-sm font-medium">Export Team Members (CSV)</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    All team member records
                  </p>
                </div>
              </Button>

              <Button
                variant="outline"
                className="border-slate-500/50 hover:bg-slate-500/10 justify-start h-auto py-3"
                disabled={exportLoading === "/api/export/all?format=json"}
                onClick={() =>
                  handleExport(
                    "/api/export/all?format=json",
                    `spendly-export-${new Date().toISOString().slice(0, 10)}.json`
                  )
                }
                data-testid="button-export-all"
              >
                {exportLoading === "/api/export/all?format=json" ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2 shrink-0" />
                ) : (
                  <Download className="h-4 w-4 mr-2 shrink-0" />
                )}
                <div className="text-left">
                  <p className="text-sm font-medium">Export All Data (JSON)</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Complete data backup
                  </p>
                </div>
              </Button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400">
              Exports include data from your current company workspace only.
            </p>
          </div>
        </GlassCard>
      </motion.div>

      {/* Webhooks & Integrations */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible">
        <GlassCard>
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-500/10 flex items-center justify-center">
                <Webhook className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <SectionLabel>Webhooks & Integrations</SectionLabel>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Receive real-time event notifications.
                </p>
              </div>
            </div>

            {/* Webhook URL */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Webhook URL</Label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={webhookConfig?.webhookUrl || `${window.location.origin}/api/webhooks/incoming`}
                  className="bg-slate-500/30 border-slate-500/50 rounded-xl h-11 font-mono text-xs flex-1"
                  data-testid="input-webhook-url"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="border-slate-500/50 hover:bg-slate-500/10 h-11 w-11 shrink-0"
                  onClick={() =>
                    copyToClipboard(
                      webhookConfig?.webhookUrl || `${window.location.origin}/api/webhooks/incoming`,
                      "Webhook URL"
                    )
                  }
                  data-testid="button-copy-webhook-url"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Webhook Secret */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Webhook Secret</Label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  type={showWebhookSecret ? "text" : "password"}
                  value={webhookConfig?.webhookSecret || "whsec_••••••••••••••••••••••••"}
                  className="bg-slate-500/30 border-slate-500/50 rounded-xl h-11 font-mono text-xs flex-1"
                  data-testid="input-webhook-secret"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="border-slate-500/50 hover:bg-slate-500/10 h-11 w-11 shrink-0"
                  onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                  data-testid="button-toggle-webhook-secret"
                >
                  {showWebhookSecret ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="border-slate-500/50 hover:bg-slate-500/10 h-11 w-11 shrink-0"
                  onClick={() =>
                    copyToClipboard(
                      webhookConfig?.webhookSecret || "",
                      "Webhook secret"
                    )
                  }
                  data-testid="button-copy-webhook-secret"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Use this secret to verify webhook signatures.
              </p>
            </div>

            <div className="h-px bg-slate-500/20" />

            {/* Webhook Events */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Subscribed Events</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {Object.entries(webhookEvents).map(([event, enabled]) => (
                  <div
                    key={event}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-500/10"
                  >
                    <div>
                      <p className="text-sm font-medium font-mono">{event}</p>
                    </div>
                    <Switch
                      checked={enabled}
                      onCheckedChange={(checked) =>
                        handleWebhookToggle(event, checked)
                      }
                      data-testid={`switch-webhook-${event}`}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handleTestWebhook}
                disabled={testingWebhook}
                className="bg-violet-600 hover:bg-violet-700 text-white"
                data-testid="button-test-webhook"
              >
                {testingWebhook ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Test Webhook
              </Button>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* API Access */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible">
        <GlassCard>
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-500/10 flex items-center justify-center">
                <Key className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="flex-1">
                <SectionLabel>API Access</SectionLabel>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Manage API keys for programmatic access.
                </p>
              </div>
              <Button
                onClick={handleGenerateApiKey}
                disabled={generatingKey}
                className="bg-orange-600 hover:bg-orange-700 text-white"
                data-testid="button-generate-api-key"
              >
                {generatingKey ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Generate New Key
              </Button>
            </div>

            {/* Newly generated key banner */}
            {newlyGeneratedKey && (
              <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/30 space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                  <p className="text-sm font-medium text-orange-700 dark:text-orange-300">
                    New API key generated — copy it now. It won't be shown again.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={newlyGeneratedKey}
                    className="bg-slate-500/30 border-slate-500/50 rounded-xl h-10 font-mono text-xs flex-1"
                    data-testid="input-new-api-key"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="border-slate-500/50 hover:bg-slate-500/10 h-10 w-10 shrink-0"
                    onClick={() => copyToClipboard(newlyGeneratedKey, "API key")}
                    data-testid="button-copy-new-api-key"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 shrink-0 text-slate-500 hover:text-slate-700"
                    onClick={() => setNewlyGeneratedKey(null)}
                    data-testid="button-dismiss-new-api-key"
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Existing API keys list */}
            <div className="space-y-2">
              {apiKeys && apiKeys.length > 0 ? (
                apiKeys.map((apiKey) => (
                  <div
                    key={apiKey.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-slate-500/10"
                  >
                    <Key className="h-4 w-4 text-slate-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">
                          {apiKey.name || "API Key"}
                        </p>
                        <Badge
                          variant="outline"
                          className="text-xs border-slate-500/30 shrink-0"
                        >
                          {apiKey.keyPreview}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          Created {new Date(apiKey.createdAt).toLocaleDateString()}
                        </p>
                        <div className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
                          <Clock className="h-3 w-3" />
                          {apiKey.lastUsedAt
                            ? `Last used ${new Date(apiKey.lastUsedAt).toLocaleDateString()}`
                            : "Never used"}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      className="border-slate-500/50 hover:bg-slate-500/10 h-9 w-9 shrink-0"
                      onClick={() => copyToClipboard(apiKey.keyPreview, "API key")}
                      data-testid={`button-copy-key-${apiKey.id}`}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="border-red-500/30 hover:bg-red-500/10 text-red-600 dark:text-red-400 h-9 w-9 shrink-0"
                      disabled={revokingKeyId === apiKey.id}
                      onClick={() => handleRevokeApiKey(apiKey.id)}
                      data-testid={`button-revoke-key-${apiKey.id}`}
                    >
                      {revokingKeyId === apiKey.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                ))
              ) : (
                <div className="p-6 rounded-xl border border-dashed border-slate-500/30 text-center">
                  <Key className="h-8 w-8 text-slate-500/40 mx-auto mb-2" />
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    No API keys yet. Generate one to get started.
                  </p>
                </div>
              )}
            </div>

            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <p className="text-xs text-amber-700 dark:text-amber-300">
                <strong>Security note:</strong> API keys grant full access to your company data.
                Keep them secure and rotate them regularly. Revoked keys cannot be restored.
              </p>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Help & Support */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible">
        <GlassCard>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-cyan-500/10 flex items-center justify-center">
                <HelpCircle className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div>
                <SectionLabel>Help & Support</SectionLabel>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Need assistance?
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="border-slate-500/50 hover:bg-slate-500/10 justify-start"
                data-testid="button-docs"
              >
                <FileText className="h-4 w-4 mr-2" />
                Documentation
              </Button>
              <Button
                variant="outline"
                className="border-slate-500/50 hover:bg-slate-500/10 justify-start"
                data-testid="button-support"
              >
                <HelpCircle className="h-4 w-4 mr-2" />
                Contact Support
              </Button>
            </div>
          </div>
        </GlassCard>
      </motion.div>
    </PageWrapper>
  );
}
