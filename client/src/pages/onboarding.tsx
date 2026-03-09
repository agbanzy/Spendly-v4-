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
} from "lucide-react";
import { SUPPORTED_COUNTRIES, getCurrencyForCountry } from "@/lib/constants";

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
  { value: "2-10", label: "2–10" },
  { value: "11-50", label: "11–50" },
  { value: "51-200", label: "51–200" },
  { value: "200+", label: "200+" },
];

interface FormData {
  firstName: string;
  lastName: string;
  country: string;
  currency: string;
  phoneNumber: string;
  isBusinessAccount: boolean;
  businessName: string;
  businessType: string;
  businessIndustry: string;
  teamSize: string;
}

const STEPS = [
  { id: 1, title: "Account Type", icon: User, description: "Choose your account type" },
  { id: 2, title: "Profile", icon: Globe, description: "Your basic details" },
  { id: 3, title: "You're In!", icon: CheckCircle2, description: "Start using Financiar" },
];

export default function Onboarding() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(1);

  const [formData, setFormData] = useState<FormData>({
    firstName: "",
    lastName: "",
    country: "",
    currency: "",
    phoneNumber: "",
    isBusinessAccount: false,
    businessName: "",
    businessType: "",
    businessIndustry: "",
    teamSize: "",
  });

  // Persist form data to sessionStorage for resume
  useEffect(() => {
    const saved = sessionStorage.getItem("financiar_onboarding_form");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setFormData(prev => ({ ...prev, ...parsed }));
        if (parsed._step && parsed._step <= 3) setCurrentStep(parsed._step);
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

  // Pre-fill name from user account if available
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

  const submitProfileMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const profileData = {
        cognitoSub: user?.id,
        email: user?.email || "",
        firstName: data.firstName,
        lastName: data.lastName,
        displayName: `${data.firstName} ${data.lastName}`.trim(),
        country: data.country,
        currency: data.currency,
        phoneNumber: data.phoneNumber,
        isBusinessAccount: data.isBusinessAccount,
        businessName: data.businessName || undefined,
        businessType: data.businessType || undefined,
        businessIndustry: data.businessIndustry || undefined,
        teamSize: data.teamSize || undefined,
        onboardingCompleted: true,
        onboardingStep: 3,
      };
      const res = await apiRequest("POST", "/api/user-profile", profileData);
      return res.json();
    },
    onSuccess: () => {
      sessionStorage.removeItem("financiar_onboarding_form");
      queryClient.invalidateQueries({ queryKey: ["/api/user-profile"] });
      toast({
        title: "Welcome to Financiar! 🎉",
        description: "Your profile is set up. Let's get started!",
      });
      setCurrentStep(3);
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
        return !!(formData.firstName && formData.lastName && formData.country && formData.phoneNumber);
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      if (currentStep === 2) {
        // Submit profile on step 2 completion
        submitProfileMutation.mutate(formData);
      } else {
        setCurrentStep(prev => Math.min(prev + 1, 3));
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

  // Redirect to dashboard if onboarding is already complete (via useEffect to avoid render-time state update)
  useEffect(() => {
    if (userProfile?.onboardingCompleted && currentStep !== 3) {
      setLocation("/dashboard");
    }
  }, [userProfile?.onboardingCompleted, currentStep, setLocation]);

  if (userProfile?.onboardingCompleted && currentStep !== 3) {
    return null;
  }

  const progress = (currentStep / 3) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white dark:from-slate-900 dark:to-slate-800">
      <div className="container max-w-3xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-4">
            {currentStep === 3 ? (
              <Sparkles className="h-8 w-8 text-white" />
            ) : (
              <Shield className="h-8 w-8 text-white" />
            )}
          </div>
          <h1
            className="text-3xl font-bold font-display tracking-tight"
            data-testid="text-onboarding-title"
          >
            {currentStep === 3 ? "You're All Set!" : "Let's Get You Started"}
          </h1>
          <p className="text-muted-foreground mt-2">
            {currentStep === 3
              ? "Your Financiar account is ready to use"
              : "Quick setup — takes less than a minute"}
          </p>
        </div>

        {currentStep < 3 && (
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
                    data-testid="card-personal-account"
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
                    data-testid="card-business-account"
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
                          data-testid="input-business-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="businessType">Business Type *</Label>
                        <Select
                          value={formData.businessType}
                          onValueChange={(v) => updateField("businessType", v)}
                        >
                          <SelectTrigger data-testid="select-business-type">
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
                          <SelectTrigger data-testid="select-business-industry">
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
                          <SelectTrigger data-testid="select-team-size">
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
                  <Button
                    onClick={nextStep}
                    disabled={!validateStep(1)}
                    data-testid="button-next-step"
                  >
                    Continue
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Profile Basics */}
        {currentStep === 2 && (
          <Card className="shadow-2xl shadow-primary/8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Your Profile
              </CardTitle>
              <CardDescription>
                A few basics so we can personalize your experience.
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
                      data-testid="input-first-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) => updateField("lastName", e.target.value)}
                      placeholder="Doe"
                      data-testid="input-last-name"
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
                      <SelectTrigger data-testid="select-country">
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
                      data-testid="input-currency"
                    />
                    {formData.country && (
                      <p className="text-xs text-muted-foreground">
                        Based on {COUNTRIES.find((c) => c.code === formData.country)?.name}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">Phone Number *</Label>
                  <Input
                    id="phoneNumber"
                    type="tel"
                    value={formData.phoneNumber}
                    onChange={(e) => updateField("phoneNumber", e.target.value)}
                    placeholder="+1 (555) 123-4567"
                    data-testid="input-phone"
                  />
                  <p className="text-xs text-muted-foreground">
                    Used for account security and virtual account setup
                  </p>
                </div>

                <div className="flex justify-between pt-6 border-t">
                  <Button
                    variant="outline"
                    onClick={prevStep}
                    data-testid="button-prev-step"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                  <Button
                    onClick={nextStep}
                    disabled={!validateStep(2) || submitProfileMutation.isPending}
                    data-testid="button-next-step"
                  >
                    {submitProfileMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Setting up...
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

        {/* Step 3: Success */}
        {currentStep === 3 && (
          <Card className="shadow-2xl shadow-primary/8 overflow-hidden">
            <div className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-8 text-center">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(107,35,70,0.15),transparent_60%)]" />
              <div className="relative z-10">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-4">
                  <CheckCircle2 className="h-10 w-10 text-primary" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Welcome to Financiar, {formData.firstName}! 🎉</h2>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Your account is ready. Choose what you'd like to do first:
                </p>
              </div>
            </div>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card
                  className="cursor-pointer transition-all hover-elevate border-2 hover:border-primary/50"
                  onClick={() => setLocation("/budget")}
                  data-testid="card-goto-budget"
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
                  data-testid="card-goto-verification"
                >
                  <CardContent className="p-5 text-center">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 flex items-center justify-center mx-auto mb-3">
                      <ShieldCheck className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                    </div>
                    <h4 className="font-semibold text-sm">Complete Verification</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Unlock all features and higher limits
                    </p>
                  </CardContent>
                </Card>

                <Card
                  className="cursor-pointer transition-all hover-elevate border-2 border-primary/30 hover:border-primary bg-primary/5"
                  onClick={() => setLocation("/dashboard")}
                  data-testid="card-goto-dashboard"
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

              <div className="mt-6 pt-4 border-t text-center">
                <p className="text-xs text-muted-foreground">
                  You can always complete verification later from{" "}
                  <button
                    onClick={() => setLocation("/settings")}
                    className="text-primary hover:underline font-medium"
                  >
                    Settings → Verification
                  </button>
                </p>
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
