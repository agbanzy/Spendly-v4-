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
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

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
}

export default function Settings() {
  const { toast } = useToast();
  
  const { data: settings, isLoading } = useQuery<CompanySettings>({
    queryKey: ["/api/settings"],
  });

  const [formData, setFormData] = useState<Partial<CompanySettings>>({});
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [expenseAlerts, setExpenseAlerts] = useState(true);
  const [budgetWarnings, setBudgetWarnings] = useState(true);
  const [transactionPin, setTransactionPin] = useState(false);

  useEffect(() => {
    if (settings) {
      setFormData(settings);
      setEmailNotifications(settings.notificationsEnabled);
    }
  }, [settings]);

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

  const handleSaveCompany = () => {
    updateSettingsMutation.mutate({
      companyName: formData.companyName,
      companyAddress: formData.companyAddress,
      companyEmail: formData.companyEmail,
      companyPhone: formData.companyPhone,
    });
  };

  const handleSaveCurrency = () => {
    updateSettingsMutation.mutate({
      currency: formData.currency,
      timezone: formData.timezone,
    });
  };

  const handleNotificationChange = (key: string, value: boolean) => {
    if (key === "email") {
      setEmailNotifications(value);
      updateSettingsMutation.mutate({ notificationsEnabled: value });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-black tracking-tight" data-testid="text-settings-title">
          Settings
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage your account and company preferences.
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
            <Globe className="h-5 w-5 text-primary" />
            <CardTitle>Currency & Region</CardTitle>
          </div>
          <CardDescription>
            Set your default currency and regional preferences.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <SelectItem value="USD">USD - US Dollar</SelectItem>
                  <SelectItem value="EUR">EUR - Euro</SelectItem>
                  <SelectItem value="GBP">GBP - British Pound</SelectItem>
                  <SelectItem value="NGN">NGN - Nigerian Naira</SelectItem>
                  <SelectItem value="KES">KES - Kenyan Shilling</SelectItem>
                  <SelectItem value="GHS">GHS - Ghanaian Cedi</SelectItem>
                  <SelectItem value="ZAR">ZAR - South African Rand</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <div className="space-y-2">
              <Label htmlFor="fiscalYearStart">Fiscal Year Start</Label>
              <Select 
                value={formData.fiscalYearStart || "January"}
                onValueChange={(value) => setFormData({ ...formData, fiscalYearStart: value })}
              >
                <SelectTrigger data-testid="select-fiscal-year">
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="January">January</SelectItem>
                  <SelectItem value="April">April</SelectItem>
                  <SelectItem value="July">July</SelectItem>
                  <SelectItem value="October">October</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end">
            <Button 
              onClick={handleSaveCurrency}
              disabled={updateSettingsMutation.isPending}
              data-testid="button-save-currency"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            <CardTitle>Appearance</CardTitle>
          </div>
          <CardDescription>
            Customize how Spendly looks for you.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Theme</Label>
              <p className="text-sm text-muted-foreground">
                Switch between light and dark mode.
              </p>
            </div>
            <ThemeToggle />
          </div>
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
              onCheckedChange={(checked) => handleNotificationChange("email", checked)}
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
              onCheckedChange={setExpenseAlerts}
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
              onCheckedChange={setBudgetWarnings}
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
              onCheckedChange={setTransactionPin}
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
              Automatically approve expenses below this amount.
            </p>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">$</span>
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
              >
                Update
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <CardTitle>Billing & Plan</CardTitle>
          </div>
          <CardDescription>
            Manage your subscription and payment methods.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-bold">Standard Plan</p>
                <Badge className="bg-primary">Current</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                $29/month • Billed monthly
              </p>
            </div>
            <Button variant="outline" data-testid="button-manage-plan">
              Manage Plan
            </Button>
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
