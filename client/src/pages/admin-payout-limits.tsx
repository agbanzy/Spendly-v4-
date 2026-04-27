import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { pinProtectedRequest, getQueryFn } from "@/lib/queryClient";
import { ArrowLeft, ShieldCheck, Save, RotateCcw, Info } from "lucide-react";

// AUD-DB-007 follow-up — admin UI for the per-company daily payout
// limit override map. Backend lives in PR #30:
//   GET   /api/admin/payout-limits   → { companyId, overrides, note }
//   PATCH /api/admin/payout-limits   → { limits } (PIN-gated)
//
// Reference currencies are the same set the route gate's hardcoded
// floor knows about (server/routes/payouts.routes.ts:DAILY_PAYOUT_LIMITS).
// Sparse semantics: a currency without an override falls back to the
// floor; clearing an input means "remove the override, use the floor".

interface OverrideResponse {
  companyId: string;
  overrides: Record<string, number>;
  note: string;
}

// Same set the backend's hardcoded floor handles. Floor values shown
// inline so the operator knows the baseline they're overriding.
const REFERENCE_CURRENCIES: Array<{ code: string; floor: number; label: string }> = [
  { code: "USD", floor: 100000, label: "US Dollar" },
  { code: "EUR", floor: 90000, label: "Euro" },
  { code: "GBP", floor: 80000, label: "British Pound" },
  { code: "AUD", floor: 150000, label: "Australian Dollar" },
  { code: "CAD", floor: 130000, label: "Canadian Dollar" },
  { code: "NGN", floor: 100000000, label: "Nigerian Naira" },
  { code: "GHS", floor: 1000000, label: "Ghanaian Cedi" },
  { code: "ZAR", floor: 2000000, label: "South African Rand" },
  { code: "KES", floor: 10000000, label: "Kenyan Shilling" },
  { code: "EGP", floor: 4000000, label: "Egyptian Pound" },
  { code: "RWF", floor: 100000000, label: "Rwandan Franc" },
  { code: "XOF", floor: 60000000, label: "West African CFA" },
];

function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

export default function AdminPayoutLimitsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<OverrideResponse>({
    queryKey: ["/api/admin/payout-limits"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  // Local form state — keyed by currency. Empty string = use floor.
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);

  // Initialize the draft from the server payload on first load + on
  // reset clicks. Map server value → string for the input field.
  useEffect(() => {
    if (data?.overrides) {
      const next: Record<string, string> = {};
      for (const c of REFERENCE_CURRENCIES) {
        const v = data.overrides[c.code];
        next[c.code] = typeof v === "number" ? String(v) : "";
      }
      setDraft(next);
      setIsDirty(false);
    }
  }, [data?.overrides]);

  const saveMutation = useMutation({
    mutationFn: async (limits: Record<string, number>) => {
      const res = await pinProtectedRequest("PATCH", "/api/admin/payout-limits", { limits });
      return res.json() as Promise<OverrideResponse & { rejected: Array<{ currency: string; reason: string }> }>;
    },
    onSuccess: (resp) => {
      const rejected = resp.rejected || [];
      if (rejected.length > 0) {
        toast({
          title: "Saved with warnings",
          description: `${rejected.length} entr${rejected.length === 1 ? "y" : "ies"} were rejected: ${rejected.map((r) => `${r.currency} (${r.reason})`).join(", ")}`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Limits updated",
          description: "Per-currency daily payout limits have been saved for this company.",
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payout-limits"] });
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

  const handleChange = (currency: string, raw: string) => {
    // Allow empty (= clear override), digits, decimal points only.
    if (raw !== "" && !/^\d*\.?\d*$/.test(raw)) return;
    setDraft((prev) => ({ ...prev, [currency]: raw }));
    setIsDirty(true);
  };

  const handleClear = (currency: string) => {
    setDraft((prev) => ({ ...prev, [currency]: "" }));
    setIsDirty(true);
  };

  const handleSave = () => {
    const limits: Record<string, number> = {};
    const skipped: string[] = [];
    for (const c of REFERENCE_CURRENCIES) {
      const raw = draft[c.code]?.trim() ?? "";
      if (raw === "") continue;
      const n = parseFloat(raw);
      if (!Number.isFinite(n) || n <= 0) {
        skipped.push(c.code);
        continue;
      }
      limits[c.code] = n;
    }
    if (skipped.length > 0) {
      toast({
        title: "Some inputs rejected",
        description: `Invalid value for: ${skipped.join(", ")}. Each must be a positive number.`,
        variant: "destructive",
      });
      return;
    }
    saveMutation.mutate(limits);
  };

  const handleResetForm = () => {
    if (data?.overrides) {
      const next: Record<string, string> = {};
      for (const c of REFERENCE_CURRENCIES) {
        const v = data.overrides[c.code];
        next[c.code] = typeof v === "number" ? String(v) : "";
      }
      setDraft(next);
      setIsDirty(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <Skeleton className="h-8 w-64 mb-4" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
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
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <CardTitle data-testid="text-page-title">Daily payout limits</CardTitle>
              <CardDescription>
                Per-currency override for the daily payout cap on this company. Currencies left blank
                use the platform's hardcoded floor (shown next to each input).
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Info banner — explains the override semantics */}
          <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 border border-border/50">
            <Info className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
            <div className="text-sm text-muted-foreground space-y-1">
              <p>
                Overrides can <strong>raise</strong> the cap for higher-trust enterprise tenants or{" "}
                <strong>lower</strong> it for tenants under fraud investigation.
              </p>
              <p>Saving requires your transaction PIN. Each change is recorded in the audit log.</p>
            </div>
          </div>

          {/* Per-currency inputs */}
          <div className="space-y-4">
            {REFERENCE_CURRENCIES.map((c) => {
              const raw = draft[c.code] ?? "";
              const hasOverride = raw !== "";
              const numericValue = parseFloat(raw);
              const isValid = !hasOverride || (Number.isFinite(numericValue) && numericValue > 0);
              return (
                <div
                  key={c.code}
                  className="grid grid-cols-1 md:grid-cols-[100px_1fr_auto] gap-3 items-center"
                  data-testid={`row-limit-${c.code}`}
                >
                  <div className="flex flex-col">
                    <Label className="font-mono text-sm font-semibold">{c.code}</Label>
                    <span className="text-xs text-muted-foreground">{c.label}</span>
                  </div>

                  <div className="flex flex-col gap-1">
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder={`Floor: ${formatNumber(c.floor)} (no override)`}
                      value={raw}
                      onChange={(e) => handleChange(c.code, e.target.value)}
                      className={!isValid ? "border-destructive" : ""}
                      data-testid={`input-limit-${c.code}`}
                    />
                    {hasOverride && isValid && (
                      <span className="text-xs text-muted-foreground">
                        Floor would be {formatNumber(c.floor)} {c.code}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 justify-end">
                    {hasOverride ? (
                      <Badge variant="default" data-testid={`badge-override-${c.code}`}>
                        Override
                      </Badge>
                    ) : (
                      <Badge variant="outline" data-testid={`badge-floor-${c.code}`}>
                        Floor
                      </Badge>
                    )}
                    {hasOverride && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleClear(c.code)}
                        data-testid={`button-clear-${c.code}`}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <Separator />

          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">{data?.note}</p>
            <div className="flex gap-2 flex-shrink-0">
              <Button
                variant="outline"
                onClick={handleResetForm}
                disabled={!isDirty || saveMutation.isPending}
                data-testid="button-reset-form"
              >
                Reset
              </Button>
              <Button
                onClick={handleSave}
                disabled={!isDirty || saveMutation.isPending}
                className="gap-2"
                data-testid="button-save-limits"
              >
                <Save className="h-4 w-4" />
                {saveMutation.isPending ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
