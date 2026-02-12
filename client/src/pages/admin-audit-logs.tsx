import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search,
  ScrollText,
  Filter,
  ArrowLeft,
  Activity,
  User,
  FileText,
  CreditCard,
  Users,
  Settings,
  Download,
  Eye,
  Clock,
} from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import type { AuditLog } from "@shared/schema";

const entityTypes = ['expense', 'user', 'team', 'budget', 'card', 'invoice', 'vendor', 'report', 'settings', 'wallet', 'transfer', 'payout', 'bill', 'utility', 'database'];
const actionTypes = ['CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'LOGIN', 'LOGOUT', 'EXPORT', 'wallet_funding', 'wallet_withdrawal', 'transfer_initiated', 'payout_processed', 'utility_payment', 'bill_payment', 'database_purge'];

export default function AdminAuditLogs() {
  const [searchQuery, setSearchQuery] = useState("");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const { toast } = useToast();

  const { data: logs, isLoading } = useQuery<AuditLog[]>({
    queryKey: ["/api/admin/audit-logs"],
  });

  const filteredLogs = useMemo(() => {
    if (!logs) return [];
    return logs.filter((log) => {
      const matchesSearch = log.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.entityType.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesEntity = entityFilter === "all" || log.entityType === entityFilter;
      const matchesAction = actionFilter === "all" || log.action === actionFilter;
      return matchesSearch && matchesEntity && matchesAction;
    });
  }, [logs, searchQuery, entityFilter, actionFilter]);

  const getEntityIcon = (entityType: string) => {
    switch (entityType.toLowerCase()) {
      case 'expense': return <FileText className="h-4 w-4" />;
      case 'user': return <User className="h-4 w-4" />;
      case 'team': return <Users className="h-4 w-4" />;
      case 'card': return <CreditCard className="h-4 w-4" />;
      case 'settings': return <Settings className="h-4 w-4" />;
      case 'wallet': return <CreditCard className="h-4 w-4" />;
      case 'transfer': return <Activity className="h-4 w-4" />;
      case 'payout': return <Activity className="h-4 w-4" />;
      case 'bill': return <FileText className="h-4 w-4" />;
      case 'utility': return <FileText className="h-4 w-4" />;
      case 'database': return <Settings className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const getActionColor = (action: string) => {
    const a = action.toLowerCase();
    if (a === 'create' || a === 'wallet_funding') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
    if (a === 'update') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    if (a === 'delete' || a === 'database_purge') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    if (a === 'approve') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    if (a === 'reject') return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
    if (a === 'login') return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400';
    if (a === 'logout') return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400';
    if (a === 'wallet_withdrawal' || a === 'payout_processed') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    if (a === 'transfer_initiated') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    if (a === 'utility_payment' || a === 'bill_payment') return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
    return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400';
  };

  const formatActionLabel = (action: string) => {
    return action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  const exportLogs = () => {
    if (!filteredLogs.length) return;
    const csvContent = [
      ["Timestamp", "User", "Action", "Entity Type", "Entity ID", "IP Address"].join(","),
      ...filteredLogs.map(log => 
        [log.createdAt, log.userName, log.action, log.entityType, log.entityId || '', log.ipAddress || ''].join(",")
      )
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast({ title: "Audit logs exported successfully" });
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 texture-mesh min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/admin">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-black tracking-tight flex items-center gap-3" data-testid="text-audit-logs-title">
              <ScrollText className="h-8 w-8 text-primary" />
              Audit Logs
            </h1>
            <p className="text-muted-foreground mt-1">
              View all system activities and changes
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={exportLogs} disabled={!filteredLogs.length} data-testid="button-export-logs">
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="glass card-hover">
          <CardContent className="p-4">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Total Logs</p>
            <p className="text-2xl font-black">{logs?.length || 0}</p>
          </CardContent>
        </Card>
        <Card className="glass card-hover">
          <CardContent className="p-4">
            <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">Creates</p>
            <p className="text-2xl font-black text-emerald-600">{logs?.filter(l => l.action === 'CREATE').length || 0}</p>
          </CardContent>
        </Card>
        <Card className="glass card-hover">
          <CardContent className="p-4">
            <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">Updates</p>
            <p className="text-2xl font-black text-blue-600">{logs?.filter(l => l.action === 'UPDATE').length || 0}</p>
          </CardContent>
        </Card>
        <Card className="glass card-hover">
          <CardContent className="p-4">
            <p className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-widest mb-1">Deletes</p>
            <p className="text-2xl font-black text-red-600">{logs?.filter(l => l.action === 'DELETE').length || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search-logs"
              />
            </div>
            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger className="w-full md:w-40" data-testid="select-entity-filter">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Entity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Entities</SelectItem>
                {entityTypes.map((entity) => (
                  <SelectItem key={entity} value={entity}>{entity.charAt(0).toUpperCase() + entity.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-full md:w-40" data-testid="select-action-filter">
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {actionTypes.map((action) => (
                  <SelectItem key={action} value={action}>{formatActionLabel(action)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Logs List */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-sm font-bold uppercase tracking-widest">
            Activity Log ({filteredLogs.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredLogs.length > 0 ? (
            <div className="divide-y divide-border">
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => { setSelectedLog(log); setDetailOpen(true); }}
                  data-testid={`log-row-${log.id}`}
                >
                  <div className="flex items-center gap-4">
                    <Avatar className="h-10 w-10 border">
                      <AvatarFallback className="bg-primary/10 text-sm">
                        {log.userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{log.userName}</span>
                        <Badge className={getActionColor(log.action)}>
                          {formatActionLabel(log.action)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          {getEntityIcon(log.entityType)}
                          {log.entityType}
                        </span>
                        {log.entityId && (
                          <span>• ID: {log.entityId.slice(0, 8)}...</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-medium flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(log.createdAt).toLocaleTimeString()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(log.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Button size="icon" variant="ghost">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center">
              <ScrollText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-bold mb-1">No audit logs found</h3>
              <p className="text-sm text-muted-foreground">System activity will appear here</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Log Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Log Details
            </DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-bold">User</p>
                  <p className="font-medium">{selectedLog.userName}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-bold">User ID</p>
                  <p className="font-medium text-sm">{selectedLog.userId}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-bold">Action</p>
                  <Badge className={getActionColor(selectedLog.action)}>{formatActionLabel(selectedLog.action)}</Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-bold">Entity Type</p>
                  <p className="font-medium">{selectedLog.entityType}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-bold">Entity ID</p>
                  <p className="font-medium text-sm font-mono">{selectedLog.entityId || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-bold">Timestamp</p>
                  <p className="font-medium text-sm">{new Date(selectedLog.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-bold">IP Address</p>
                  <p className="font-medium text-sm font-mono">{selectedLog.ipAddress || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-bold">User Agent</p>
                  <p className="font-medium text-xs truncate">{selectedLog.userAgent || 'N/A'}</p>
                </div>
              </div>
              {selectedLog.details && Object.keys(selectedLog.details).length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-bold mb-2">Additional Details</p>
                  <pre className="bg-muted rounded-lg p-3 text-xs overflow-auto max-h-40">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
