import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Mail, ArrowLeft, Loader2, CheckCircle2, ShieldCheck, KeyRound, RefreshCw, ArrowRight, Sparkles } from "lucide-react";
import { forgotPassword } from "@/lib/cognito";
import { apiRequest } from "@/lib/queryClient";

type ResetStep = "email" | "sending" | "sent";

export default function ForgotPasswordPage() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<ResetStep>("email");
  const [isLoading, setIsLoading] = useState(false);
  const [userName, setUserName] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!email) {
      setErrorMessage("Please enter your email address.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    if (cooldown > 0) return;

    setIsLoading(true);
    setStep("sending");

    try {
      const res = await apiRequest("POST", "/api/auth/request-password-reset", { email });
      const data = await res.json();
      setUserName(data.userName || "");

      await forgotPassword(email);

      setStep("sent");
      setCooldown(60);
      toast({
        title: "Reset code sent",
        description: "Check your inbox for the verification code to reset your password."
      });
    } catch (error: any) {
      setStep("email");

      const name = error?.name || '';
      if (error?.status === 404 || name === 'UserNotFoundException') {
        setErrorMessage("No account found with this email address.");
      } else if (name === 'InvalidParameterException') {
        setErrorMessage("Please enter a valid email address.");
      } else if (name === 'LimitExceededException' || name === 'TooManyRequestsException') {
        setErrorMessage("Too many attempts. Please try again later.");
        setCooldown(120);
      } else {
        setErrorMessage(error?.message || "Something went wrong. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [email, cooldown, toast]);

  const handleResend = useCallback(async () => {
    if (cooldown > 0) return;
    setIsLoading(true);
    try {
      await forgotPassword(email);
      setCooldown(60);
      toast({
        title: "Code resent",
        description: "A new verification code has been sent to your email."
      });
    } catch (error: any) {
      const name = error?.name || '';
      if (name === 'LimitExceededException' || name === 'TooManyRequestsException') {
        toast({ title: "Too many attempts", description: "Please wait before trying again.", variant: "destructive" });
        setCooldown(120);
      } else {
        toast({ title: "Failed to resend", description: error?.message || "Please try again later.", variant: "destructive" });
      }
    } finally {
      setIsLoading(false);
    }
  }, [email, cooldown, toast]);

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-sky-600 via-blue-600 to-cyan-600" />
        <div className="absolute inset-0 opacity-10 texture-grid" />

        <div className="absolute top-1/4 -left-20 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/4 -right-20 w-60 h-60 bg-emerald-400/10 rounded-full blur-3xl animate-float-slow" />

        <div className="relative z-10 p-12 flex flex-col justify-between w-full">
          <Link href="/">
            <div className="flex items-center gap-3 text-white cursor-pointer group">
              <div className="relative">
                <img src="/spendly-logo.png" alt="Spendly" className="h-12 w-12 rounded-xl shadow-lg" />
                <div className="absolute -inset-1 bg-white/20 rounded-xl blur-sm opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <span className="font-bold text-2xl tracking-tight">Spendly</span>
            </div>
          </Link>

          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 text-white/80 text-sm">
              <Sparkles className="h-3.5 w-3.5" />
              Secure account recovery
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold font-display text-white leading-tight tracking-tight">
              Reset your<br />password
            </h1>
            <p className="text-lg text-white/70 max-w-md leading-relaxed">
              We'll verify your account in our system and send you a secure link to create a new password.
            </p>

            <ul className="space-y-4 pt-2">
              <li className="flex items-center gap-3 text-white/80">
                <div className="p-2 rounded-lg bg-white/10">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <span className="text-sm">Account verified against our database</span>
              </li>
              <li className="flex items-center gap-3 text-white/80">
                <div className="p-2 rounded-lg bg-white/10">
                  <KeyRound className="h-4 w-4" />
                </div>
                <span className="text-sm">Secure reset link sent to your email</span>
              </li>
              <li className="flex items-center gap-3 text-white/80">
                <div className="p-2 rounded-lg bg-white/10">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <span className="text-sm">Your data stays safe throughout</span>
              </li>
            </ul>
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

      <div className="flex-1 flex items-center justify-center p-6 bg-background relative">
        <div className="absolute inset-0 texture-mesh opacity-50" />

        <div className="w-full max-w-md relative z-10">
          <Link href="/">
            <div className="lg:hidden flex items-center gap-2.5 justify-center mb-8 cursor-pointer">
              <img src="/spendly-logo.png" alt="Spendly" className="h-12 w-12 rounded-xl shadow-md" />
              <span className="font-bold text-2xl tracking-tight">Spendly</span>
            </div>
          </Link>

          <Card className="shadow-2xl shadow-primary/8 border-border/50">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-2xl font-bold tracking-tight" data-testid="text-forgot-password-title">
                {step === "sent" ? "Check your email" : "Forgot password?"}
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                {step === "sent"
                  ? `We've sent a reset link to ${email}`
                  : "Enter the email connected to your Spendly account and we'll verify it before sending reset instructions."
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              {step === "sent" ? (
                <div className="space-y-5">
                  <div className="flex justify-center">
                    <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                      <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                    </div>
                  </div>

                  {userName && (
                    <p className="text-center text-sm text-muted-foreground" data-testid="text-reset-greeting">
                      Hi <span className="font-medium text-foreground">{userName}</span>, check your inbox for the reset link.
                    </p>
                  )}

                  <div className="rounded-xl bg-muted/30 border border-border/50 p-4 space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Didn't receive the email? Check your spam folder, or resend below.
                    </p>
                    <Button
                      variant="outline"
                      className="w-full gap-2"
                      disabled={cooldown > 0 || isLoading}
                      onClick={handleResend}
                      data-testid="button-resend-reset"
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend reset email"}
                    </Button>
                  </div>

                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setStep("email");
                      setEmail("");
                      setUserName("");
                      setErrorMessage("");
                    }}
                    data-testid="button-try-different-email"
                  >
                    Try a different email
                  </Button>

                  <Link href="/login">
                    <Button variant="ghost" className="w-full gap-2" data-testid="button-back-to-login">
                      <ArrowLeft className="h-4 w-4" />
                      Back to login
                    </Button>
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium">Email address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@company.com"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setErrorMessage(""); }}
                        className="pl-10 h-11 bg-muted/30 border-border/50 focus:bg-background transition-colors"
                        disabled={step === "sending"}
                        data-testid="input-forgot-password-email"
                      />
                    </div>
                    {errorMessage && (
                      <p className="text-sm text-destructive" data-testid="text-reset-error">{errorMessage}</p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-12 text-sm font-medium shadow-md shadow-primary/20 gap-2"
                    disabled={isLoading || cooldown > 0}
                    data-testid="button-reset-password"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {step === "sending" ? "Verifying account..." : "Sending..."}
                      </>
                    ) : cooldown > 0 ? (
                      `Try again in ${cooldown}s`
                    ) : (
                      <>
                        Reset password
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>

                  <Link href="/login">
                    <Button variant="ghost" className="w-full gap-2" data-testid="button-back-to-login-form">
                      <ArrowLeft className="h-4 w-4" />
                      Back to login
                    </Button>
                  </Link>
                </form>
              )}
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground mt-6">
            Don't have an account?{" "}
            <Link href="/signup">
              <span className="text-primary hover:text-primary/80 font-medium cursor-pointer transition-colors" data-testid="link-signup-from-reset">
                Sign up
              </span>
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
