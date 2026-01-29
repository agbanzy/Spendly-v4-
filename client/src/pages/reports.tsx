import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  FileText, 
  Download, 
  Calendar, 
  Plus, 
  Clock, 
  CheckCircle2,
  FileSpreadsheet,
  FilePieChart,
  FileBarChart,
  Loader2,
  Share2,
  Trash2,
  Eye
} from "lucide-react";

interface Report {
  id: string;
  name: string;
  type: string;
  dateRange: string;
  createdAt: string;
  status: "completed" | "processing" | "scheduled";
  fileSize: string;
}

export default function ReportsPage() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newReport, setNewReport] = useState({
    name: "",
    type: "expense",
    dateRange: "last_30_days"
  });

  const { data: reports = [], isLoading, refetch } = useQuery<Report[]>({
    queryKey: ['/api/reports'],
    refetchInterval: 5000,
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; type: string; dateRange: string }) => {
      const res = await apiRequest('POST', '/api/reports', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reports'] });
      toast({
        title: "Report created",
        description: "Your report is being generated and will be ready shortly."
      });
      setIsCreateOpen(false);
      setNewReport({ name: "", type: "expense", dateRange: "last_30_days" });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create report.",
        variant: "destructive"
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/reports/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reports'] });
      toast({
        title: "Report deleted",
        description: "The report has been removed."
      });
    }
  });

  const reportTypes = [
    { value: "expense", label: "Expense Summary", icon: FileText, description: "Overview of all expenses" },
    { value: "budget", label: "Budget Analysis", icon: FilePieChart, description: "Budget vs actual spending" },
    { value: "team", label: "Team Analytics", icon: FileBarChart, description: "Spending by team member" },
    { value: "vendor", label: "Vendor Report", icon: FileSpreadsheet, description: "Payments to vendors" }
  ];

  const dateRanges = [
    { value: "last_7_days", label: "Last 7 days" },
    { value: "last_30_days", label: "Last 30 days" },
    { value: "last_90_days", label: "Last 90 days" },
    { value: "this_month", label: "This month" },
    { value: "last_month", label: "Last month" },
    { value: "this_quarter", label: "This quarter" },
    { value: "this_year", label: "This year" },
    { value: "custom", label: "Custom range" }
  ];

  const handleCreateReport = async () => {
    if (!newReport.name) {
      toast({
        title: "Error",
        description: "Please enter a report name.",
        variant: "destructive"
      });
      return;
    }

    createMutation.mutate(newReport);
  };

  const handleDownload = async (report: Report) => {
    try {
      toast({
        title: "Downloading...",
        description: `Preparing ${report.name}`
      });
      
      const response = await fetch(`/api/reports/${report.id}/download`);
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${report.name.replace(/\s+/g, '_')}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Downloaded",
        description: `${report.name} has been downloaded.`
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to download report.",
        variant: "destructive"
      });
    }
  };

  const handleDelete = (report: Report) => {
    deleteMutation.mutate(report.id);
  };

  const getStatusBadge = (status: Report["status"]) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="default" className="bg-emerald-500">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Completed
          </Badge>
        );
      case "processing":
        return (
          <Badge variant="secondary">
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            Processing
          </Badge>
        );
      case "scheduled":
        return (
          <Badge variant="outline">
            <Clock className="mr-1 h-3 w-3" />
            Scheduled
          </Badge>
        );
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "Expense Summary":
        return <FileText className="h-5 w-5" />;
      case "Budget Report":
        return <FilePieChart className="h-5 w-5" />;
      case "Team Analytics":
        return <FileBarChart className="h-5 w-5" />;
      case "Vendor Report":
        return <FileSpreadsheet className="h-5 w-5" />;
      default:
        return <FileText className="h-5 w-5" />;
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 texture-mesh min-h-screen">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight" data-testid="text-reports-title">Reports</h1>
          <p className="text-muted-foreground">Generate and download financial reports</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-report">
              <Plus className="mr-2 h-4 w-4" />
              Create Report
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create New Report</DialogTitle>
              <DialogDescription>
                Generate a custom report based on your requirements.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="reportName">Report Name</Label>
                <Input
                  id="reportName"
                  placeholder="e.g., Monthly Expense Report"
                  value={newReport.name}
                  onChange={(e) => setNewReport(prev => ({ ...prev, name: e.target.value }))}
                  data-testid="input-report-name"
                />
              </div>
              <div className="space-y-2">
                <Label>Report Type</Label>
                <div className="grid grid-cols-2 gap-2">
                  {reportTypes.map((type) => (
                    <button
                      key={type.value}
                      onClick={() => setNewReport(prev => ({ ...prev, type: type.value }))}
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        newReport.type === type.value 
                          ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950" 
                          : "border-border hover:border-muted-foreground"
                      }`}
                      data-testid={`button-type-${type.value}`}
                    >
                      <type.icon className={`h-5 w-5 mb-2 ${
                        newReport.type === type.value ? "text-indigo-600" : "text-muted-foreground"
                      }`} />
                      <div className="font-medium text-sm">{type.label}</div>
                      <div className="text-xs text-muted-foreground">{type.description}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Date Range</Label>
                <Select 
                  value={newReport.dateRange} 
                  onValueChange={(value) => setNewReport(prev => ({ ...prev, dateRange: value }))}
                >
                  <SelectTrigger data-testid="select-date-range">
                    <Calendar className="mr-2 h-4 w-4" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {dateRanges.map((range) => (
                      <SelectItem key={range.value} value={range.value}>
                        {range.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateReport} disabled={createMutation.isPending} data-testid="button-generate-report">
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate Report"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="glass card-hover">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900 text-indigo-600">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{reports.length}</p>
                <p className="text-sm text-muted-foreground">Total Reports</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass card-hover">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900 text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{reports.filter(r => r.status === "completed").length}</p>
                <p className="text-sm text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass card-hover">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900 text-amber-600">
                <Loader2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{reports.filter(r => r.status === "processing").length}</p>
                <p className="text-sm text-muted-foreground">Processing</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass card-hover">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-100 dark:bg-cyan-900 text-cyan-600">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{reports.filter(r => r.status === "scheduled").length}</p>
                <p className="text-sm text-muted-foreground">Scheduled</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Reports</CardTitle>
          <CardDescription>View and download your generated reports</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-medium text-lg">No reports yet</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Create your first report to get started with financial insights.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {reports.map((report, index) => (
                <div 
                  key={report.id} 
                  className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                  data-testid={`report-row-${index}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-muted text-muted-foreground">
                      {getTypeIcon(report.type)}
                    </div>
                    <div>
                      <p className="font-medium">{report.name}</p>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <span>{report.type}</span>
                        <span>•</span>
                        <span>{report.dateRange}</span>
                        {report.fileSize !== "--" && (
                          <>
                            <span>•</span>
                            <span>{report.fileSize}</span>
                          </>
                        )}
                        <span>•</span>
                        <span>{report.createdAt}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getStatusBadge(report.status)}
                    <div className="flex items-center gap-1">
                      {report.status === "completed" && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleDownload(report)}
                          data-testid={`button-download-${index}`}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleDelete(report)}
                        data-testid={`button-delete-${index}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
