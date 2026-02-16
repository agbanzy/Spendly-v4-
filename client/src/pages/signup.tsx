import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Mail, Lock, Eye, EyeOff, ArrowRight, Loader2, User, Building2, CheckCircle2, Sparkles, Shield, Globe2, Zap } from "lucide-react";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type SignupField = "fullName" | "email" | "password" | "confirmPassword" | "terms";

export default function SignupPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { signup } = useAuth();

  const searchParams = new URLSearchParams(window.location.search);
  const inviteToken = searchParams.get("invite");

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    companyName: "",
    password: "",
    confirmPassword: ""
  });
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<SignupField, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<SignupField, boolean>>>({});

  const validateField = (field: SignupField, value?: string): string | undefined => {
    switch (field) {
      case "fullName":
        if (!(value || formData.fullName).trim()) return "Full name is required.";
        if ((value || formData.fullName).trim().length < 2) return "Name must be at least 2 characters.";
        return undefined;
      case "email":
        if (!(value || formData.email).trim()) return "Email is required.";
        if (!emailRegex.test(value || formData.email)) return "Please enter a valid email.";
        return undefined;
      case "password":
        if (!(value || formData.password)) return "Password is required.";
        if ((value || formData.password).length < 6) return "Password must be at least 6 characters.";
        return undefined;
      case "confirmPassword":
        if (!(value || formData.confirmPassword)) return "Please confirm your password.";
        if ((value || formData.confirmPassword) !== formData.password) return "Passwords do not match.";
        return undefined;
      case "terms":
        if (!agreedToTerms) return "You must agree to the terms.";
        return undefined;
    }
  };

  const handleBlur = (field: SignupField) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    setErrors(prev => ({ ...prev, [field]: validateField(field) }));
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (touched[field as SignupField]) {
      setErrors(prev => ({ ...prev, [field]: validateField(field as SignupField, value) }));
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    const allFields: SignupField[] = ["fullName", "email", "password", "confirmPassword", "terms"];
    const newErrors: Partial<Record<SignupField, string>> = {};
    allFields.forEach(f => { newErrors[f] = validateField(f); });
    setErrors(newErrors);
    setTouched({ fullName: true, email: true, password: true, confirmPassword: true, terms: true });

    if (Object.values(newErrors).some(Boolean)) return;

    setIsLoading(true);

    try {
      await signup(formData.fullName, formData.email, formData.password);
      toast({ title: "Account created!", description: "Welcome to Spendly. Let's get you set up." });
      if (inviteToken) {
        setLocation(`/invite/${inviteToken}`);
      } else {
        setLocation("/onboarding");
      }
    } catch (error: any) {
      let errorMessage = "Signup failed. Please try again.";
      if (error?.code === "auth/email-already-in-use") {
        errorMessage = "An account with this email already exists.";
      } else if (error?.code === "auth/weak-password") {
        errorMessage = "Password is too weak. Use at least 6 characters.";
      } else if (error?.code === "auth/invalid-email") {
        errorMessage = "Please enter a valid email address.";
      }
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const benefits = [
    { icon: Shield, text: "Bank-grade encryption" },
    { icon: Globe2, text: "50+ currencies supported" },
    { icon: Zap, text: "Instant virtual cards" },
    { icon: CheckCircle2, text: "24/7 priority support" },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-violet-600 to-purple-700" />
        <div className="absolute inset-0 opacity-10 texture-grid" />

        <div className="absolute top-1/3 -left-20 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/3 -right-20 w-60 h-60 bg-emerald-400/10 rounded-full blur-3xl animate-float-slow" />

        <div className="relative z-10 p-12 flex flex-col justify-between w-full">
          <Link href="/">
            <div className="flex items-center gap-3 text-white cursor-pointer group">
              <div className="relative">
                <img src="/spendly-logo.png" alt="Spendly" className="h-10 w-10 rounded-xl shadow-lg" />
                <div className="absolute -inset-1 bg-white/20 rounded-xl blur-sm opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <span className="font-bold text-2xl tracking-tight">Spendly</span>
            </div>
          </Link>

          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 text-white/80 text-sm">
              <Sparkles className="h-3.5 w-3.5" />
              Join 10,000+ teams worldwide
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-white leading-tight tracking-tight">
              Get started<br />with Spendly
            </h1>
            <p className="text-lg text-white/70 max-w-md leading-relaxed">
              Join thousands of companies managing their finances smarter with Spendly.
            </p>

            <div className="grid grid-cols-2 gap-4 pt-4">
              {benefits.map((item, i) => (
                <div key={i} className="flex items-center gap-3 text-white/80">
                  <div className="p-2 rounded-lg bg-white/10">
                    <item.icon className="h-4 w-4" />
                  </div>
                  <span className="text-sm">{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4 text-white/40 text-sm">
            <span>Free 14-day trial</span>
            <span className="w-1 h-1 rounded-full bg-white/30" />
            <span>No credit card required</span>
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background overflow-auto relative">
        <div className="absolute inset-0 texture-mesh opacity-50" />

        <div className="w-full max-w-md py-8 relative z-10">
          <Link href="/">
            <div className="lg:hidden flex items-center gap-2.5 justify-center mb-8 cursor-pointer">
              <img src="/spendly-logo.png" alt="Spendly" className="h-10 w-10 rounded-xl shadow-md" />
              <span className="font-bold text-2xl tracking-tight">Spendly</span>
            </div>
          </Link>

          <Card className="shadow-xl shadow-primary/5 border-border/50">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-2xl font-bold tracking-tight" data-testid="text-signup-title">Create your account</CardTitle>
              <CardDescription>Start managing your finances today</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-sm font-medium">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="fullName" type="text" placeholder="John Doe"
                      value={formData.fullName}
                      onChange={(e) => handleInputChange("fullName", e.target.value)}
                      className="pl-10 h-11 bg-muted/30 border-border/50 focus:bg-background transition-colors"
                      data-testid="input-fullname"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">Work Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email" type="email" placeholder="you@company.com"
                      value={formData.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      className="pl-10 h-11 bg-muted/30 border-border/50 focus:bg-background transition-colors"
                      data-testid="input-email"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="companyName" className="text-sm font-medium">Company Name <span className="text-muted-foreground font-normal">(Optional)</span></Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="companyName" type="text" placeholder="Acme Inc."
                      value={formData.companyName}
                      onChange={(e) => handleInputChange("companyName", e.target.value)}
                      className="pl-10 h-11 bg-muted/30 border-border/50 focus:bg-background transition-colors"
                      data-testid="input-company"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Min 6 chars"
                        value={formData.password}
                        onChange={(e) => handleInputChange("password", e.target.value)}
                        className="pl-10 pr-10 h-11 bg-muted/30 border-border/50 focus:bg-background transition-colors"
                        data-testid="input-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirm</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="confirmPassword"
                        type={showPassword ? "text" : "password"}
                        placeholder="Repeat"
                        value={formData.confirmPassword}
                        onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                        className="pl-10 h-11 bg-muted/30 border-border/50 focus:bg-background transition-colors"
                        data-testid="input-confirm-password"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2 pt-1">
                  <Checkbox
                    id="terms"
                    checked={agreedToTerms}
                    onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
                    className="mt-0.5"
                    data-testid="checkbox-terms"
                  />
                  <Label htmlFor="terms" className="text-sm text-muted-foreground leading-tight cursor-pointer">
                    I agree to the{" "}
                    <Link href="/terms"><span className="text-primary hover:text-primary/80 underline">Terms of Service</span></Link>
                    {" "}and{" "}
                    <Link href="/privacy"><span className="text-primary hover:text-primary/80 underline">Privacy Policy</span></Link>
                  </Label>
                </div>

                <Button type="submit" className="w-full h-11 text-sm font-medium shadow-md shadow-primary/20 gap-2" disabled={isLoading} data-testid="button-submit-signup">
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    <>
                      Create account
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>

              <p className="text-center text-sm text-muted-foreground mt-6">
                Already have an account?{" "}
                <Link href={inviteToken ? `/login?invite=${inviteToken}` : "/login"}>
                  <span className="text-primary hover:text-primary/80 font-medium cursor-pointer transition-colors" data-testid="link-login">
                    Sign in
                  </span>
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
