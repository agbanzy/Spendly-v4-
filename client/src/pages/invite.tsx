import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, getAuthHeaders } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Loader2, CheckCircle, XCircle, Building2, Shield, Clock } from "lucide-react";

interface InvitationInfo {
  email: string;
  role: string;
  department: string | null;
  companyName: string;
  companyLogo: string | null;
  invitedByName: string | null;
  expiresAt: string;
}

export default function InvitePage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/invite/:token");
  const token = params?.token || "";
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [accepted, setAccepted] = useState(false);

  const { data: invitation, isLoading, error } = useQuery<InvitationInfo>({
    queryKey: ["/api/invitations", token],
    queryFn: async () => {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`/api/invitations/${token}`, { headers: authHeaders, credentials: "include" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to load invitation");
      }
      return res.json();
    },
    enabled: !!token,
    retry: false,
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/invitations/${token}/accept`, {});
    },
    onSuccess: (data: any) => {
      setAccepted(true);
      toast({
        title: "Invitation accepted",
        description: `You have joined ${data.companyName || 'the company'} as ${data.role}`,
      });
      setTimeout(() => setLocation("/dashboard"), 2000);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to accept invitation",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    },
  });

  if (isLoading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" data-testid="invite-loading">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading invitation...</p>
        </div>
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Invalid Invitation</h2>
            <p className="text-muted-foreground mb-6" data-testid="text-invite-error">
              {(error as Error)?.message || "This invitation link is invalid or has expired."}
            </p>
            <Button onClick={() => setLocation("/login")} data-testid="button-go-login">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Welcome to {invitation.companyName}</h2>
            <p className="text-muted-foreground" data-testid="text-invite-accepted">
              Redirecting you to the dashboard...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const expiresIn = new Date(invitation.expiresAt).getTime() - Date.now();
  const daysLeft = Math.max(0, Math.ceil(expiresIn / (1000 * 60 * 60 * 24)));

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl" data-testid="text-company-name">
            Join {invitation.companyName}
          </CardTitle>
          <CardDescription>
            {invitation.invitedByName
              ? `${invitation.invitedByName} has invited you to join their team`
              : "You have been invited to join this team"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Role</span>
              <Badge variant="secondary" data-testid="badge-invite-role">
                <Shield className="h-3 w-3 mr-1" />
                {invitation.role}
              </Badge>
            </div>
            {invitation.department && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Department</span>
                <span className="text-sm font-medium" data-testid="text-invite-department">{invitation.department}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Invited as</span>
              <span className="text-sm font-medium" data-testid="text-invite-email">{invitation.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Expires</span>
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {daysLeft} day{daysLeft !== 1 ? 's' : ''} left
              </span>
            </div>
          </div>

          {!isAuthenticated ? (
            <div className="space-y-3">
              <p className="text-sm text-center text-muted-foreground">
                You need to sign in or create an account to accept this invitation.
              </p>
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={() => setLocation(`/login?invite=${token}`)}
                  data-testid="button-login-to-accept"
                >
                  Sign In
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setLocation(`/signup?invite=${token}`)}
                  data-testid="button-signup-to-accept"
                >
                  Create Account
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={() => acceptMutation.mutate()}
                disabled={acceptMutation.isPending}
                data-testid="button-accept-invite"
              >
                {acceptMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Accept Invitation
              </Button>
              <Button
                variant="outline"
                onClick={() => setLocation("/dashboard")}
                data-testid="button-decline-invite"
              >
                Decline
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
