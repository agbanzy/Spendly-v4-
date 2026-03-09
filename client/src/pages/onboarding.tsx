import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getAuthHeaders } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  User, Building2, CheckCircle2,
  ArrowRight, ArrowLeft, Shield, Globe, Loader2,
  Sparkles, LayoutDashboard, PieChart, ShieldCheck,
  CreditCard, MapPin, Calendar, Phone, Fingerprint,
  Landmark,
} from "lucide-react";
import {
  SUPPORTED_COUNTRIES, getCurrencyForCountry, getPrimaryIdForCountry,
  isPaystackRegion,
} from "@/lib/constants";

const COUNTRIES = SUPPORTED_COUNTRIES.map(c => ({ code: c.code, name: c.name }));

const BUSINESS_TYPES = [
  { value: "sole_proprietor", label: "Sole Proprietorship" },
  { value: "partnership", label: "Partnership" },
  { value: "llc", label: "Limited Liability Company (LLC)" },
  { value: "corporation", label: "Corporation" },
  { value: "nonprofit", label: "Non-Profit Organization" },
];

const BUSINESS_INDUSTRIES = [
  { value: "technology", label: "Technology" },
  { value: "finance", label: "Finance & Banking" },
  { value: "healthcare", label: "Healthcare" },
  { value: "retail", label: "Retail & E-commerce" },
  { value: "education", label: "Education" },
  { value: "construction", label: "Construction" },
  { value: "hospitality", label: "Hospitality & Travel" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "agriculture", label: "Agriculture" },
  { value: "media", label: "Media & Entertainment" },
  { value: "logistics", label: "Logistics & Transport" },
  { value: "consulting", label: "Consulting & Services" },
  { value: "other", label: "Other" },
];

const TEAM_SIZES = [
  { value: "1", label: "Just me" },
  { value: "2-10", label: "2-10" },
  { value: "11-50", label: "11-50" },
  { value: "51-200", label: "51-200" },
  { value: "200+", label: "200+" },
];

interface FormData {
  firstName: string;
  lastName: string;
  country: string;
  currency: string;
  phoneNumber: string;
  dateOfBirth: string;
  isBusinessAccount: boolean;
  businessName: string;
  businessType: string;
  businessIndustry: string;
  teamSize: string;
  idNumber: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
}

const STEPS = [
  { id: 1, title: "Account Type", icon: User, description: "Choose your account type" },
  { id: 2, title: "Profile", icon: Globe, description: "Your basic details" },
  { id: 3, title: "Verification", icon: Fingerprint, description: "Identity & address" },
  { id: 4, title: "All Set!", icon: CheckCircle2, description: "Start using Financiar" },
];

export default function Onboarding() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(1);
  const [bvnVerified, setBvnVerified] = useState(false);
  const [bvnVerifying, setBvnVerifying] = useState(false);
  const [onboardingResult, setOnboardingResult] = useState<any>(null);

  const [formData, setFormData] = useState<FormData>({
    firstName: "",
    lastName: "",
    country: "",
    currency: "",
    phoneNumber: "",
    dateOfBirth: "",
    isBusinessAccount: false,
    businessName: "",
    businessType: "",
    businessIndustry: "",
    teamSize: "",
    idNumber: "",
    addressLine1: "",
    city: "",
    state: "",
    postalCode: "",
  });

  // Persist form data to sessionStorage
  useEffect(() => {
    const saved = sessionStorage.getItem("financiar_onboarding_form");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setFormData(prev => ({ ...prev, ...parsed }));
        if (parsed._step && parsed._step <= 4) setCurrentStep(parsed._step);
      } catch {}
    }
  }, []);

  useEffect(() => {
    sessionStorage.setItem(
      "financiar_onboarding_form",
      JSON.stringify({ ...formData, _step: currentStep })
    );
  }, [formData, currentStep]);

  // Auto-derive currency when country changes
  useEffect(() => {
    if (formData.country) {
      const { currency } = getCurrencyForCountry(formData.country);
      setFormData(prev => ({ ...prev, currency }));
    }
  }, [formData.country]);

  // Pre-fill name from user account
  useEffect(() => {
    if (user?.name) {
      const parts = user.name.split(" ");
      setFormData(prev => ({
        ...prev,
        firstName: prev.firstName || parts[0] || "",
        lastName: prev.lastName || parts.slice(1).join(" ") || "",
      }));
    }
  }, [user?.name]);

  const { data: userProfile, isLoading: profileLoading } = useQuery({
    queryKey: ["/api/user-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      try {
        const authHeaders = await getAuthHeaders();
        const res = await fetch(`/api/user-profile/${user.id}`, {
          headers: authHeaders,
          credentials: "include",
        });
        if (res.status === 404) {
          const createRes = await apiRequest("POST", "/api/user-profile", {
            cognitoSub: user.id,
            email: user.email,
            displayName: user.name,
            photoUrl: user.photoURL,
          });
          return await createRes.json();
        }
        return res.json();
      } catch {
        return null;
      }
    },
    enabled: !!user?.id,
  });

  const completeOnboardingMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await apiRequest("POST", "/api/onboarding/complete", {
        firstName: data.firstName,
        lastName: data.lastName,
        country: data.country,
        phoneNumber: data.phoneNumber,
        dateOfBirth: data.dateOfBirth,
        isBusinessAccount: data.isBusinessAccount,
        businessName: data.businessName || undefined,
        businessType: data.businessType || undefined,
        businessIndustry: data.businessIndustry || undefined,
        teamSize: data.teamSize || undefined,
        idNumber: data.idNumber,
        addressLine1: data.addressLine1,
        city: data.city,
        state: data.state,
        postalCode: data.postalCode,
      });
      return res.json();
    },
    onSuccess: (result) => {
      setOnboardingResult(result);
      sessionStorage.removeItem("financiar_onboarding_form");
      queryClient.invalidateQueries({ queryKey: ["/api/user-profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
      toast({
        title: "Welcome to Financiar!",
        description: "Your account is ready. Let's get started!",
      });
      setCurrentStep(4);
    },
    onError: (error: Error) => {
      toast({
        title: "Setup Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateField = (field: keyof FormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        if (formData.isBusinessAccount) {
          return !!(formData.businessName && formData.businessType);
        }
        return true;
      case 2:
        return !!(formData.firstName && formData.lastName && formData.country && formData.phoneNumber && formData.dateOfBirth);
      case 3:
        return !!(formData.idNumber && formData.addressLine1 && formData.city);
      default:
        return true;
    }
  };

  const verifyBvn = async () => {
    if (!formData.idNumber || formData.idNumber.length !== 11) {
      toast({ title: "Invalid BVN", description: "BVN must be 11 digits", variant: "destructive" });
      return;
    }
    setBvnVerifying(true);
    try {
      const res = await apiRequest("POST", "/api/payment/verify-account", {
        accountNumber: formData.idNumber,
        bankCode: "bvn",
        type: "bvn",
      });
      const result = await res.json();
      if (result.verified || result.status) {
        setBvnVerified(true);
        toast({ title: "BVN Verified", description: "Your identity has been confirmed" });
      } else {
        toast({ title: "Verification Failed", description: "Could not verify BVN. You can still continue.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Verification Error", description: "Could not verify BVN right now. You can still continue.", variant: "destructive" });
    } finally {
      setBvnVerifying(false);
    }
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      if (currentStep === 3) {
        completeOnboardingMutation.mutate(formData);
      } else {
        setCurrentStep(prev => Math.min(prev + 1, 4));
      }
    } else {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields before continuing.",
        variant: "destructive",
      });
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  if (profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading your profile...</p>
        </div>
      </div>
    );
  }

  // Redirect to dashboard if onboarding is already complete
  useEffect(() => {
    if (userProfile?.onboardingCompleted && currentStep !== 4) {
      setLocation("/dashboard");
    }
  }, [userProfile?.onboardingCompleted, currentStep, setLocation]);

  if (userProfile?.onboardingCompleted && currentStep !== 4) {
    return null;
  }

  const progress = (currentStep / 4) * 100;
  const idConfig = formData.country ? getPrimaryIdForCountry(formData.country) : null;
  const isNigeria = formData.country?.toUpperCase() === 'NG';

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white dark:from-slate-900 dark:to-slate-800">
      <div className="container max-w-3xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-4">
            {currentStep === 4 ? (
              <Sparkles className="h-8 w-8 text-white" />
            ) : (
              <Shield className="h-8 w-8 text-white" />
            )}
          </div>
          <h1 className="text-3xl font-bold font-display tracking-tight">
            {currentStep === 4 ? "You're All Set!" : "Let's Get You Started"}
          </h1>
          <p className="text-muted-foreground mt-2">
            {currentStep === 4
              ? "Your Financiar account is ready to use"
              : "Quick setup — takes about 2 minutes"}
          </p>
        </div>

        {currentStep < 4 && (
          <div className="mb-8">
            <div className="flex justify-between mb-2 gap-1 sm:gap-0 pb-2 sm:pb-0">
              {STEPS.map((step) => (
                <div
                  key={step.id}
                  className={`flex flex-col items-center flex-shrink-0 ${
                    currentStep >= step.id ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  <div
                    className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center mb-2 ${
                      currentStep > step.id
                        ? "bg-primary text-white"
                        : currentStep === step.id
                        ? "bg-primary/10 dark:bg-primary/20 text-primary border-2 border-primary"
                        : "bg-slate-100 dark:bg-slate-700"
                    }`}
                  >
                    {currentStep > step.id ? (
                      <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" />
                    ) : (
                      <step.icon className="h-4 w-4 sm:h-5 sm:w-5" />
                    )}
                  </div>
                  <span className="text-xs font-medium hidden sm:block">{step.title}</span>
                </div>
              ))}
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Step 1: Account Type */}
        {currentStep === 1 && (
          <Card className="shadow-2xl shadow-primary/8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Choose Your Account Type
              </CardTitle>
              <CardDescription>
                Select whether you're using Financiar for personal or business finances.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card
                    className={`cursor-pointer transition-all hover-elevate ${
                      !formData.isBusinessAccount ? "ring-2 ring-primary" : ""
                    }`}
                    onClick={() => updateField("isBusinessAccount", false)}
                  >
                    <CardContent className="p-6 text-center">
                      <User className="h-12 w-12 mx-auto mb-4 text-primary" />
                      <h3 className="font-semibold text-lg">Personal Account</h3>
                      <p className="text-sm text-muted-foreground mt-2">
                        For individuals managing personal finances, budgets, and expenses
                      </p>
                      {!formData.isBusinessAccount && (
                        <Badge className="mt-4 bg-primary">Selected</Badge>
                      )}
                    </CardContent>
                  </Card>
                  <Card
                    className={`cursor-pointer transition-all hover-elevate ${
                      formData.isBusinessAccount ? "ring-2 ring-primary" : ""
                    }`}
                    onClick={() => updateField("isBusinessAccount", true)}
                  >
                    <CardContent className="p-6 text-center">
                      <Building2 className="h-12 w-12 mx-auto mb-4 text-primary" />
                      <h3 className="font-semibold text-lg">Business Account</h3>
                      <p className="text-sm text-muted-foreground mt-2">
                        For companies and teams managing payroll, invoices, and expenses
                      </p>
                      {formData.isBusinessAccount && (
                        <Badge className="mt-4 bg-primary">Selected</Badge>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {formData.isBusinessAccount && (
                  <div className="space-y-4 pt-6 border-t animate-slide-up">
                    <h4 className="font-medium">Business Details</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="businessName">Business Name *</Label>
                        <Input
                          id="businessName"
                          value={formData.businessName}
                          onChange={(e) => updateField("businessName", e.target.value)}
                          placeholder="Your company name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="businessType">Business Type *</Label>
                        <Select
                          value={formData.businessType}
                          onValueChange={(v) => updateField("businessType", v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            {BUSINESS_TYPES.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="businessIndustry">Industry</Label>
                        <Select
                          value={formData.businessIndustry}
                          onValueChange={(v) => updateField("businessIndustry", v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select industry" />
                          </SelectTrigger>
                          <SelectContent>
                            {BUSINESS_INDUSTRIES.map((ind) => (
                              <SelectItem key={ind.value} value={ind.value}>
                                {ind.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="teamSize">Team Size</Label>
                        <Select
                          value={formData.teamSize}
                          onValueChange={(v) => updateField("teamSize", v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="How many people?" />
                          </SelectTrigger>
                          <SelectContent>
                            {TEAM_SIZES.map((size) => (
                              <SelectItem key={size.value} value={size.value}>
                                {size.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-6 border-t">
                  <Button onClick={nextStep} disabled={!validateStep(1)}>
                    Continue
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Profile & Location */}
        {currentStep === 2 && (
          <Card className="shadow-2xl shadow-primary/8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Your Profile
              </CardTitle>
              <CardDescription>
                Tell us about yourself so we can personalize your experience.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input
                      id="firstName"
                      value={formData.firstName}
                      onChange={(e) => updateField("firstName", e.target.value)}
                      placeholder="John"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) => updateField("lastName", e.target.value)}
                      placeholder="Doe"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="country">Country *</Label>
                    <Select
                      value={formData.country}
                      onValueChange={(v) => updateField("country", v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select your country" />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map((country) => (
                          <SelectItem key={country.code} value={country.code}>
                            {country.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currency">Currency</Label>
                    <Input
                      id="currency"
                      value={formData.currency || "Auto-detected from country"}
                      disabled
                      className="bg-muted"
                    />
                    {formData.country && (
                      <p className="text-xs text-muted-foreground">
                        Based on {COUNTRIES.find((c) => c.code === formData.country)?.name}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phoneNumber">
                      <Phone className="h-3.5 w-3.5 inline mr-1" />
                      Phone Number *
                    </Label>
                    <Input
                      id="phoneNumber"
                      type="tel"
                      value={formData.phoneNumber}
                      onChange={(e) => updateField("phoneNumber", e.target.value)}
                      placeholder="+1 (555) 123-4567"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dateOfBirth">
                      <Calendar className="h-3.5 w-3.5 inline mr-1" />
                      Date of Birth *
                    </Label>
                    <Input
                      id="dateOfBirth"
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={(e) => updateField("dateOfBirth", e.target.value)}
                      max={new Date(Date.now() - 18 * 365.25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                    />
                    <p className="text-xs text-muted-foreground">Must be 18 or older</p>
                  </div>
                </div>

                <div className="flex justify-between pt-6 border-t">
                  <Button variant="outline" onClick={prevStep}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                  <Button onClick={nextStep} disabled={!validateStep(2)}>
                    Continue
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Identity & Address */}
        {currentStep === 3 && (
          <Card className="shadow-2xl shadow-primary/8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Fingerprint className="h-5 w-5" />
                Identity & Address
              </CardTitle>
              <CardDescription>
                We need to verify your identity to unlock all features and create your virtual account.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Identity Section */}
                <div className="space-y-2">
                  <Label htmlFor="idNumber">
                    <Shield className="h-3.5 w-3.5 inline mr-1" />
                    {idConfig?.label || 'ID Number'} *
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="idNumber"
                      value={formData.idNumber}
                      onChange={(e) => {
                        updateField("idNumber", e.target.value);
                        if (bvnVerified) setBvnVerified(false);
                      }}
                      placeholder={idConfig?.placeholder || 'Enter ID number'}
                      maxLength={idConfig?.maxLength || 20}
                      className={bvnVerified ? "border-green-500" : ""}
                    />
                    {isNigeria && (
                      <Button
                        variant={bvnVerified ? "default" : "outline"}
                        onClick={verifyBvn}
                        disabled={bvnVerifying || bvnVerified || !formData.idNumber}
                        className={bvnVerified ? "bg-green-600 hover:bg-green-700" : ""}
                      >
                        {bvnVerifying ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : bvnVerified ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          "Verify"
                        )}
                      </Button>
                    )}
                  </div>
                  {bvnVerified && (
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Identity verified
                    </p>
                  )}
                  {!bvnVerified && idConfig && (
                    <p className="text-xs text-muted-foreground">
                      Your {idConfig.label.toLowerCase()} is used for identity verification only.
                    </p>
                  )}
                </div>

                {/* Address Section */}
                <div className="pt-4 border-t">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Address
                  </h4>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="addressLine1">Street Address *</Label>
                      <Input
                        id="addressLine1"
                        value={formData.addressLine1}
                        onChange={(e) => updateField("addressLine1", e.target.value)}
                        placeholder="123 Main Street"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="city">City *</Label>
                        <Input
                          id="city"
                          value={formData.city}
                          onChange={(e) => updateField("city", e.target.value)}
                          placeholder="City"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="state">State / Province</Label>
                        <Input
                          id="state"
                          value={formData.state}
                          onChange={(e) => updateField("state", e.target.value)}
                          placeholder="State"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="postalCode">Postal Code</Label>
                        <Input
                          id="postalCode"
                          value={formData.postalCode}
                          onChange={(e) => updateField("postalCode", e.target.value)}
                          placeholder="12345"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between pt-6 border-t">
                  <Button variant="outline" onClick={prevStep}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                  <Button
                    onClick={nextStep}
                    disabled={!validateStep(3) || completeOnboardingMutation.isPending}
                  >
                    {completeOnboardingMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Setting up your account...
                      </>
                    ) : (
                      <>
                        Complete Setup
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Success */}
        {currentStep === 4 && (
          <Card className="shadow-2xl shadow-primary/8 overflow-hidden">
            <div className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-8 text-center">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(107,35,70,0.15),transparent_60%)]" />
              <div className="relative z-10">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-4">
                  <CheckCircle2 className="h-10 w-10 text-primary" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Welcome to Financiar, {formData.firstName}!</h2>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Your account is set up with a 90-day free trial. All features are unlocked.
                </p>
              </div>
            </div>
            <CardContent className="p-6">
              {/* Virtual Account Details */}
              {onboardingResult?.virtualAccount && (
                <div className="mb-6 p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <h3 className="font-semibold flex items-center gap-2 mb-3">
                    <Landmark className="h-4 w-4 text-primary" />
                    Your Virtual Account
                  </h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Bank:</span>
                      <p className="font-medium">{onboardingResult.virtualAccount.bankName}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Account Number:</span>
                      <p className="font-medium font-mono">{onboardingResult.virtualAccount.accountNumber}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Account Name:</span>
                      <p className="font-medium">{onboardingResult.virtualAccount.accountName}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Status:</span>
                      <Badge variant={onboardingResult.virtualAccount.status === 'active' ? 'default' : 'secondary'}>
                        {onboardingResult.virtualAccount.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              )}

              {/* Subscription Info */}
              {onboardingResult?.subscription && (
                <div className="mb-6 p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                  <h3 className="font-semibold flex items-center gap-2 mb-2">
                    <CreditCard className="h-4 w-4 text-emerald-600" />
                    Free Trial Active
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Enjoy all Financiar Pro features free for 90 days. Your trial ends on{" "}
                    <span className="font-medium text-foreground">
                      {new Date(onboardingResult.subscription.trialEndDate).toLocaleDateString()}
                    </span>.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card
                  className="cursor-pointer transition-all hover-elevate border-2 hover:border-primary/50"
                  onClick={() => setLocation("/budget")}
                >
                  <CardContent className="p-5 text-center">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 flex items-center justify-center mx-auto mb-3">
                      <PieChart className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <h4 className="font-semibold text-sm">Set Up a Budget</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Create your first budget to track spending
                    </p>
                  </CardContent>
                </Card>

                <Card
                  className="cursor-pointer transition-all hover-elevate border-2 hover:border-primary/50"
                  onClick={() => setLocation("/settings")}
                >
                  <CardContent className="p-5 text-center">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 flex items-center justify-center mx-auto mb-3">
                      <ShieldCheck className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                    </div>
                    <h4 className="font-semibold text-sm">View Settings</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Manage your account and billing
                    </p>
                  </CardContent>
                </Card>

                <Card
                  className="cursor-pointer transition-all hover-elevate border-2 border-primary/30 hover:border-primary bg-primary/5"
                  onClick={() => setLocation("/dashboard")}
                >
                  <CardContent className="p-5 text-center">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto mb-3">
                      <LayoutDashboard className="h-6 w-6 text-primary" />
                    </div>
                    <h4 className="font-semibold text-sm">Explore Dashboard</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Jump straight into your financial HQ
                    </p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-sm text-muted-foreground mt-6">
          Need help?{" "}
          <a href="mailto:support@thefinanciar.com" className="text-primary hover:underline">
            Contact Support
          </a>
        </p>
      </div>
    </div>
  );
}
