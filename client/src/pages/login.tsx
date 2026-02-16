import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Wallet, Mail, Lock, Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const searchParams = new URLSearchParams(window.location.search);
  const inviteToken = searchParams.get("invite");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast({
        title: "Error",
        description: "Please enter your email and password.",
        variant: "destructive"
      });
      return;
    }

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
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-indigo-600 to-indigo-800 p-12 flex-col justify-between">
        <Link href="/">
          <div className="flex items-center gap-2 text-white cursor-pointer">
            <img src="/spendly-logo.png" alt="Spendly" className="h-10 w-10 rounded-xl" />
            <span className="font-bold text-2xl">Spendly</span>
          </div>
        </Link>
        <div className="text-white">
          <h1 className="text-4xl font-bold mb-4">Welcome back</h1>
          <p className="text-xl text-white/80">
            Log in to access your financial dashboard and manage your team's expenses.
          </p>
        </div>
        <div className="flex items-center gap-4 text-white/60 text-sm">
          <span>Bank-grade security</span>
          <span>•</span>
          <span>SOC 2 Compliant</span>
          <span>•</span>
          <span>GDPR Ready</span>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md">
          <Link href="/">
            <div className="lg:hidden flex items-center gap-2 justify-center mb-8 cursor-pointer">
              <img src="/spendly-logo.png" alt="Spendly" className="h-10 w-10 rounded-xl" />
              <span className="font-bold text-2xl">Spendly</span>
            </div>
          </Link>

          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl" data-testid="text-login-title">Sign in to your account</CardTitle>
              <CardDescription>
                Enter your credentials to access your dashboard
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      data-testid="input-email"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <Link href="/forgot-password">
                      <span className="text-sm text-indigo-600 hover:text-indigo-700 cursor-pointer" data-testid="link-forgot-password">
                        Forgot password?
                      </span>
                    </Link>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
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

                <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-submit-login">
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      Sign in
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>

              <p className="text-center text-sm text-muted-foreground mt-6">
                Don't have an account?{" "}
                <Link href={inviteToken ? `/signup?invite=${inviteToken}` : "/signup"}>
                  <span className="text-indigo-600 hover:text-indigo-700 font-medium cursor-pointer" data-testid="link-signup">
                    Sign up
                  </span>
                </Link>
              </p>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground mt-6">
            By signing in, you agree to our{" "}
            <Link href="/terms"><span className="underline hover:text-foreground cursor-pointer">Terms of Service</span></Link>
            {" "}and{" "}
            <Link href="/privacy"><span className="underline hover:text-foreground cursor-pointer">Privacy Policy</span></Link>
          </p>
        </div>
      </div>
    </div>
  );
}
