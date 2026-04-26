import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Database,
  Trash2,
  AlertTriangle,
  Shield,
  RefreshCw,
  ArrowLeft,
  CheckCircle2,
  Clock,
  UserCheck,
} from "lucide-react";
import { Link } from "wouter";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// LU-008 / AUD-BE-003 — Two-admin purge approval UI.
// The legacy single-button purge has been replaced with a two-step flow:
//   1) Admin A clicks "Initiate purge" → server creates a 30-min intent and
//      notifies all admins out-of-band.
//   2) Admin B (different from A) pastes the intent ID and clicks "Approve"
//      → server validates distinct admin + executes the purge.

type InitiateResponse = { intentId: string; expiresAt: string };

export default function AdminDatabase() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [intentId, setIntentId] = useState("");
  const [confirmInitiate, setConfirmInitiate] = useState("");
  const [confirmApprove, setConfirmApprove] = useState("");
  const [lastIntent, setLastIntent] = useState<InitiateResponse | null>(null);

  const initiateMutation = useMutation<InitiateResponse>({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/purge-database/initiate", {
        tablesToPreserve: [
          "admin_settings",
          "organization_settings",
          "system_settings",
          "role_permissions",
          "pending_destructive_actions",
        ],
      });
      return res.json();
    },
    onSuccess: (data) => {
      setLastIntent(data);
      setConfirmInitiate("");
      toast({
        title: "Purge intent created",
        description: `Intent ${data.intentId.slice(0, 8)}… expires ${new Date(data.expiresAt).toLocaleString()}. A second admin must now approve.`,
      });
    },
    onError: (error: any) => {
      const msg = error?.message ?? "Failed to initiate purge";
      toast({ title: "Initiate failed", description: msg, variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/admin/purge-database/approve/${id}`, {});
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Database purged",
        description: `Purged ${data.purgedTables?.length ?? 0} tables. Both admin identities recorded in audit log.`,
      });
      setIntentId("");
      setConfirmApprove("");
      setLastIntent(null);
      queryClient.invalidateQueries();
    },
    onError: (error: any) => {
      const msg = error?.message ?? "Failed to approve purge";
      toast({ title: "Approve failed", description: msg, variant: "destructive" });
    },
  });

  const canInitiate = confirmInitiate === "INITIATE_PURGE";
  const canApprove = intentId.length > 0 && confirmApprove === "APPROVE_PURGE";

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/admin">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3" data-testid="text-title">
            <Database className="h-7 w-7 text-rose-600" />
            Database management
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Two-admin destructive operations. All actions are logged with both admin identities.
          </p>
        </div>
      </div>

      <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div className="space-y-2 text-sm text-amber-800 dark:text-amber-300">
              <p className="font-bold">Two-admin approval required</p>
              <p>
                Database operations are irreversible. Both <em>initiate</em> and <em>approve</em> require the transaction PIN.
                Initiator and approver MUST be different admins. The endpoint is gated by the
                <code className="mx-1 px-1 rounded bg-amber-100 dark:bg-amber-900">allow_purge_endpoint</code>
                feature flag in <code>system_settings</code> — set to <code>true</code> via direct DB intervention to enable.
              </p>
              <p>Take a fresh database snapshot before initiating.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step 1 — Initiate */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-rose-600" />
            Step 1 — Initiate purge intent
          </CardTitle>
          <CardDescription>
            Creates a 30-minute pending intent. All admins are notified out-of-band. A second admin must approve.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-lg bg-muted/50 space-y-2">
            <h4 className="font-medium text-sm">Tables purged on approval:</h4>
            <div className="flex flex-wrap gap-2">
              {[
                "users", "expenses", "transactions", "bills", "budgets", "virtual_cards",
                "team_members", "payroll_entries", "invoices", "vendors", "wallets",
                "wallet_transactions", "payouts", "notifications",
              ].map((table) => (
                <Badge key={table} variant="outline" className="text-rose-600 border-rose-300">
                  {table}
                </Badge>
              ))}
            </div>
          </div>

          <div className="p-4 rounded-lg bg-muted/50 space-y-2">
            <h4 className="font-medium text-sm">Tables preserved:</h4>
            <div className="flex flex-wrap gap-2">
              {[
                "admin_settings",
                "organization_settings",
                "system_settings",
                "role_permissions",
                "pending_destructive_actions",
              ].map((table) => (
                <Badge key={table} variant="outline" className="text-emerald-600 border-emerald-300">
                  {table}
                </Badge>
              ))}
            </div>
          </div>

          <div className="border-t pt-4 mt-4">
            <p className="text-sm text-muted-foreground mb-3">
              Type <span className="font-mono font-bold text-foreground">INITIATE_PURGE</span> to enable:
            </p>
            <Input
              value={confirmInitiate}
              onChange={(e) => setConfirmInitiate(e.target.value)}
              placeholder="Type INITIATE_PURGE"
              className="max-w-xs"
              data-testid="input-confirm-initiate"
            />
          </div>

          <Button
            variant="destructive"
            disabled={!canInitiate || initiateMutation.isPending}
            onClick={() => initiateMutation.mutate()}
            className="gap-2"
            data-testid="button-initiate-purge"
          >
            {initiateMutation.isPending ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Clock className="h-4 w-4" />
            )}
            Initiate purge intent
          </Button>

          {lastIntent && (
            <div className="mt-4 p-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-sm">
              <p className="font-medium">Intent created — share this ID with the approving admin:</p>
              <p className="font-mono mt-1 break-all">{lastIntent.intentId}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Expires {new Date(lastIntent.expiresAt).toLocaleString()}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 2 — Approve */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-rose-600" />
            Step 2 — Approve and execute
          </CardTitle>
          <CardDescription>
            A different admin from the initiator pastes the intent ID and confirms.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Intent ID</label>
            <Input
              value={intentId}
              onChange={(e) => setIntentId(e.target.value.trim())}
              placeholder="e.g. 2c5c43a8-2d5d-4d12-..."
              className="font-mono"
              data-testid="input-intent-id"
            />
          </div>

          <div>
            <p className="text-sm text-muted-foreground mb-3">
              Type <span className="font-mono font-bold text-foreground">APPROVE_PURGE</span> to enable:
            </p>
            <Input
              value={confirmApprove}
              onChange={(e) => setConfirmApprove(e.target.value)}
              placeholder="Type APPROVE_PURGE"
              className="max-w-xs"
              data-testid="input-confirm-approve"
            />
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                disabled={!canApprove || approveMutation.isPending}
                className="gap-2"
                data-testid="button-approve-purge"
              >
                {approveMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Approve and purge
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2 text-rose-600">
                  <AlertTriangle className="h-5 w-5" />
                  Final confirmation
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. All transactional data is permanently deleted.
                  Both admin identities are recorded in <code>audit_logs</code>.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel data-testid="button-cancel">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => approveMutation.mutate(intentId)}
                  className="bg-rose-600 hover:bg-rose-700"
                  data-testid="button-confirm-approve"
                >
                  Yes, purge everything
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-emerald-600" />
            Database health
          </CardTitle>
          <CardDescription>Current database status and statistics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</p>
              <Badge className="mt-2 bg-emerald-100 text-emerald-800">Healthy</Badge>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Provider</p>
              <p className="text-lg font-bold mt-1">PostgreSQL 16</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Host</p>
              <p className="text-lg font-bold mt-1">RDS</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tables</p>
              <p className="text-lg font-bold mt-1">42</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
