import { useState, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  User, Building2, FileCheck, Upload, CheckCircle2, 
  ArrowRight, ArrowLeft, Shield, Globe, Loader2, 
  CreditCard, Landmark, ExternalLink, ShieldCheck, FileText
} from "lucide-react";

const COUNTRIES = [
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" },
  { code: "NG", name: "Nigeria" },
  { code: "GH", name: "Ghana" },
  { code: "KE", name: "Kenya" },
  { code: "ZA", name: "South Africa" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "AU", name: "Australia" },
];

const ID_TYPES = [
  { value: "passport", label: "International Passport" },
  { value: "drivers_license", label: "Driver's License" },
  { value: "national_id", label: "National ID Card" },
  { value: "voters_card", label: "Voter's Card" },
];

const BUSINESS_TYPES = [
  { value: "sole_proprietor", label: "Sole Proprietorship" },
  { value: "partnership", label: "Partnership" },
  { value: "llc", label: "Limited Liability Company (LLC)" },
  { value: "corporation", label: "Corporation" },
  { value: "nonprofit", label: "Non-Profit Organization" },
];

interface FormData {
  firstName: string;
  lastName: string;
  middleName: string;
  dateOfBirth: string;
  gender: string;
  nationality: string;
  phoneNumber: string;
  alternatePhone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  idType: string;
  idNumber: string;
  idExpiryDate: string;
  idFrontUrl: string;
  idBackUrl: string;
  selfieUrl: string;
  proofOfAddressUrl: string;
  isBusinessAccount: boolean;
  businessName: string;
  businessType: string;
  businessRegistrationNumber: string;
  businessAddress: string;
  businessDocumentUrl: string;
  acceptTerms: boolean;
}

const STEPS = [
  { id: 1, title: "Account Type", icon: User, description: "Choose your account type" },
  { id: 2, title: "Personal Info", icon: User, description: "Your personal details" },
  { id: 3, title: "Address", icon: Globe, description: "Your address information" },
  { id: 4, title: "Verification", icon: FileCheck, description: "Identity verification" },
  { id: 5, title: "Complete", icon: CheckCircle2, description: "Review and submit" },
];

// Countries that support Paystack BVN verification
const PAYSTACK_COUNTRIES = ["NG", "GH", "KE", "ZA"];
// Countries that support Stripe Identity verification
const STRIPE_COUNTRIES = ["US", "GB", "CA", "DE", "FR", "AU"];

interface Bank {
  id: number;
  name: string;
  code: string;
  slug: string;
  country: string;
}

export default function Onboarding() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(1);
  const [isUploading, setIsUploading] = useState(false);
  
  // KYC verification state
  const [verificationMethod, setVerificationMethod] = useState<'stripe' | 'paystack' | 'manual'>('manual');
  const [stripeSessionId, setStripeSessionId] = useState<string | null>(null);
  const [stripeVerificationUrl, setStripeVerificationUrl] = useState<string | null>(null);
  const [stripeVerificationStatus, setStripeVerificationStatus] = useState<string | null>(null);
  const [bvnNumber, setBvnNumber] = useState('');
  const [selectedBank, setSelectedBank] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [bvnVerified, setBvnVerified] = useState(false);
  const [bvnVerifying, setBvnVerifying] = useState(false);
  const [banks, setBanks] = useState<Bank[]>([]);
  
  const [formData, setFormData] = useState<FormData>({
    firstName: "",
    lastName: "",
    middleName: "",
    dateOfBirth: "",
    gender: "",
    nationality: "",
    phoneNumber: "",
    alternatePhone: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    country: "",
    postalCode: "",
    idType: "",
    idNumber: "",
    idExpiryDate: "",
    idFrontUrl: "",
    idBackUrl: "",
    selfieUrl: "",
    proofOfAddressUrl: "",
    isBusinessAccount: false,
    businessName: "",
    businessType: "",
    businessRegistrationNumber: "",
    businessAddress: "",
    businessDocumentUrl: "",
    acceptTerms: false,
  });

  const { data: userProfile, isLoading: profileLoading } = useQuery({
    queryKey: ["/api/user-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      try {
        const res = await fetch(`/api/user-profile/${user.id}`);
        if (res.status === 404) {
          const createRes = await apiRequest("POST", "/api/user-profile", {
            firebaseUid: user.id,
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

  const submitKycMutation = useMutation({
    mutationFn: async (data: FormData) => {
      // Ensure all string fields are actually strings (not booleans)
      const sanitizedData = {
        firebaseUid: user?.id,
        firstName: String(data.firstName || ''),
        lastName: String(data.lastName || ''),
        middleName: data.middleName || undefined,
        dateOfBirth: String(data.dateOfBirth || ''),
        gender: data.gender || undefined,
        nationality: String(data.nationality || ''),
        phoneNumber: String(data.phoneNumber || ''),
        alternatePhone: data.alternatePhone || undefined,
        addressLine1: String(data.addressLine1 || ''),
        addressLine2: data.addressLine2 || undefined,
        city: String(data.city || ''),
        state: String(data.state || ''),
        country: String(data.country || ''),
        postalCode: String(data.postalCode || ''),
        idType: data.idType || undefined,
        idNumber: data.idNumber || undefined,
        idExpiryDate: data.idExpiryDate || undefined,
        idFrontUrl: data.idFrontUrl || undefined,
        idBackUrl: data.idBackUrl || undefined,
        selfieUrl: data.selfieUrl || undefined,
        proofOfAddressUrl: data.proofOfAddressUrl || undefined,
        isBusinessAccount: Boolean(data.isBusinessAccount),
        businessName: data.businessName || undefined,
        businessType: data.businessType || undefined,
        businessRegistrationNumber: data.businessRegistrationNumber || undefined,
        businessAddress: data.businessAddress || undefined,
        businessDocumentUrl: data.businessDocumentUrl || undefined,
        acceptTerms: Boolean(data.acceptTerms),
        bvnNumber: bvnNumber || undefined,
        bvnVerified: bvnVerified,
        stripeVerified: stripeVerificationStatus === 'verified',
      };
      console.log('Submitting KYC data:', JSON.stringify(sanitizedData, null, 2));
      const res = await apiRequest("POST", "/api/kyc", sanitizedData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-profile"] });
      toast({
        title: "KYC Submitted Successfully",
        description: "Your verification is now under review. This usually takes 24-48 hours.",
      });
      setLocation("/dashboard");
    },
    onError: (error: Error) => {
      toast({
        title: "Submission Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileUpload = useCallback(async (file: File, fieldName: keyof FormData) => {
    setIsUploading(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append("document", file);
      
      const res = await fetch("/api/kyc/upload", {
        method: "POST",
        body: formDataUpload,
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Upload failed");
      }
      
      setFormData(prev => ({ ...prev, [fieldName]: data.url }));
      toast({
        title: "File Uploaded",
        description: "Document uploaded successfully",
      });
    } catch (error: any) {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload document. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  }, [toast]);

  // Load banks for Paystack BVN verification
  useEffect(() => {
    if (PAYSTACK_COUNTRIES.includes(formData.country)) {
      fetch('/api/kyc/paystack/banks')
        .then(res => res.json())
        .then(data => {
          if (data.success && data.banks) {
            setBanks(data.banks);
          }
        })
        .catch(console.error);
    }
  }, [formData.country]);

  // Auto-select verification method based on country
  useEffect(() => {
    if (STRIPE_COUNTRIES.includes(formData.country)) {
      setVerificationMethod('stripe');
    } else if (PAYSTACK_COUNTRIES.includes(formData.country)) {
      setVerificationMethod('paystack');
    } else {
      setVerificationMethod('manual');
    }
  }, [formData.country]);

  // Create Stripe Identity verification session
  const handleStripeVerification = async () => {
    if (!user?.email) {
      toast({ title: "Error", description: "User email not found", variant: "destructive" });
      return;
    }
    
    try {
      const res = await apiRequest("POST", "/api/kyc/stripe/create-session", {
        userId: user.id,
        email: user.email,
        returnUrl: `${window.location.origin}/onboarding?step=4&verified=true`,
      });
      
      const data = await res.json();
      
      if (data.url) {
        setStripeSessionId(data.sessionId);
        setStripeVerificationUrl(data.url);
        setStripeVerificationStatus(data.status);
        
        // Open Stripe Identity in new tab
        window.open(data.url, '_blank');
        
        toast({
          title: "Verification Started",
          description: "Complete the verification in the new window. Return here when done.",
        });
      } else {
        throw new Error(data.error || "Failed to create verification session");
      }
    } catch (error: any) {
      toast({
        title: "Verification Failed",
        description: error.message || "Failed to start identity verification",
        variant: "destructive",
      });
    }
  };

  // Check Stripe verification status
  const checkStripeStatus = async () => {
    if (!stripeSessionId) return;
    
    try {
      const res = await fetch(`/api/kyc/stripe/status/${stripeSessionId}`);
      const data = await res.json();
      
      setStripeVerificationStatus(data.status);
      
      if (data.status === 'verified') {
        toast({
          title: "Verification Complete",
          description: "Your identity has been verified successfully!",
        });
      } else if (data.status === 'requires_input') {
        toast({
          title: "Additional Info Required",
          description: "Please complete all verification steps.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Failed to check verification status:', error);
    }
  };

  // Paystack BVN verification
  const handleBvnVerification = async () => {
    if (!bvnNumber || bvnNumber.length !== 11) {
      toast({ 
        title: "Invalid BVN", 
        description: "Please enter a valid 11-digit BVN", 
        variant: "destructive" 
      });
      return;
    }
    
    setBvnVerifying(true);
    
    try {
      const res = await apiRequest("POST", "/api/kyc/paystack/resolve-bvn", {
        bvn: bvnNumber,
        accountNumber: accountNumber || undefined,
        bankCode: selectedBank || undefined,
        firstName: formData.firstName,
        lastName: formData.lastName,
      });
      
      const data = await res.json();
      
      if (data.success && data.verified) {
        setBvnVerified(true);
        toast({
          title: "BVN Verified",
          description: "Your Bank Verification Number has been verified successfully!",
        });
        
        // Auto-fill verified data
        if (data.data) {
          setFormData(prev => ({
            ...prev,
            firstName: data.data.firstName || prev.firstName,
            lastName: data.data.lastName || prev.lastName,
            dateOfBirth: data.data.dateOfBirth || prev.dateOfBirth,
            phoneNumber: data.data.mobile || prev.phoneNumber,
          }));
        }
      } else {
        toast({
          title: "Verification Failed",
          description: data.error || "BVN verification failed. Please check your details.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Verification Error",
        description: error.message || "Failed to verify BVN",
        variant: "destructive",
      });
    } finally {
      setBvnVerifying(false);
    }
  };

  // Validate bank account
  const handleValidateAccount = async () => {
    if (!accountNumber || !selectedBank) {
      toast({ 
        title: "Missing Info", 
        description: "Please enter account number and select a bank", 
        variant: "destructive" 
      });
      return;
    }
    
    try {
      const res = await apiRequest("POST", "/api/kyc/paystack/validate-account", {
        accountNumber,
        bankCode: selectedBank,
      });
      
      const data = await res.json();
      
      if (data.success) {
        toast({
          title: "Account Verified",
          description: `Account name: ${data.accountName}`,
        });
      } else {
        toast({
          title: "Validation Failed",
          description: data.error || "Could not validate account",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to validate account",
        variant: "destructive",
      });
    }
  };

  const updateField = (field: keyof FormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return true;
      case 2:
        return !!(formData.firstName && formData.lastName && formData.dateOfBirth && formData.nationality && formData.phoneNumber);
      case 3:
        return !!(formData.addressLine1 && formData.city && formData.state && formData.country && formData.postalCode);
      case 4:
        // ID type and number are required for all users
        const hasIdDetails = !!(formData.idType && formData.idNumber);
        if (!hasIdDetails) return false;
        
        // Check if user's country supports Paystack or Stripe
        const isPaystackCountry = PAYSTACK_COUNTRIES.includes(formData.country);
        const isStripeCountry = STRIPE_COUNTRIES.includes(formData.country);
        
        // For Paystack countries (Africa), require BVN verification OR documents
        if (isPaystackCountry) {
          return bvnVerified || !!(formData.idFrontUrl && formData.selfieUrl);
        }
        
        // For Stripe countries (US/Europe), require Stripe verification OR documents
        if (isStripeCountry) {
          return stripeVerificationStatus === 'verified' || !!(formData.idFrontUrl && formData.selfieUrl);
        }
        
        // For other countries, require document uploads
        return !!(formData.idFrontUrl && formData.selfieUrl);
      case 5:
        return formData.acceptTerms;
      default:
        return false;
    }
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 5));
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

  const handleSubmit = () => {
    if (!validateStep(5)) {
      toast({
        title: "Terms Required",
        description: "Please accept the terms and conditions to continue.",
        variant: "destructive",
      });
      return;
    }
    submitKycMutation.mutate(formData);
  };

  if (profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          <p className="text-muted-foreground">Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (userProfile?.onboardingCompleted) {
    setLocation("/dashboard");
    return null;
  }

  const progress = (currentStep / 5) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white dark:from-slate-900 dark:to-slate-800">
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 mb-4">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-onboarding-title">
            Complete Your Profile
          </h1>
          <p className="text-muted-foreground mt-2">
            Verify your identity to unlock all features and higher transaction limits
          </p>
        </div>

        <div className="mb-8">
          <div className="flex justify-between mb-2">
            {STEPS.map((step) => (
              <div 
                key={step.id}
                className={`flex flex-col items-center ${currentStep >= step.id ? 'text-indigo-600' : 'text-muted-foreground'}`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${
                  currentStep > step.id 
                    ? 'bg-indigo-600 text-white' 
                    : currentStep === step.id 
                    ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-600 border-2 border-indigo-600' 
                    : 'bg-slate-100 dark:bg-slate-700'
                }`}>
                  {currentStep > step.id ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <step.icon className="h-5 w-5" />
                  )}
                </div>
                <span className="text-xs font-medium hidden sm:block">{step.title}</span>
              </div>
            ))}
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {(() => {
                const StepIcon = STEPS[currentStep - 1].icon;
                return <StepIcon className="h-5 w-5" />;
              })()}
              {STEPS[currentStep - 1].title}
            </CardTitle>
            <CardDescription>{STEPS[currentStep - 1].description}</CardDescription>
          </CardHeader>
          <CardContent>
            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card 
                    className={`cursor-pointer transition-all hover-elevate ${!formData.isBusinessAccount ? 'ring-2 ring-indigo-600' : ''}`}
                    onClick={() => updateField('isBusinessAccount', false)}
                    data-testid="card-personal-account"
                  >
                    <CardContent className="p-6 text-center">
                      <User className="h-12 w-12 mx-auto mb-4 text-indigo-600" />
                      <h3 className="font-semibold text-lg">Personal Account</h3>
                      <p className="text-sm text-muted-foreground mt-2">
                        For individuals managing personal expenses
                      </p>
                      {!formData.isBusinessAccount && (
                        <Badge className="mt-4 bg-indigo-600">Selected</Badge>
                      )}
                    </CardContent>
                  </Card>
                  <Card 
                    className={`cursor-pointer transition-all hover-elevate ${formData.isBusinessAccount ? 'ring-2 ring-indigo-600' : ''}`}
                    onClick={() => updateField('isBusinessAccount', true)}
                    data-testid="card-business-account"
                  >
                    <CardContent className="p-6 text-center">
                      <Building2 className="h-12 w-12 mx-auto mb-4 text-indigo-600" />
                      <h3 className="font-semibold text-lg">Business Account</h3>
                      <p className="text-sm text-muted-foreground mt-2">
                        For companies and teams managing expenses
                      </p>
                      {formData.isBusinessAccount && (
                        <Badge className="mt-4 bg-indigo-600">Selected</Badge>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {formData.isBusinessAccount && (
                  <div className="space-y-4 pt-6 border-t">
                    <h4 className="font-medium">Business Information</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="businessName">Business Name *</Label>
                        <Input
                          id="businessName"
                          value={formData.businessName}
                          onChange={(e) => updateField('businessName', e.target.value)}
                          placeholder="Your company name"
                          data-testid="input-business-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="businessType">Business Type *</Label>
                        <Select value={formData.businessType} onValueChange={(v) => updateField('businessType', v)}>
                          <SelectTrigger data-testid="select-business-type">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            {BUSINESS_TYPES.map(type => (
                              <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="businessRegNumber">Registration Number</Label>
                        <Input
                          id="businessRegNumber"
                          value={formData.businessRegistrationNumber}
                          onChange={(e) => updateField('businessRegistrationNumber', e.target.value)}
                          placeholder="Company registration number"
                          data-testid="input-business-reg"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="businessAddress">Business Address</Label>
                        <Input
                          id="businessAddress"
                          value={formData.businessAddress}
                          onChange={(e) => updateField('businessAddress', e.target.value)}
                          placeholder="Business address"
                          data-testid="input-business-address"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input
                      id="firstName"
                      value={formData.firstName}
                      onChange={(e) => updateField('firstName', e.target.value)}
                      placeholder="John"
                      data-testid="input-first-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="middleName">Middle Name</Label>
                    <Input
                      id="middleName"
                      value={formData.middleName}
                      onChange={(e) => updateField('middleName', e.target.value)}
                      placeholder="(Optional)"
                      data-testid="input-middle-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) => updateField('lastName', e.target.value)}
                      placeholder="Doe"
                      data-testid="input-last-name"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dateOfBirth">Date of Birth *</Label>
                    <Input
                      id="dateOfBirth"
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={(e) => updateField('dateOfBirth', e.target.value)}
                      data-testid="input-dob"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gender">Gender</Label>
                    <Select value={formData.gender} onValueChange={(v) => updateField('gender', v)}>
                      <SelectTrigger data-testid="select-gender">
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                        <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nationality">Nationality *</Label>
                    <Select value={formData.nationality} onValueChange={(v) => updateField('nationality', v)}>
                      <SelectTrigger data-testid="select-nationality">
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map(country => (
                          <SelectItem key={country.code} value={country.code}>{country.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phoneNumber">Phone Number *</Label>
                    <Input
                      id="phoneNumber"
                      type="tel"
                      value={formData.phoneNumber}
                      onChange={(e) => updateField('phoneNumber', e.target.value)}
                      placeholder="+1 (555) 123-4567"
                      data-testid="input-phone"
                    />
                  </div>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="addressLine1">Address Line 1 *</Label>
                  <Input
                    id="addressLine1"
                    value={formData.addressLine1}
                    onChange={(e) => updateField('addressLine1', e.target.value)}
                    placeholder="Street address"
                    data-testid="input-address1"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="addressLine2">Address Line 2</Label>
                  <Input
                    id="addressLine2"
                    value={formData.addressLine2}
                    onChange={(e) => updateField('addressLine2', e.target.value)}
                    placeholder="Apartment, suite, unit, etc. (optional)"
                    data-testid="input-address2"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City *</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => updateField('city', e.target.value)}
                      placeholder="City"
                      data-testid="input-city"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State/Province *</Label>
                    <Input
                      id="state"
                      value={formData.state}
                      onChange={(e) => updateField('state', e.target.value)}
                      placeholder="State or Province"
                      data-testid="input-state"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="country">Country *</Label>
                    <Select value={formData.country} onValueChange={(v) => updateField('country', v)}>
                      <SelectTrigger data-testid="select-country">
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map(country => (
                          <SelectItem key={country.code} value={country.code}>{country.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="postalCode">Postal Code *</Label>
                    <Input
                      id="postalCode"
                      value={formData.postalCode}
                      onChange={(e) => updateField('postalCode', e.target.value)}
                      placeholder="Postal code"
                      data-testid="input-postal"
                    />
                  </div>
                </div>
              </div>
            )}

            {currentStep === 4 && (
              <div className="space-y-6">
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    Verify your identity to unlock all features. Choose a verification method based on your region.
                  </p>
                </div>

                {/* Verification Method Selection */}
                <div className="space-y-4">
                  <h4 className="font-medium flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-indigo-600" />
                    Choose Verification Method
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Stripe Identity - US/Europe */}
                    {STRIPE_COUNTRIES.includes(formData.country) && (
                      <Card 
                        className={`cursor-pointer hover-elevate ${verificationMethod === 'stripe' ? 'border-indigo-500 ring-2 ring-indigo-200' : ''}`}
                        onClick={() => setVerificationMethod('stripe')}
                        data-testid="card-stripe-verification"
                      >
                        <CardContent className="p-4 text-center">
                          <CreditCard className="h-8 w-8 mx-auto mb-2 text-indigo-600" />
                          <h5 className="font-medium">Stripe Identity</h5>
                          <p className="text-xs text-muted-foreground mt-1">
                            Secure ID & selfie verification
                          </p>
                          {stripeVerificationStatus === 'verified' && (
                            <Badge className="mt-2 bg-green-600">Verified</Badge>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {/* Paystack BVN - Africa */}
                    {PAYSTACK_COUNTRIES.includes(formData.country) && (
                      <Card 
                        className={`cursor-pointer hover-elevate ${verificationMethod === 'paystack' ? 'border-indigo-500 ring-2 ring-indigo-200' : ''}`}
                        onClick={() => setVerificationMethod('paystack')}
                        data-testid="card-paystack-verification"
                      >
                        <CardContent className="p-4 text-center">
                          <Landmark className="h-8 w-8 mx-auto mb-2 text-green-600" />
                          <h5 className="font-medium">BVN Verification</h5>
                          <p className="text-xs text-muted-foreground mt-1">
                            Bank Verification Number
                          </p>
                          {bvnVerified && (
                            <Badge className="mt-2 bg-green-600">Verified</Badge>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {/* Manual Upload - All regions */}
                    <Card 
                      className={`cursor-pointer hover-elevate ${verificationMethod === 'manual' ? 'border-indigo-500 ring-2 ring-indigo-200' : ''}`}
                      onClick={() => setVerificationMethod('manual')}
                      data-testid="card-manual-verification"
                    >
                      <CardContent className="p-4 text-center">
                        <Upload className="h-8 w-8 mx-auto mb-2 text-slate-600" />
                        <h5 className="font-medium">Manual Upload</h5>
                        <p className="text-xs text-muted-foreground mt-1">
                          Upload ID documents
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Stripe Identity Section */}
                {verificationMethod === 'stripe' && (
                  <div className="space-y-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Stripe Identity Verification</h4>
                        <p className="text-sm text-muted-foreground">
                          Verify your identity with a government-issued ID and selfie
                        </p>
                      </div>
                      {stripeVerificationStatus && (
                        <Badge variant={stripeVerificationStatus === 'verified' ? 'default' : 'secondary'}>
                          {stripeVerificationStatus}
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      <Button 
                        onClick={handleStripeVerification}
                        className="flex items-center gap-2"
                        data-testid="button-start-stripe-verification"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Start Verification
                      </Button>
                      
                      {stripeSessionId && (
                        <Button 
                          variant="outline" 
                          onClick={checkStripeStatus}
                          data-testid="button-check-stripe-status"
                        >
                          Check Status
                        </Button>
                      )}
                    </div>
                    
                    {stripeVerificationUrl && (
                      <p className="text-xs text-muted-foreground">
                        A new window has opened for verification. Complete the process and return here.
                      </p>
                    )}
                  </div>
                )}

                {/* Paystack BVN Section */}
                {verificationMethod === 'paystack' && (
                  <div className="space-y-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <div>
                      <h4 className="font-medium">Bank Verification Number (BVN)</h4>
                      <p className="text-sm text-muted-foreground">
                        Enter your 11-digit BVN for instant verification
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="bvn">BVN Number *</Label>
                        <Input
                          id="bvn"
                          value={bvnNumber}
                          onChange={(e) => setBvnNumber(e.target.value.replace(/\D/g, '').slice(0, 11))}
                          placeholder="11-digit BVN"
                          maxLength={11}
                          data-testid="input-bvn"
                        />
                        <p className="text-xs text-muted-foreground">
                          {bvnNumber.length}/11 digits
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="bank">Bank (Optional)</Label>
                        <Select value={selectedBank} onValueChange={setSelectedBank}>
                          <SelectTrigger data-testid="select-bank">
                            <SelectValue placeholder="Select bank" />
                          </SelectTrigger>
                          <SelectContent>
                            {banks.map(bank => (
                              <SelectItem key={bank.code} value={bank.code}>{bank.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="accountNumber">Account Number (Optional)</Label>
                      <Input
                        id="accountNumber"
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        placeholder="10-digit account number"
                        maxLength={10}
                        data-testid="input-account-number"
                      />
                    </div>
                    
                    <div className="flex gap-2">
                      <Button 
                        onClick={handleBvnVerification}
                        disabled={bvnVerifying || bvnNumber.length !== 11}
                        className="flex items-center gap-2"
                        data-testid="button-verify-bvn"
                      >
                        {bvnVerifying ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ShieldCheck className="h-4 w-4" />
                        )}
                        Verify BVN
                      </Button>
                      
                      {selectedBank && accountNumber && (
                        <Button 
                          variant="outline" 
                          onClick={handleValidateAccount}
                          data-testid="button-validate-account"
                        >
                          Validate Account
                        </Button>
                      )}
                    </div>
                    
                    {bvnVerified && (
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle2 className="h-5 w-5" />
                        <span className="font-medium">BVN verified successfully!</span>
                      </div>
                    )}
                  </div>
                )}

                {/* ID Type and Number - Required for all verification methods */}
                <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    <h4 className="font-medium">Government-Issued ID Details</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Please provide your official ID information. This is required for verification regardless of the method chosen above.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="idType">ID Type *</Label>
                      <Select value={formData.idType} onValueChange={(v) => updateField('idType', v)}>
                        <SelectTrigger data-testid="select-id-type">
                          <SelectValue placeholder="Select ID type" />
                        </SelectTrigger>
                        <SelectContent>
                          {ID_TYPES.map(type => (
                            <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="idNumber">ID Number *</Label>
                      <Input
                        id="idNumber"
                        value={formData.idNumber}
                        onChange={(e) => updateField('idNumber', e.target.value)}
                        placeholder="Enter ID number"
                        data-testid="input-id-number"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="idExpiryDate">ID Expiry Date (Optional)</Label>
                    <Input
                      id="idExpiryDate"
                      type="date"
                      value={formData.idExpiryDate}
                      onChange={(e) => updateField('idExpiryDate', e.target.value)}
                      data-testid="input-id-expiry"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium">Upload Documents {verificationMethod === 'manual' ? '(Required)' : '(Optional)'}</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>ID Front</Label>
                      <div className="border-2 border-dashed rounded-lg p-6 text-center hover-elevate cursor-pointer">
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          className="hidden"
                          id="idFront"
                          onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'idFrontUrl')}
                          data-testid="input-id-front"
                        />
                        <label htmlFor="idFront" className="cursor-pointer">
                          <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">
                            {formData.idFrontUrl ? "Uploaded" : "Click to upload"}
                          </p>
                        </label>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>ID Back</Label>
                      <div className="border-2 border-dashed rounded-lg p-6 text-center hover-elevate cursor-pointer">
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          className="hidden"
                          id="idBack"
                          onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'idBackUrl')}
                          data-testid="input-id-back"
                        />
                        <label htmlFor="idBack" className="cursor-pointer">
                          <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">
                            {formData.idBackUrl ? "Uploaded" : "Click to upload"}
                          </p>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Selfie with ID</Label>
                      <div className="border-2 border-dashed rounded-lg p-6 text-center hover-elevate cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          id="selfie"
                          onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'selfieUrl')}
                          data-testid="input-selfie"
                        />
                        <label htmlFor="selfie" className="cursor-pointer">
                          <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">
                            {formData.selfieUrl ? "Uploaded" : "Click to upload"}
                          </p>
                        </label>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Proof of Address</Label>
                      <div className="border-2 border-dashed rounded-lg p-6 text-center hover-elevate cursor-pointer">
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          className="hidden"
                          id="proofOfAddress"
                          onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'proofOfAddressUrl')}
                          data-testid="input-proof-address"
                        />
                        <label htmlFor="proofOfAddress" className="cursor-pointer">
                          <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">
                            {formData.proofOfAddressUrl ? "Uploaded" : "Click to upload"}
                          </p>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 5 && (
              <div className="space-y-6">
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-6 space-y-4">
                  <h4 className="font-semibold text-lg">Review Your Information</h4>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Full Name</p>
                      <p className="font-medium">{formData.firstName} {formData.middleName} {formData.lastName}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Date of Birth</p>
                      <p className="font-medium">{formData.dateOfBirth || "Not provided"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Phone Number</p>
                      <p className="font-medium">{formData.phoneNumber || "Not provided"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Nationality</p>
                      <p className="font-medium">{COUNTRIES.find(c => c.code === formData.nationality)?.name || "Not provided"}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Address</p>
                      <p className="font-medium">
                        {formData.addressLine1}{formData.addressLine2 && `, ${formData.addressLine2}`}, {formData.city}, {formData.state}, {formData.postalCode}, {COUNTRIES.find(c => c.code === formData.country)?.name}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">ID Type</p>
                      <p className="font-medium">{ID_TYPES.find(t => t.value === formData.idType)?.label || "Not provided"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">ID Number</p>
                      <p className="font-medium">{formData.idNumber || "Not provided"}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Verification Status</p>
                      <div className="flex items-center gap-2">
                        {bvnVerified && <Badge className="bg-green-600">BVN Verified</Badge>}
                        {stripeVerificationStatus === 'verified' && <Badge className="bg-green-600">Stripe Verified</Badge>}
                        {(formData.idFrontUrl || formData.idBackUrl) && <Badge variant="secondary">Documents Uploaded</Badge>}
                        {!bvnVerified && stripeVerificationStatus !== 'verified' && !formData.idFrontUrl && !formData.idBackUrl && (
                          <Badge variant="outline">ID Details Only</Badge>
                        )}
                      </div>
                    </div>
                    {formData.isBusinessAccount && (
                      <>
                        <div>
                          <p className="text-muted-foreground">Business Name</p>
                          <p className="font-medium">{formData.businessName || "Not provided"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Business Type</p>
                          <p className="font-medium">{BUSINESS_TYPES.find(t => t.value === formData.businessType)?.label || "Not provided"}</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <Checkbox 
                    id="acceptTerms" 
                    checked={formData.acceptTerms}
                    onCheckedChange={(checked) => updateField('acceptTerms', !!checked)}
                    data-testid="checkbox-terms"
                  />
                  <label htmlFor="acceptTerms" className="text-sm leading-none cursor-pointer">
                    I confirm that all information provided is accurate and I agree to the{" "}
                    <a href="/terms" target="_blank" className="text-indigo-600 hover:underline">Terms of Service</a>{" "}
                    and{" "}
                    <a href="/privacy" target="_blank" className="text-indigo-600 hover:underline">Privacy Policy</a>
                  </label>
                </div>
              </div>
            )}

            <div className="flex justify-between pt-6 mt-6 border-t">
              <Button
                variant="outline"
                onClick={prevStep}
                disabled={currentStep === 1}
                data-testid="button-prev-step"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>

              {currentStep < 5 ? (
                <Button 
                  onClick={nextStep} 
                  disabled={!validateStep(currentStep)}
                  data-testid="button-next-step"
                >
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button 
                  onClick={handleSubmit} 
                  disabled={submitKycMutation.isPending || isUploading}
                  data-testid="button-submit-kyc"
                >
                  {submitKycMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Submit Verification
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Need help? <a href="mailto:support@spendlymanager.com" className="text-indigo-600 hover:underline">Contact Support</a>
        </p>
      </div>
    </div>
  );
}
