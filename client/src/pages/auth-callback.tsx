import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AuthCallback() {
  const [, setLocation] = useLocation();
  const { handleOAuthCallback } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const errorParam = params.get("error");
    const errorDescription = params.get("error_description");

    if (errorParam) {
      setError(errorDescription || errorParam);
      return;
    }

    if (!code) {
      setError("No authorization code received. Please try signing in again.");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const { isNewUser } = await handleOAuthCallback(code);
        if (!cancelled) {
          setLocation(isNewUser ? "/onboarding" : "/dashboard");
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error("OAuth callback error:", err);
          setError(err.message || "Authentication failed. Please try again.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 max-w-md text-center px-4">
          <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="h-7 w-7 text-destructive" />
          </div>
          <h2 className="text-lg font-semibold">Sign In Failed</h2>
          <p className="text-sm text-muted-foreground">{error}</p>
          <div className="flex gap-3 mt-2">
            <Button variant="outline" onClick={() => setLocation("/login")}>
              Back to Login
            </Button>
            <Button onClick={() => setLocation("/signup")}>
              Create Account
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex items-center justify-center bg-background texture-mesh">
      <div className="flex flex-col items-center gap-4 animate-scale-in">
        <div className="relative">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-[#6B2346] to-[#8B3A5E] flex items-center justify-center shadow-lg shadow-primary/25 animate-pulse-glow">
            <img src="/financiar-logo.png" alt="Financiar" className="h-12 w-12 rounded-lg" />
          </div>
          <div className="absolute -inset-2 bg-primary/10 rounded-3xl blur-xl" />
        </div>
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Completing sign in...
        </div>
      </div>
    </div>
  );
}
