import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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

export default function AdminDatabase() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [confirmText, setConfirmText] = useState("");

  const purgeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/admin/purge-database", {
        confirmPurge: "CONFIRM_PURGE",
        tablesToPreserve: ["admin_settings", "organization_settings", "system_settings", "role_permissions"],
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Database Purged",
        description: `Successfully purged ${data.purgedTables?.length || 0} tables`,
      });
      queryClient.invalidateQueries();
      setConfirmText("");
    },
    onError: (error: any) => {
      toast({
        title: "Purge Failed",
        description: error.message || "Failed to purge database",
        variant: "destructive",
      });
    },
  });

  const canPurge = confirmText === "CONFIRM_PURGE";

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/admin">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-3" data-testid="text-title">
            <Database className="h-7 w-7 text-rose-600" />
            Database Management
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage database storage and perform maintenance operations
          </p>
        </div>
      </div>

      <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <h3 className="font-bold text-amber-800 dark:text-amber-300">Warning</h3>
              <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                Database operations are irreversible. Make sure you have a backup before performing any destructive operations.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-rose-600" />
            Purge Database
          </CardTitle>
          <CardDescription>
            Delete all transactional data while preserving system settings. This includes users, expenses, transactions, wallets, and all other records.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-lg bg-muted/50 space-y-2">
            <h4 className="font-medium text-sm">Tables that will be purged:</h4>
            <div className="flex flex-wrap gap-2">
              {[
                "users", "expenses", "transactions", "bills", "budgets", "virtual_cards",
                "team_members", "payroll_entries", "invoices", "vendors", "wallets",
                "wallet_transactions", "payouts", "notifications"
              ].map((table) => (
                <Badge key={table} variant="outline" className="text-rose-600 border-rose-300">
                  {table}
                </Badge>
              ))}
            </div>
          </div>
          
          <div className="p-4 rounded-lg bg-muted/50 space-y-2">
            <h4 className="font-medium text-sm">Tables that will be preserved:</h4>
            <div className="flex flex-wrap gap-2">
              {["admin_settings", "organization_settings", "system_settings", "role_permissions"].map((table) => (
                <Badge key={table} variant="outline" className="text-emerald-600 border-emerald-300">
                  {table}
                </Badge>
              ))}
            </div>
          </div>

          <div className="border-t pt-4 mt-4">
            <p className="text-sm text-muted-foreground mb-3">
              Type <span className="font-mono font-bold text-foreground">CONFIRM_PURGE</span> to enable the purge button:
            </p>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type CONFIRM_PURGE"
              className="max-w-xs"
              data-testid="input-confirm-purge"
            />
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="destructive" 
                disabled={!canPurge || purgeMutation.isPending}
                className="gap-2"
                data-testid="button-purge"
              >
                {purgeMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Purge Database
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2 text-rose-600">
                  <AlertTriangle className="h-5 w-5" />
                  Final Confirmation
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. All user data, transactions, expenses, and other records will be permanently deleted. Only system settings will be preserved.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel data-testid="button-cancel">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => purgeMutation.mutate()}
                  className="bg-rose-600 hover:bg-rose-700"
                  data-testid="button-confirm-purge"
                >
                  Yes, Purge Everything
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
            Database Health
          </CardTitle>
          <CardDescription>
            Current database status and statistics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</p>
              <Badge className="mt-2 bg-emerald-100 text-emerald-800">Healthy</Badge>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Provider</p>
              <p className="text-lg font-bold mt-1">PostgreSQL</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Host</p>
              <p className="text-lg font-bold mt-1">Neon</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tables</p>
              <p className="text-lg font-bold mt-1">24+</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
