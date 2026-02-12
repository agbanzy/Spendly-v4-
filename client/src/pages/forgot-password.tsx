import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Mail, ArrowLeft, Loader2, CheckCircle2, ShieldCheck, KeyRound, RefreshCw } from "lucide-react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
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

      await sendPasswordResetEmail(auth, email);

      setStep("sent");
      setCooldown(60);
      toast({
        title: "Reset email sent",
        description: "Check your inbox for password reset instructions."
      });
    } catch (error: any) {
      setStep("email");

      if (error?.status === 404) {
        try {
          const errData = await error.json?.();
          setErrorMessage(errData?.error || "No account found with this email address.");
        } catch {
          setErrorMessage("No account found with this email address. Please check the email or sign up for a new account.");
        }
      } else if (error?.code === "auth/user-not-found") {
        setErrorMessage("No account found with this email address.");
      } else if (error?.code === "auth/invalid-email") {
        setErrorMessage("Please enter a valid email address.");
      } else if (error?.code === "auth/too-many-requests") {
        setErrorMessage("Too many attempts. Please try again later.");
        setCooldown(120);
      } else {
        setErrorMessage("Something went wrong. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [email, cooldown, toast]);

  const handleResend = useCallback(async () => {
    if (cooldown > 0) return;
    setIsLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setCooldown(60);
      toast({
        title: "Email resent",
        description: "A new password reset email has been sent."
      });
    } catch (error: any) {
      if (error?.code === "auth/too-many-requests") {
        toast({ title: "Too many attempts", description: "Please wait before trying again.", variant: "destructive" });
        setCooldown(120);
      } else {
        toast({ title: "Failed to resend", description: "Please try again later.", variant: "destructive" });
      }
    } finally {
      setIsLoading(false);
    }
  }, [email, cooldown, toast]);

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-indigo-600 to-indigo-800 p-12 flex-col justify-between">
        <Link href="/">
          <div className="flex items-center gap-2 text-white cursor-pointer" data-testid="link-forgot-home-desktop">
            <img src="/spendly-logo.png" alt="Spendly" className="h-10 w-10 rounded-md" />
            <span className="font-bold text-2xl">Spendly</span>
          </div>
        </Link>
        <div className="text-white">
          <h1 className="text-4xl font-bold mb-4">Reset your password</h1>
          <p className="text-xl text-white/80 mb-8">
            We'll verify your account in our system and send you a secure link to create a new password.
          </p>
          <ul className="space-y-4">
            <li className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-emerald-400 flex-shrink-0" />
              <span className="text-white/90">Account verified against our database</span>
            </li>
            <li className="flex items-center gap-3">
              <KeyRound className="h-5 w-5 text-emerald-400 flex-shrink-0" />
              <span className="text-white/90">Secure reset link sent to your email</span>
            </li>
            <li className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0" />
              <span className="text-white/90">Your data stays safe throughout</span>
            </li>
          </ul>
        </div>
        <div className="flex items-center gap-4 text-white/60 text-sm flex-wrap">
          <span>Bank-grade security</span>
          <span>·</span>
          <span>SOC 2 Compliant</span>
          <span>·</span>
          <span>GDPR Ready</span>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md">
          <Link href="/">
            <div className="lg:hidden flex items-center gap-2 justify-center mb-8 cursor-pointer" data-testid="link-forgot-home-mobile">
              <img src="/spendly-logo.png" alt="Spendly" className="h-10 w-10 rounded-md" />
              <span className="font-bold text-2xl">Spendly</span>
            </div>
          </Link>

          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl" data-testid="text-forgot-password-title">
                {step === "sent" ? "Check your email" : "Forgot password?"}
              </CardTitle>
              <CardDescription>
                {step === "sent"
                  ? `We've sent a reset link to ${email}`
                  : "Enter the email connected to your Spendly account and we'll verify it before sending reset instructions."
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {step === "sent" ? (
                <div className="space-y-6">
                  <div className="flex justify-center">
                    <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                      <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                    </div>
                  </div>

                  {userName && (
                    <p className="text-center text-sm text-muted-foreground" data-testid="text-reset-greeting">
                      Hi <span className="font-medium text-foreground">{userName}</span>, check your inbox for the reset link.
                    </p>
                  )}

                  <div className="rounded-md bg-muted/50 p-4 space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Didn't receive the email? Check your spam folder, or resend below.
                    </p>
                    <Button
                      variant="outline"
                      className="w-full"
                      disabled={cooldown > 0 || isLoading}
                      onClick={handleResend}
                      data-testid="button-resend-reset"
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
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
                    <Button variant="ghost" className="w-full" data-testid="button-back-to-login">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back to login
                    </Button>
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@company.com"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setErrorMessage(""); }}
                        className="pl-10"
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
                    className="w-full"
                    disabled={isLoading || cooldown > 0}
                    data-testid="button-reset-password"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {step === "sending" ? "Verifying account..." : "Sending..."}
                      </>
                    ) : cooldown > 0 ? (
                      `Try again in ${cooldown}s`
                    ) : (
                      "Reset password"
                    )}
                  </Button>

                  <Link href="/login">
                    <Button variant="ghost" className="w-full" data-testid="button-back-to-login-form">
                      <ArrowLeft className="mr-2 h-4 w-4" />
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
              <span className="text-indigo-600 hover:text-indigo-700 font-medium cursor-pointer" data-testid="link-signup-from-reset">
                Sign up
              </span>
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
