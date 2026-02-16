import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Wallet, Mail, Lock, Eye, EyeOff, ArrowRight, Loader2, User, Building2, CheckCircle2 } from "lucide-react";

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

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.fullName || !formData.email || !formData.password) {
      toast({
        title: "Error",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match.",
        variant: "destructive"
      });
      return;
    }

    if (!agreedToTerms) {
      toast({
        title: "Error",
        description: "Please agree to the terms and conditions.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    
    try {
      await signup(formData.fullName, formData.email, formData.password);
      toast({
        title: "Account created!",
        description: "Welcome to Spendly. Let's get you set up."
      });
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
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };


  const benefits = [
    "Unlimited virtual cards",
    "Real-time expense tracking",
    "Team collaboration tools",
    "24/7 priority support",
    "Multi-currency support"
  ];

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-indigo-600 to-indigo-800 p-12 flex-col justify-between">
        <Link href="/">
          <div className="flex items-center gap-2 text-white cursor-pointer">
            <img src="/spendly-logo.png" alt="Spendly" className="h-10 w-10 rounded-xl" />
            <span className="font-bold text-2xl">Spendly</span>
          </div>
        </Link>
        <div className="text-white">
          <h1 className="text-4xl font-bold mb-4">Get started with Spendly</h1>
          <p className="text-xl text-white/80 mb-8">
            Join thousands of companies managing their finances with Spendly.
          </p>
          <ul className="space-y-4">
            {benefits.map((benefit, index) => (
              <li key={index} className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0" />
                <span className="text-white/90">{benefit}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex items-center gap-4 text-white/60 text-sm">
          <span>Bank-grade security</span>
          <span>•</span>
          <span>SOC 2 Compliant</span>
          <span>•</span>
          <span>GDPR Ready</span>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 bg-background overflow-auto">
        <div className="w-full max-w-md py-8">
          <Link href="/">
            <div className="lg:hidden flex items-center gap-2 justify-center mb-8 cursor-pointer">
              <img src="/spendly-logo.png" alt="Spendly" className="h-10 w-10 rounded-xl" />
              <span className="font-bold text-2xl">Spendly</span>
            </div>
          </Link>

          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl" data-testid="text-signup-title">Create your account</CardTitle>
              <CardDescription>
                Create your account to get started
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="John Doe"
                      value={formData.fullName}
                      onChange={(e) => handleInputChange("fullName", e.target.value)}
                      className="pl-10"
                      data-testid="input-fullname"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Work Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@company.com"
                      value={formData.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      className="pl-10"
                      data-testid="input-email"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name (Optional)</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="companyName"
                      type="text"
                      placeholder="Acme Inc."
                      value={formData.companyName}
                      onChange={(e) => handleInputChange("companyName", e.target.value)}
                      className="pl-10"
                      data-testid="input-company"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={(e) => handleInputChange("password", e.target.value)}
                      className="pl-10 pr-10"
                      data-testid="input-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={formData.confirmPassword}
                      onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                      className="pl-10"
                      data-testid="input-confirm-password"
                    />
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Checkbox
                    id="terms"
                    checked={agreedToTerms}
                    onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
                    data-testid="checkbox-terms"
                  />
                  <Label htmlFor="terms" className="text-sm text-muted-foreground leading-tight cursor-pointer">
                    I agree to the{" "}
                    <Link href="/terms"><span className="text-indigo-600 hover:text-indigo-700 underline">Terms of Service</span></Link>
                    {" "}and{" "}
                    <Link href="/privacy"><span className="text-indigo-600 hover:text-indigo-700 underline">Privacy Policy</span></Link>
                  </Label>
                </div>

                <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-submit-signup">
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    <>
                      Create account
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>

              <p className="text-center text-sm text-muted-foreground mt-6">
                Already have an account?{" "}
                <Link href={inviteToken ? `/login?invite=${inviteToken}` : "/login"}>
                  <span className="text-indigo-600 hover:text-indigo-700 font-medium cursor-pointer" data-testid="link-login">
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
