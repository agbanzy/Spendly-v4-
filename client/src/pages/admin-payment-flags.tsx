import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { pinProtectedRequest, getQueryFn } from "@/lib/queryClient";
import { ArrowLeft, ShieldAlert, Save, Info } from "lucide-react";

// AUD-PR-010 / AUD-DB-010 Phase 1 — admin UI for the per-company
// payout-flags map. Backend lives in admin.routes.ts:
//   GET   /api/admin/payout-flags
//   PATCH /api/admin/payout-flags  (PIN-gated)
//
// Currently the only known flag is `useStripeConnect`. The Phase 1
// scaffolding (PR #36) wires the gate but defaults the flag to false
// for every tenant. This page is what Godwin uses to flip the flag
// for the pilot tenant — see STRIPE_CONNECT_MIGRATION_PLAN.md.

interface FlagsResponse {
  companyId: string;
  flags: Record<string, boolean>;
  knownFlags: string[];
  note: string;
}

interface FlagDescriptor {
  key: string;
  title: string;
  shortDescription: string;
  warning?: string;
}

const FLAG_DESCRIPTORS: FlagDescriptor[] = [
  {
    key: "useStripeConnect",
    title: "Use Stripe Connect Express",
    shortDescription:
      "Routes Stripe payouts through Express connected accounts (acct_*) instead of the legacy bank-token path. Requires recipients to complete Stripe-hosted onboarding first.",
    warning:
      "Activate only after at least one recipient has completed Express onboarding (visible as `verified` status on the destination row). Otherwise payouts will fail with `no destination` until onboarding finishes.",
  },
];

export default function AdminPaymentFlagsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<FlagsResponse>({
    queryKey: ["/api/admin/payout-flags"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  // Local form state — sparse map. Only keys the user has touched.
  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (data?.flags) {
      const next: Record<string, boolean> = {};
      for (const f of FLAG_DESCRIPTORS) {
        next[f.key] = data.flags[f.key] === true;
      }
      setDraft(next);
      setIsDirty(false);
    }
  }, [data?.flags]);

  const saveMutation = useMutation({
    mutationFn: async (flags: Record<string, boolean>) => {
      const res = await pinProtectedRequest("PATCH", "/api/admin/payout-flags", { flags });
      return res.json() as Promise<{
        companyId: string;
        flags: Record<string, boolean>;
        rejected: Array<{ flag: string; reason: string }>;
      }>;
    },
    onSuccess: (resp) => {
      const rejected = resp.rejected || [];
      if (rejected.length > 0) {
        toast({
          title: "Saved with warnings",
          description: `${rejected.length} flag${rejected.length === 1 ? "" : "s"} rejected: ${rejected.map((r) => `${r.flag} (${r.reason})`).join(", ")}`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Payment flags updated",
          description: "Flag changes are recorded in the audit log.",
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payout-flags"] });
      setIsDirty(false);
    },
    onError: (err: any) => {
      toast({
        title: "Failed to save",
        description: err.message || "Please try again. PIN may be required.",
        variant: "destructive",
      });
    },
  });

  const handleToggle = (key: string, value: boolean) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const handleSave = () => {
    saveMutation.mutate(draft);
  };

  const handleReset = () => {
    if (data?.flags) {
      const next: Record<string, boolean> = {};
      for (const f of FLAG_DESCRIPTORS) {
        next[f.key] = data.flags[f.key] === true;
      }
      setDraft(next);
      setIsDirty(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 max-w-3xl">
        <Skeleton className="h-8 w-64 mb-4" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-3xl">
      <Link href="/admin">
        <Button variant="ghost" size="sm" className="mb-4 gap-2" data-testid="button-back-to-admin">
          <ArrowLeft className="h-4 w-4" />
          Back to admin
        </Button>
      </Link>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <ShieldAlert className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <CardTitle data-testid="text-page-title">Payment-flow flags</CardTitle>
              <CardDescription>
                Per-tenant feature flags that gate payment-flow migrations. Each flag is
                independent; toggling one does not affect the others.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 border border-border/50">
            <Info className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
            <div className="text-sm text-muted-foreground space-y-1">
              <p>
                Saving requires your transaction PIN. Each flag change is recorded in the audit
                log with the previous and new map.
              </p>
              <p>{data?.note}</p>
            </div>
          </div>

          <div className="space-y-4">
            {FLAG_DESCRIPTORS.map((f) => {
              const value = draft[f.key] === true;
              return (
                <div
                  key={f.key}
                  className="flex items-start gap-4 p-4 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors"
                  data-testid={`row-flag-${f.key}`}
                >
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Label
                        htmlFor={`switch-${f.key}`}
                        className="text-base font-semibold cursor-pointer"
                      >
                        {f.title}
                      </Label>
                      {value ? (
                        <Badge variant="default" data-testid={`badge-on-${f.key}`}>
                          ON
                        </Badge>
                      ) : (
                        <Badge variant="outline" data-testid={`badge-off-${f.key}`}>
                          OFF
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{f.shortDescription}</p>
                    {f.warning && value && (
                      <div className="flex items-start gap-2 p-2 rounded bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200">
                        <ShieldAlert className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                        <span>{f.warning}</span>
                      </div>
                    )}
                  </div>
                  <Switch
                    id={`switch-${f.key}`}
                    checked={value}
                    onCheckedChange={(v) => handleToggle(f.key, v)}
                    data-testid={`switch-${f.key}`}
                  />
                </div>
              );
            })}
          </div>

          <Separator />

          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={!isDirty || saveMutation.isPending}
              data-testid="button-reset-flags"
            >
              Reset
            </Button>
            <Button
              onClick={handleSave}
              disabled={!isDirty || saveMutation.isPending}
              className="gap-2"
              data-testid="button-save-flags"
            >
              <Save className="h-4 w-4" />
              {saveMutation.isPending ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
