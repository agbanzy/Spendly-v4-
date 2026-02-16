import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Mail, Lock, Eye, EyeOff, ArrowRight, Loader2, Sparkles } from "lucide-react";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean }>({});

  const searchParams = new URLSearchParams(window.location.search);
  const inviteToken = searchParams.get("invite");

  const validateField = (field: "email" | "password", value: string) => {
    if (field === "email") {
      if (!value.trim()) return "Email is required.";
      if (!emailRegex.test(value)) return "Please enter a valid email.";
    }
    if (field === "password") {
      if (!value) return "Password is required.";
      if (value.length < 6) return "Password must be at least 6 characters.";
    }
    return undefined;
  };

  const handleBlur = (field: "email" | "password") => {
    setTouched(prev => ({ ...prev, [field]: true }));
    const value = field === "email" ? email : password;
    setErrors(prev => ({ ...prev, [field]: validateField(field, value) }));
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
      let errorMessage = "Login failed. Please try again.";
      if (error?.code === "auth/user-not-found") {
        errorMessage = "No account found with this email.";
      } else if (error?.code === "auth/wrong-password") {
        errorMessage = "Incorrect password.";
      } else if (error?.code === "auth/invalid-credential") {
        errorMessage = "Invalid email or password.";
      } else if (error?.code === "auth/too-many-requests") {
        errorMessage = "Too many attempts. Please try again later.";
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

  return (
    <div className="min-h-screen flex">
      {/* Left panel — immersive brand area */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-violet-600 to-purple-700" />
        <div className="absolute inset-0 opacity-10 texture-grid" />

        {/* Floating orbs */}
        <div className="absolute top-1/4 -left-20 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/4 -right-20 w-60 h-60 bg-emerald-400/10 rounded-full blur-3xl animate-float-slow" />

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
      <div className="flex-1 flex items-center justify-center p-6 bg-background relative">
        <div className="absolute inset-0 texture-mesh opacity-50" />

        <div className="w-full max-w-md relative z-10">
          <Link href="/">
            <div className="lg:hidden flex items-center gap-2.5 justify-center mb-8 cursor-pointer">
              <img src="/spendly-logo.png" alt="Spendly" className="h-10 w-10 rounded-xl shadow-md" />
              <span className="font-bold text-2xl tracking-tight">Spendly</span>
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
