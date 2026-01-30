import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  Building2,
  ArrowLeft,
  Globe,
  Mail,
  Phone,
  MapPin,
  DollarSign,
  Clock,
  Save,
  Upload,
  Building,
  Briefcase,
  Calendar,
} from "lucide-react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { OrganizationSettings } from "@shared/schema";

const currencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'NGN', 'KES', 'ZAR', 'GHS'];
const timezones = ['UTC', 'America/New_York', 'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Asia/Tokyo', 'Africa/Lagos'];
const industries = ['Technology', 'Finance', 'Healthcare', 'Education', 'Retail', 'Manufacturing', 'Services', 'Other'];
const companySizes = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'];
const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function AdminOrganization() {
  const { toast } = useToast();

  const { data: settings, isLoading } = useQuery<OrganizationSettings>({
    queryKey: ["/api/admin/organization"],
  });

  const { register, handleSubmit, reset, setValue, watch } = useForm({
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      website: '',
      address: '',
      city: '',
      state: '',
      country: '',
      postalCode: '',
      taxId: '',
      currency: 'USD',
      timezone: 'UTC',
      industry: '',
      size: '',
      fiscalYearStart: 'January',
    },
  });

  useEffect(() => {
    if (settings) {
      reset({
        name: settings.name || '',
        email: settings.email || '',
        phone: settings.phone || '',
        website: settings.website || '',
        address: settings.address || '',
        city: settings.city || '',
        state: settings.state || '',
        country: settings.country || '',
        postalCode: settings.postalCode || '',
        taxId: settings.taxId || '',
        currency: settings.currency || 'USD',
        timezone: settings.timezone || 'UTC',
        industry: settings.industry || '',
        size: settings.size || '',
        fiscalYearStart: settings.fiscalYearStart || 'January',
      });
    }
  }, [settings, reset]);

  const updateSettings = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("PUT", "/api/admin/organization", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/organization"] });
      toast({ title: "Organization settings saved" });
    },
    onError: () => {
      toast({ title: "Failed to save settings", variant: "destructive" });
    },
  });

  const onSubmit = (data: any) => {
    updateSettings.mutate(data);
  };

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
            <h1 className="text-3xl font-black tracking-tight flex items-center gap-3" data-testid="text-org-settings-title">
              <Building2 className="h-8 w-8 text-primary" />
              Organization Settings
            </h1>
            <p className="text-muted-foreground mt-1">
              Configure your company profile and preferences
            </p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Company Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Company Information
              </CardTitle>
              <CardDescription>Basic information about your organization</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Company Name</Label>
                  <Input id="name" placeholder="Enter company name" {...register("name")} data-testid="input-company-name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="website" placeholder="https://example.com" className="pl-10" {...register("website")} data-testid="input-website" />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="email" type="email" placeholder="contact@example.com" className="pl-10" {...register("email")} data-testid="input-email" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="phone" placeholder="+1 (555) 000-0000" className="pl-10" {...register("phone")} data-testid="input-phone" />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="industry">Industry</Label>
                  <Select onValueChange={(value) => setValue("industry", value)} value={watch("industry")}>
                    <SelectTrigger data-testid="select-industry">
                      <Briefcase className="h-4 w-4 mr-2 text-muted-foreground" />
                      <SelectValue placeholder="Select industry" />
                    </SelectTrigger>
                    <SelectContent>
                      {industries.map((industry) => (
                        <SelectItem key={industry} value={industry}>{industry}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="size">Company Size</Label>
                  <Select onValueChange={(value) => setValue("size", value)} value={watch("size")}>
                    <SelectTrigger data-testid="select-size">
                      <SelectValue placeholder="Select size" />
                    </SelectTrigger>
                    <SelectContent>
                      {companySizes.map((size) => (
                        <SelectItem key={size} value={size}>{size} employees</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Address */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Address
              </CardTitle>
              <CardDescription>Company location and mailing address</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="address">Street Address</Label>
                <Input id="address" placeholder="123 Main Street" {...register("address")} data-testid="input-address" />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" placeholder="City" {...register("city")} data-testid="input-city" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State/Province</Label>
                  <Input id="state" placeholder="State" {...register("state")} data-testid="input-state" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postalCode">Postal Code</Label>
                  <Input id="postalCode" placeholder="12345" {...register("postalCode")} data-testid="input-postal" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input id="country" placeholder="Country" {...register("country")} data-testid="input-country" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Financial Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Financial Settings
              </CardTitle>
              <CardDescription>Currency, timezone, and fiscal year settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="currency">Default Currency</Label>
                  <Select onValueChange={(value) => setValue("currency", value)} value={watch("currency")}>
                    <SelectTrigger data-testid="select-currency">
                      <DollarSign className="h-4 w-4 mr-2 text-muted-foreground" />
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map((currency) => (
                        <SelectItem key={currency} value={currency}>{currency}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select onValueChange={(value) => setValue("timezone", value)} value={watch("timezone")}>
                    <SelectTrigger data-testid="select-timezone">
                      <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      {timezones.map((tz) => (
                        <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fiscalYearStart">Fiscal Year Start</Label>
                  <Select onValueChange={(value) => setValue("fiscalYearStart", value)} value={watch("fiscalYearStart")}>
                    <SelectTrigger data-testid="select-fiscal-year">
                      <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                      <SelectValue placeholder="Select month" />
                    </SelectTrigger>
                    <SelectContent>
                      {months.map((month) => (
                        <SelectItem key={month} value={month}>{month}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxId">Tax ID / VAT Number</Label>
                <Input id="taxId" placeholder="Enter tax ID" {...register("taxId")} data-testid="input-tax-id" />
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button type="submit" disabled={updateSettings.isPending} data-testid="button-save-settings">
              <Save className="h-4 w-4 mr-2" />
              {updateSettings.isPending ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
