import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Lock,
  ArrowLeft,
  Shield,
  Key,
  Smartphone,
  Clock,
  AlertTriangle,
  CheckCircle,
  Save,
  RefreshCw,
  Eye,
  EyeOff,
  UserX,
  ShieldCheck,
} from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

export default function AdminSecurity() {
  const { toast } = useToast();
  const [settings, setSettings] = useState({
    requireMfa: false,
    sessionTimeout: '30',
    passwordMinLength: '8',
    passwordRequireUppercase: true,
    passwordRequireNumber: true,
    passwordRequireSpecial: true,
    maxLoginAttempts: '5',
    lockoutDuration: '30',
    allowApiKeys: true,
    auditLogRetention: '90',
  });

  const handleSettingChange = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const saveSettings = useMutation({
    mutationFn: async () => {
      return apiRequest("PUT", "/api/admin/security", settings);
    },
    onSuccess: () => {
      toast({ title: "Security settings saved" });
    },
    onError: () => {
      toast({ title: "Failed to save settings", variant: "destructive" });
    },
  });

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500 texture-mesh min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/admin">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-black tracking-tight flex items-center gap-3" data-testid="text-security-title">
              <Lock className="h-8 w-8 text-primary" />
              Security & Access
            </h1>
            <p className="text-muted-foreground mt-1">
              Configure security policies and access controls
            </p>
          </div>
        </div>
      </div>

      {/* Security Status */}
      <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-full bg-emerald-100 dark:bg-emerald-900/30">
              <ShieldCheck className="h-6 w-6 text-emerald-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-emerald-700 dark:text-emerald-400">Security Status: Good</h3>
              <p className="text-sm text-emerald-600 dark:text-emerald-500">
                Your security settings are properly configured
              </p>
            </div>
            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              Secure
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Authentication Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Authentication
          </CardTitle>
          <CardDescription>Configure login and authentication policies</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-medium">Require Multi-Factor Authentication</Label>
              <p className="text-sm text-muted-foreground">
                Require all users to set up MFA for their accounts
              </p>
            </div>
            <Switch
              checked={settings.requireMfa}
              onCheckedChange={(checked) => handleSettingChange('requireMfa', checked)}
              data-testid="switch-require-mfa"
            />
          </div>
          <Separator />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sessionTimeout">Session Timeout (minutes)</Label>
              <Select
                value={settings.sessionTimeout}
                onValueChange={(value) => handleSettingChange('sessionTimeout', value)}
              >
                <SelectTrigger data-testid="select-session-timeout">
                  <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="120">2 hours</SelectItem>
                  <SelectItem value="480">8 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxLoginAttempts">Max Login Attempts</Label>
              <Select
                value={settings.maxLoginAttempts}
                onValueChange={(value) => handleSettingChange('maxLoginAttempts', value)}
              >
                <SelectTrigger data-testid="select-max-attempts">
                  <UserX className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 attempts</SelectItem>
                  <SelectItem value="5">5 attempts</SelectItem>
                  <SelectItem value="10">10 attempts</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="lockoutDuration">Account Lockout Duration (minutes)</Label>
            <Select
              value={settings.lockoutDuration}
              onValueChange={(value) => handleSettingChange('lockoutDuration', value)}
            >
              <SelectTrigger className="w-full md:w-1/2" data-testid="select-lockout">
                <Lock className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 minutes</SelectItem>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="60">1 hour</SelectItem>
                <SelectItem value="1440">24 hours</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Password Policy */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Password Policy
          </CardTitle>
          <CardDescription>Set requirements for user passwords</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="passwordMinLength">Minimum Password Length</Label>
            <Select
              value={settings.passwordMinLength}
              onValueChange={(value) => handleSettingChange('passwordMinLength', value)}
            >
              <SelectTrigger className="w-full md:w-1/2" data-testid="select-password-length">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="6">6 characters</SelectItem>
                <SelectItem value="8">8 characters</SelectItem>
                <SelectItem value="10">10 characters</SelectItem>
                <SelectItem value="12">12 characters</SelectItem>
                <SelectItem value="16">16 characters</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="font-medium">Require Uppercase Letters</Label>
                <p className="text-sm text-muted-foreground">At least one uppercase letter (A-Z)</p>
              </div>
              <Switch
                checked={settings.passwordRequireUppercase}
                onCheckedChange={(checked) => handleSettingChange('passwordRequireUppercase', checked)}
                data-testid="switch-require-uppercase"
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="font-medium">Require Numbers</Label>
                <p className="text-sm text-muted-foreground">At least one number (0-9)</p>
              </div>
              <Switch
                checked={settings.passwordRequireNumber}
                onCheckedChange={(checked) => handleSettingChange('passwordRequireNumber', checked)}
                data-testid="switch-require-number"
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="font-medium">Require Special Characters</Label>
                <p className="text-sm text-muted-foreground">At least one special character (!@#$%^&*)</p>
              </div>
              <Switch
                checked={settings.passwordRequireSpecial}
                onCheckedChange={(checked) => handleSettingChange('passwordRequireSpecial', checked)}
                data-testid="switch-require-special"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Access */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            API Access
          </CardTitle>
          <CardDescription>Manage API keys and integrations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-medium">Allow API Keys</Label>
              <p className="text-sm text-muted-foreground">
                Allow users to generate API keys for external integrations
              </p>
            </div>
            <Switch
              checked={settings.allowApiKeys}
              onCheckedChange={(checked) => handleSettingChange('allowApiKeys', checked)}
              data-testid="switch-allow-api"
            />
          </div>
        </CardContent>
      </Card>

      {/* Audit Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Audit & Logging
          </CardTitle>
          <CardDescription>Configure audit log settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="auditLogRetention">Audit Log Retention Period</Label>
            <Select
              value={settings.auditLogRetention}
              onValueChange={(value) => handleSettingChange('auditLogRetention', value)}
            >
              <SelectTrigger className="w-full md:w-1/2" data-testid="select-log-retention">
                <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="60">60 days</SelectItem>
                <SelectItem value="90">90 days</SelectItem>
                <SelectItem value="180">180 days</SelectItem>
                <SelectItem value="365">1 year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending} data-testid="button-save-security">
          <Save className="h-4 w-4 mr-2" />
          {saveSettings.isPending ? "Saving..." : "Save Security Settings"}
        </Button>
      </div>
    </div>
  );
}
