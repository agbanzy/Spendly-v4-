import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import {
  SUPPORTED_COUNTRIES,
  getPrimaryIdForCountry,
  isPaystackRegion,
} from "@/lib/constants";
import {
  Loader2,
  Shield,
  User,
  MapPin,
  Fingerprint,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

interface KycFormData {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  nationality: string;
  phoneNumber: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  idType: string;
  idNumber: string;
  bvnNumber: string;
}

interface KycVerificationFormProps {
  userProfile?: any;
  onSuccess?: () => void;
  compact?: boolean;
}

const COUNTRIES = SUPPORTED_COUNTRIES.map((c) => ({
  code: c.code,
  name: c.name,
}));

export function KycVerificationForm({
  userProfile,
  onSuccess,
  compact = false,
}: KycVerificationFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<KycFormData>({
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    gender: "",
    nationality: "",
    phoneNumber: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    country: "",
    postalCode: "",
    idType: "",
    idNumber: "",
    bvnNumber: "",
  });

  const [bvnVerified, setBvnVerified] = useState(false);
  const [bvnVerifying, setBvnVerifying] = useState(false);

  // Pre-fill from user profile
  useEffect(() => {
    if (userProfile) {
      setFormData((prev) => ({
        ...prev,
        firstName: prev.firstName || userProfile.firstName || "",
        lastName: prev.lastName || userProfile.lastName || "",
        phoneNumber: prev.phoneNumber || userProfile.phoneNumber || "",
        country: prev.country || userProfile.country || "",
        nationality: prev.nationality || userProfile.country || "",
        dateOfBirth: prev.dateOfBirth || userProfile.dateOfBirth || "",
        city: prev.city || userProfile.city || "",
        state: prev.state || userProfile.state || "",
        postalCode: prev.postalCode || userProfile.postalCode || "",
        addressLine1: prev.addressLine1 || userProfile.address || "",
      }));
    }
  }, [userProfile]);

  // Auto-set ID type when country changes
  useEffect(() => {
    if (formData.country) {
      const primaryId = getPrimaryIdForCountry(formData.country);
      setFormData((prev) => ({
        ...prev,
        idType: primaryId.key,
        nationality: prev.nationality || formData.country,
      }));
    }
  }, [formData.country]);

  const updateField = (field: keyof KycFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const verifyBvn = async () => {
    if (!formData.bvnNumber || formData.bvnNumber.length !== 11) {
      toast({
        title: "Invalid BVN",
        description: "BVN must be 11 digits",
        variant: "destructive",
      });
      return;
    }
    setBvnVerifying(true);
    try {
      const res = await apiRequest("POST", "/api/kyc/paystack/resolve-bvn", {
        bvn: formData.bvnNumber,
        firstName: formData.firstName,
        lastName: formData.lastName,
      });
      const result = await res.json();
      if (result.verified || result.status) {
        setBvnVerified(true);
        toast({
          title: "BVN Verified",
          description: "Your identity has been confirmed",
        });
      } else {
        toast({
          title: "Verification Failed",
          description: "Could not verify BVN. You can still continue.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Verification Error",
        description: "Could not verify BVN right now. You can still continue.",
        variant: "destructive",
      });
    } finally {
      setBvnVerifying(false);
    }
  };

  const submitMutation = useMutation({
    mutationFn: async (data: KycFormData) => {
      const primaryId = getPrimaryIdForCountry(data.country);
      const res = await apiRequest("POST", "/api/kyc/submit", {
        cognitoSub: user?.id,
        email: user?.email,
        firstName: data.firstName,
        lastName: data.lastName,
        dateOfBirth: data.dateOfBirth,
        gender: data.gender || undefined,
        nationality: data.nationality,
        phoneNumber: data.phoneNumber,
        addressLine1: data.addressLine1,
        addressLine2: data.addressLine2 || undefined,
        city: data.city,
        state: data.state,
        country: data.country,
        postalCode: data.postalCode,
        idType: primaryId.key.toUpperCase(),
        idNumber: data.idNumber,
        bvnNumber: data.bvnNumber || undefined,
        isBusinessAccount: userProfile?.isBusinessAccount || false,
        businessName: userProfile?.businessName || undefined,
        businessType: userProfile?.businessType || undefined,
      });
      return res.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: ["/api/user-profile"],
      });
      toast({
        title: result.autoApproved
          ? "Identity Verified"
          : "Verification Submitted",
        description: result.autoApproved
          ? "Your identity has been automatically verified."
          : "Your verification is being reviewed. This usually takes 24-48 hours.",
      });
      onSuccess?.();
    },
    onError: (error: any) => {
      const msg =
        error.message?.replace(/^\d{3}:\s*/, "").replace(/\{.*\}/, "") ||
        "Failed to submit verification.";
      toast({
        title: "Verification Failed",
        description: msg,
        variant: "destructive",
      });
    },
  });

  const isValid =
    formData.firstName &&
    formData.lastName &&
    formData.dateOfBirth &&
    formData.nationality &&
    formData.phoneNumber &&
    formData.addressLine1 &&
    formData.city &&
    formData.state &&
    formData.country &&
    formData.postalCode &&
    formData.idNumber;

  const primaryId = formData.country
    ? getPrimaryIdForCountry(formData.country)
    : null;
  const showBvn =
    formData.country?.toUpperCase() === "NG" && primaryId?.key === "bvn";

  return (
    <div className="space-y-6">
      {/* Rejection notice */}
      {userProfile?.kycStatus === "rejected" && (
        <div className="p-4 border border-destructive/30 rounded-xl bg-destructive/5 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-sm text-destructive">
              Previous Verification Rejected
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Please review and correct your details below, then resubmit.
            </p>
          </div>
        </div>
      )}

      {/* Personal Information */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <User className="h-4 w-4" />
          Personal Information
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="kyc-firstName">
              First Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="kyc-firstName"
              value={formData.firstName}
              onChange={(e) => updateField("firstName", e.target.value)}
              placeholder="First name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kyc-lastName">
              Last Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="kyc-lastName"
              value={formData.lastName}
              onChange={(e) => updateField("lastName", e.target.value)}
              placeholder="Last name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kyc-dob">
              Date of Birth <span className="text-destructive">*</span>
            </Label>
            <Input
              id="kyc-dob"
              type="date"
              value={formData.dateOfBirth}
              onChange={(e) => updateField("dateOfBirth", e.target.value)}
              max={
                new Date(
                  new Date().getFullYear() - 18,
                  new Date().getMonth(),
                  new Date().getDate()
                )
                  .toISOString()
                  .split("T")[0]
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kyc-phone">
              Phone Number <span className="text-destructive">*</span>
            </Label>
            <Input
              id="kyc-phone"
              value={formData.phoneNumber}
              onChange={(e) => updateField("phoneNumber", e.target.value)}
              placeholder="+1234567890"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kyc-gender">Gender</Label>
            <Select
              value={formData.gender}
              onValueChange={(v) => updateField("gender", v)}
            >
              <SelectTrigger id="kyc-gender">
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
                <SelectItem value="prefer_not_to_say">
                  Prefer not to say
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="kyc-country">
              Country <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.country}
              onValueChange={(v) => updateField("country", v)}
            >
              <SelectTrigger id="kyc-country">
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Address */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <MapPin className="h-4 w-4" />
          Address
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="kyc-address">
              Address <span className="text-destructive">*</span>
            </Label>
            <Input
              id="kyc-address"
              value={formData.addressLine1}
              onChange={(e) => updateField("addressLine1", e.target.value)}
              placeholder="Street address"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kyc-city">
              City <span className="text-destructive">*</span>
            </Label>
            <Input
              id="kyc-city"
              value={formData.city}
              onChange={(e) => updateField("city", e.target.value)}
              placeholder="City"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kyc-state">
              State/Province <span className="text-destructive">*</span>
            </Label>
            <Input
              id="kyc-state"
              value={formData.state}
              onChange={(e) => updateField("state", e.target.value)}
              placeholder="State or province"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kyc-postal">
              Postal Code <span className="text-destructive">*</span>
            </Label>
            <Input
              id="kyc-postal"
              value={formData.postalCode}
              onChange={(e) => updateField("postalCode", e.target.value)}
              placeholder="Postal / ZIP code"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kyc-nationality">
              Nationality <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.nationality}
              onValueChange={(v) => updateField("nationality", v)}
            >
              <SelectTrigger id="kyc-nationality">
                <SelectValue placeholder="Select nationality" />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Identity Verification */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Fingerprint className="h-4 w-4" />
          Identity Verification
        </div>

        {formData.country ? (
          <div className="space-y-4">
            {/* BVN field for Nigeria */}
            {showBvn && (
              <div className="space-y-2">
                <Label htmlFor="kyc-bvn">
                  BVN (Bank Verification Number){" "}
                  <span className="text-destructive">*</span>
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="kyc-bvn"
                    value={formData.bvnNumber}
                    onChange={(e) => {
                      updateField("bvnNumber", e.target.value);
                      updateField("idNumber", e.target.value);
                      setBvnVerified(false);
                    }}
                    placeholder="22012345678"
                    maxLength={11}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant={bvnVerified ? "default" : "outline"}
                    onClick={verifyBvn}
                    disabled={
                      bvnVerifying ||
                      bvnVerified ||
                      formData.bvnNumber.length !== 11
                    }
                    className="shrink-0"
                  >
                    {bvnVerifying ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : bvnVerified ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-1" /> Verified
                      </>
                    ) : (
                      "Verify"
                    )}
                  </Button>
                </div>
                {bvnVerified && (
                  <p className="text-xs text-emerald-600">
                    BVN verified — your identity will be auto-approved.
                  </p>
                )}
              </div>
            )}

            {/* Generic ID field for non-Nigeria */}
            {!showBvn && primaryId && (
              <div className="space-y-2">
                <Label htmlFor="kyc-idNumber">
                  {primaryId.label}{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="kyc-idNumber"
                  value={formData.idNumber}
                  onChange={(e) => updateField("idNumber", e.target.value)}
                  placeholder={primaryId.placeholder}
                  maxLength={primaryId.maxLength}
                />
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Please select your country first to see the required identity
            document.
          </p>
        )}
      </div>

      {/* Submit */}
      <Button
        onClick={() => submitMutation.mutate(formData)}
        disabled={!isValid || submitMutation.isPending}
        className="w-full"
        size="lg"
      >
        {submitMutation.isPending ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Submitting Verification...
          </>
        ) : (
          <>
            <Shield className="h-4 w-4 mr-2" />
            {userProfile?.kycStatus === "rejected"
              ? "Resubmit Verification"
              : "Submit Verification"}
          </>
        )}
      </Button>
    </div>
  );
}
