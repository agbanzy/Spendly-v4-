import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { PhoneInput } from "@/components/phone-input";
import { Mail, Lock, Eye, EyeOff, ArrowRight, Loader2, Sparkles, Phone, MessageSquare } from "lucide-react";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { login, loginWithToken } = useAuth();

  // Auth mode tab
  const [authMode, setAuthMode] = useState<"email" | "phone">("email");

  // Email login state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean }>({});

  // SMS login state
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [smsSession, setSmsSession] = useState<string | null>(null);
  const [phoneHint, setPhoneHint] = useState("");
  const [smsLoading, setSmsLoading] = useState(false);
  const [smsError, setSmsError] = useState("");

  const searchParams = new URLSearchParams(window.location.search);
  const inviteToken = searchParams.get("invite");

  const validateField = (field: "email" | "password", value: string) => {
    if (field === "email") {
      if (!value.trim()) return "Email is required.";
      if (!emailRegex.test(value)) return "Please enter a valid email.";
    }
    if (field === "password") {
      if (!value) return "Password is required.";
      if (value.length < 8) return "Password must be at least 8 characters.";
    }
    return undefined;
  };

  const handleBlur = (field: "email" | "password") => {
    setTouched(prev => ({ ...prev, [field]: true }));
    const value = field === "email" ? email : password;
    setErrors(prev => ({ ...prev, [field]: validateField(field, value) }));
  };

  const handleSmsInitiate = async () => {
    setSmsError("");
    if (!phoneNumber || !/^\+\d{7,15}$/.test(phoneNumber)) {
      setSmsError("Please enter a valid phone number");
      return;
    }
    setSmsLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/sms/initiate", { phoneNumber });
      const data = await res.json();
      setSmsSession(data.session);
      setPhoneHint(data.phoneHint || "");
      toast({ title: "Code sent!", description: `Verification code sent to ${data.phoneHint || phoneNumber}` });
    } catch (error: any) {
      setSmsError(error?.message || "Failed to send verification code");
    } finally {
      setSmsLoading(false);
    }
  };

  const handleSmsVerify = async () => {
    setSmsError("");
    if (!otp || !/^\d{6}$/.test(otp)) {
      setSmsError("Enter the 6-digit verification code");
      return;
    }
    setSmsLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/sms/verify", { phoneNumber, otp, session: smsSession });
      const data = await res.json();
      if (data.idToken) {
        await loginWithToken(data.idToken);
        toast({ title: "Welcome!", description: "Logged in via SMS successfully." });
        setLocation(inviteToken ? `/invite/${inviteToken}` : "/dashboard");
      }
    } catch (error: any) {
      setSmsError(error?.message || "Invalid verification code");
    } finally {
      setSmsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    const emailError = validateField("email", email);
    const passwordError = validateField("password", password);
    setErrors({ email: emailError, password: passwordError });
    setTouched({ email: true, password: true });

    if (emailError || passwordError) return;

    setIsLoading(true);

    try {
      await login(email, password);
      toast({
        title: "Welcome back!",
        description: "You have been logged in successfully."
      });
      if (inviteToken) {
        setLocation(`/invite/${inviteToken}`);
      } else {
        setLocation("/dashboard");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Login failed. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="min-h-screen flex">
      {/* Left panel — immersive brand area */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#6B2346] via-[#8B3A5E] to-[#4A1830]" />
        <div className="absolute inset-0 opacity-[0.03] texture-grid" />

        <div className="relative z-10 p-12 flex flex-col justify-between w-full">
          <Link href="/">
            <div className="flex items-center gap-3 text-white cursor-pointer group">
              <div className="relative">
                <img src="/financiar-logo.png" alt="Financiar" className="h-16 w-16 rounded-xl shadow-lg" />
                <div className="absolute -inset-1 bg-white/20 rounded-xl blur-sm opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <span className="font-bold text-2xl tracking-tight">Financiar</span>
            </div>
          </Link>

          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 text-white/80 text-sm">
              <Sparkles className="h-3.5 w-3.5" />
              Secure & trusted by 10,000+ teams
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-white leading-tight tracking-tight">
              Welcome<br />back
            </h1>
            <p className="text-lg text-white/70 max-w-md leading-relaxed">
              Access your financial dashboard and manage your team's expenses in real time.
            </p>
          </div>

          <div className="flex items-center gap-4 text-white/40 text-sm">
            <span>Bank-grade security</span>
            <span className="w-1 h-1 rounded-full bg-white/30" />
            <span>SOC 2 Compliant</span>
            <span className="w-1 h-1 rounded-full bg-white/30" />
            <span>GDPR Ready</span>
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background relative overflow-auto">
        <div className="absolute inset-0 texture-mesh opacity-50" />

        <div className="w-full max-w-md relative z-10">
          <Link href="/">
            <div className="lg:hidden flex items-center gap-2.5 justify-center mb-8 cursor-pointer">
              <img src="/financiar-logo.png" alt="Financiar" className="h-16 w-16 rounded-xl shadow-md" />
              <span className="font-bold text-2xl tracking-tight">Financiar</span>
            </div>
          </Link>

          <Card className="shadow-xl shadow-primary/5 border-border/50">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-2xl font-bold tracking-tight" data-testid="text-login-title">Sign in to your account</CardTitle>
              <CardDescription className="text-muted-foreground">
                Enter your credentials to access your dashboard
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              {/* Auth mode tabs */}
              <div className="flex gap-1 p-1 rounded-lg bg-muted/50 mb-5">
                <button
                  type="button"
                  onClick={() => setAuthMode("email")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${authMode === "email" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Mail className="h-4 w-4" />
                  Email
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode("phone")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${authMode === "phone" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Phone className="h-4 w-4" />
                  Phone
                </button>
              </div>

              {authMode === "phone" ? (
                <div className="space-y-5">
                  {!smsSession ? (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="phone" className="text-sm font-medium">Phone Number</Label>
                        <PhoneInput
                          id="phone"
                          value={phoneNumber}
                          onChange={(val) => { setPhoneNumber(val); setSmsError(""); }}
                          defaultCountry="NG"
                          placeholder="812 345 6789"
                          error={!!smsError}
                        />
                      </div>
                      {smsError && <p className="text-xs text-destructive">{smsError}</p>}
                      <Button type="button" onClick={handleSmsInitiate} className="w-full h-11 text-sm font-medium shadow-md shadow-primary/20 gap-2" disabled={smsLoading}>
                        {smsLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending code...</> : <><MessageSquare className="h-4 w-4" /> Send verification code</>}
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="text-center space-y-1 mb-2">
                        <p className="text-sm text-muted-foreground">Code sent to <span className="font-medium text-foreground">{phoneHint || phoneNumber}</span></p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="otp" className="text-sm font-medium">Verification Code</Label>
                        <Input
                          id="otp"
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          placeholder="000000"
                          value={otp}
                          onChange={(e) => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); setSmsError(""); }}
                          className="h-11 text-center text-lg tracking-[0.5em] font-mono bg-muted/30 border-border/50 focus:bg-background transition-colors"
                          autoFocus
                        />
                      </div>
                      {smsError && <p className="text-xs text-destructive">{smsError}</p>}
                      <Button type="button" onClick={handleSmsVerify} className="w-full h-11 text-sm font-medium shadow-md shadow-primary/20 gap-2" disabled={smsLoading}>
                        {smsLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Verifying...</> : <><ArrowRight className="h-4 w-4" /> Verify & Sign in</>}
                      </Button>
                      <button
                        type="button"
                        onClick={() => { setSmsSession(null); setOtp(""); setSmsError(""); }}
                        className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Use a different number
                      </button>
                    </>
                  )}
                </div>
              ) : (
              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); if (touched.email) setErrors(prev => ({ ...prev, email: validateField("email", e.target.value) })); }}
                      onBlur={() => handleBlur("email")}
                      className={`pl-10 h-11 bg-muted/30 border-border/50 focus:bg-background transition-colors ${touched.email && errors.email ? "border-destructive" : ""}`}
                      data-testid="input-email"
                    />
                  </div>
                  {touched.email && errors.email && <p className="text-xs text-destructive" data-testid="text-email-error">{errors.email}</p>}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                    <Link href="/forgot-password">
                      <span className="text-sm text-primary hover:text-primary/80 cursor-pointer transition-colors" data-testid="link-forgot-password">
                        Forgot password?
                      </span>
                    </Link>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); if (touched.password) setErrors(prev => ({ ...prev, password: validateField("password", e.target.value) })); }}
                      onBlur={() => handleBlur("password")}
                      className={`pl-10 pr-10 h-11 bg-muted/30 border-border/50 focus:bg-background transition-colors ${touched.password && errors.password ? "border-destructive" : ""}`}
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
                  {touched.password && errors.password && <p className="text-xs text-destructive" data-testid="text-password-error">{errors.password}</p>}
                </div>

                <Button type="submit" className="w-full h-11 text-sm font-medium shadow-md shadow-primary/20 gap-2" disabled={isLoading} data-testid="button-submit-login">
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      Sign in
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
              )}

              <p className="text-center text-sm text-muted-foreground mt-6">
                Don't have an account?{" "}
                <Link href={inviteToken ? `/signup?invite=${inviteToken}` : "/signup"}>
                  <span className="text-primary hover:text-primary/80 font-medium cursor-pointer transition-colors" data-testid="link-signup">
                    Sign up
                  </span>
                </Link>
              </p>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground mt-6">
            By signing in, you agree to our{" "}
            <Link href="/terms"><span className="underline hover:text-foreground cursor-pointer transition-colors">Terms of Service</span></Link>
            {" "}and{" "}
            <Link href="/privacy"><span className="underline hover:text-foreground cursor-pointer transition-colors">Privacy Policy</span></Link>
          </p>
        </div>
      </div>
    </div>
  );
}
