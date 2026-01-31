import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Wallet, Mail, ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function ForgotPasswordPage() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast({
        title: "Error",
        description: "Please enter your email address.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    
    try {
      await sendPasswordResetEmail(auth, email);
      setEmailSent(true);
      toast({
        title: "Email sent!",
        description: "Check your inbox for password reset instructions."
      });
    } catch (error: any) {
      let errorMessage = "Failed to send reset email. Please try again.";
      if (error?.code === "auth/user-not-found") {
        errorMessage = "No account found with this email address.";
      } else if (error?.code === "auth/invalid-email") {
        errorMessage = "Please enter a valid email address.";
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
          <div className="flex items-center gap-2 text-white cursor-pointer" data-testid="link-forgot-home-desktop">
            <img src="/spendly-logo.png" alt="Spendly" className="h-10 w-10 rounded-xl" />
            <span className="font-bold text-2xl">Spendly</span>
          </div>
        </Link>
        <div className="text-white">
          <h1 className="text-4xl font-bold mb-4">Reset your password</h1>
          <p className="text-xl text-white/80">
            Enter your email address and we'll send you instructions to reset your password.
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
            <div className="lg:hidden flex items-center gap-2 justify-center mb-8 cursor-pointer" data-testid="link-forgot-home-mobile">
              <img src="/spendly-logo.png" alt="Spendly" className="h-10 w-10 rounded-xl" />
              <span className="font-bold text-2xl">Spendly</span>
            </div>
          </Link>

          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl" data-testid="text-forgot-password-title">
                {emailSent ? "Check your email" : "Forgot password?"}
              </CardTitle>
              <CardDescription>
                {emailSent 
                  ? "We've sent you an email with instructions to reset your password."
                  : "No worries, we'll send you reset instructions."
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {emailSent ? (
                <div className="space-y-6">
                  <div className="flex justify-center">
                    <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                      <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                    </div>
                  </div>
                  <p className="text-center text-sm text-muted-foreground">
                    Didn't receive the email? Check your spam folder or{" "}
                    <button 
                      onClick={() => setEmailSent(false)}
                      className="text-indigo-600 hover:text-indigo-700 font-medium"
                    >
                      try again
                    </button>
                  </p>
                  <Link href="/login">
                    <Button variant="outline" className="w-full" data-testid="button-back-to-login">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back to login
                    </Button>
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
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
                        data-testid="input-forgot-password-email"
                      />
                    </div>
                  </div>

                  <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-reset-password">
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      "Reset password"
                    )}
                  </Button>

                  <Link href="/login">
                    <Button variant="ghost" className="w-full" data-testid="button-back-to-login">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back to login
                    </Button>
                  </Link>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
