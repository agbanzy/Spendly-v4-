import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Shield, Eye, EyeOff, ArrowRight, Loader2, Lock, Mail, Sparkles, Server, Database, Settings } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!username.trim()) {
      setErrorMessage("Please enter your username or email.");
      return;
    }

    if (!password) {
      setErrorMessage("Please enter your password.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await apiRequest("POST", "/api/admin/login", { username, password });
      const data = await res.json();

      if (data.success) {
        localStorage.setItem("adminUser", JSON.stringify(data.user));
        toast({
          title: "Login Successful",
          description: `Welcome back, ${data.user.name}!`,
        });
        setLocation("/admin");
      } else {
        throw new Error(data.error || "Login failed");
      }
    } catch (error: any) {
      setErrorMessage(error.message || "Invalid credentials. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const features = [
    { icon: Server, text: "System monitoring" },
    { icon: Database, text: "Database management" },
    { icon: Settings, text: "Platform configuration" },
    { icon: Shield, text: "Security controls" },
  ];

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900" />
        <div className="absolute inset-0 opacity-10 texture-grid" />

        <div className="absolute top-1/4 -left-20 w-80 h-80 bg-purple-500/15 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/4 -right-20 w-60 h-60 bg-indigo-400/10 rounded-full blur-3xl animate-float-slow" />

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
              Administrator access
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-white leading-tight tracking-tight">
              Admin<br />Portal
            </h1>
            <p className="text-lg text-white/70 max-w-md leading-relaxed">
              Access the Spendly admin dashboard to manage users, monitor transactions, and configure platform settings.
            </p>

            <div className="grid grid-cols-2 gap-4 pt-4">
              {features.map((item, i) => (
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
            <span>Restricted access</span>
            <span className="w-1 h-1 rounded-full bg-white/30" />
            <span>Activity logged</span>
            <span className="w-1 h-1 rounded-full bg-white/30" />
            <span>MFA protected</span>
          </div>
        </div>
      </div>

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
              <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/10 to-purple-500/10 border border-primary/15 flex items-center justify-center mb-3">
                <Shield className="w-7 h-7 text-primary" />
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight">Admin Portal</CardTitle>
              <CardDescription className="text-muted-foreground">
                Sign in to access the admin dashboard
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-sm font-medium">Username or Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="username"
                      type="text"
                      placeholder="admin@spendly.com"
                      value={username}
                      onChange={(e) => { setUsername(e.target.value); setErrorMessage(""); }}
                      className="pl-10 h-11 bg-muted/30 border-border/50 focus:bg-background transition-colors"
                      data-testid="input-admin-username"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setErrorMessage(""); }}
                      className="pl-10 pr-10 h-11 bg-muted/30 border-border/50 focus:bg-background transition-colors"
                      data-testid="input-admin-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      data-testid="button-toggle-password"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {errorMessage && (
                  <p className="text-sm text-destructive" data-testid="text-admin-error">{errorMessage}</p>
                )}

                <Button
                  type="submit"
                  className="w-full h-11 text-sm font-medium shadow-md shadow-primary/20 gap-2"
                  disabled={isLoading}
                  data-testid="button-admin-login"
                >
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
                <Link href="/login">
                  <span className="text-primary hover:text-primary/80 font-medium cursor-pointer transition-colors" data-testid="link-user-login">
                    Back to User Login
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
