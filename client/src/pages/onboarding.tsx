import { useState, useCallback } from "react";
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
  ArrowRight, ArrowLeft, Shield, Globe, Loader2 
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

export default function Onboarding() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(1);
  const [isUploading, setIsUploading] = useState(false);
  
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
      const res = await apiRequest("POST", "/api/kyc", {
        firebaseUid: user?.id,
        ...data,
      });
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
      
      if (!res.ok) throw new Error("Upload failed");
      
      const { url } = await res.json();
      setFormData(prev => ({ ...prev, [fieldName]: url }));
      toast({
        title: "File Uploaded",
        description: "Document uploaded successfully",
      });
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: "Failed to upload document. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  }, [toast]);

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
        return !!(formData.idType && formData.idNumber);
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
                    Please provide a valid government-issued ID. Ensure all information is clearly visible.
                  </p>
                </div>

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
                  <Label htmlFor="idExpiryDate">ID Expiry Date</Label>
                  <Input
                    id="idExpiryDate"
                    type="date"
                    value={formData.idExpiryDate}
                    onChange={(e) => updateField('idExpiryDate', e.target.value)}
                    data-testid="input-id-expiry"
                  />
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium">Upload Documents (Optional)</h4>
                  
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
                <Button onClick={nextStep} data-testid="button-next-step">
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
          Need help? <a href="mailto:support@spendly.com" className="text-indigo-600 hover:underline">Contact Support</a>
        </p>
      </div>
    </div>
  );
}
