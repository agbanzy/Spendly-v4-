import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PageWrapper, PageHeader, MetricCard, StatusBadge, AnimatedListItem, EmptyState, GlassCard, fadeUp, stagger } from "@/components/ui-extended";
import { motion } from "framer-motion";
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
  Trash2,
  BarChart3,
  TrendingUp,
  AlertCircle
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
    <PageWrapper>
      <motion.div initial="hidden" animate="visible" variants={fadeUp} className="space-y-8">
        {/* Header Section */}
        <PageHeader
          title="Reports"
          subtitle="Generate and download financial reports for deep insights"
          actions={
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button className="bg-violet-600 hover:bg-violet-700 text-white" data-testid="button-create-report">
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
                      className="bg-slate-900/30 rounded-xl h-11 border-slate-700/50 focus:border-violet-500"
                      data-testid="input-report-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Report Type</Label>
                    <div className="grid grid-cols-2 gap-3">
                      {reportTypes.map((type) => (
                        <button
                          key={type.value}
                          onClick={() => setNewReport(prev => ({ ...prev, type: type.value }))}
                          className={`p-4 rounded-xl border transition-all duration-200 text-left ${
                            newReport.type === type.value
                              ? "border-violet-500/50 bg-violet-500/10 shadow-lg shadow-violet-500/20"
                              : "border-slate-700/50 hover:border-slate-600/50 bg-slate-900/20"
                          }`}
                          data-testid={`button-type-${type.value}`}
                        >
                          <type.icon
                            className={`h-5 w-5 mb-2 ${
                              newReport.type === type.value ? "text-violet-400" : "text-slate-400"
                            }`}
                          />
                          <div className="font-medium text-sm">{type.label}</div>
                          <div className="text-xs text-slate-400">{type.description}</div>
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
                      <SelectTrigger className="bg-slate-900/30 rounded-xl h-11 border-slate-700/50 focus:border-violet-500" data-testid="select-date-range">
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
                <DialogFooter className="pt-6">
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    className="bg-violet-600 hover:bg-violet-700 text-white"
                    onClick={handleCreateReport}
                    disabled={createMutation.isPending}
                    data-testid="button-generate-report"
                  >
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
          }
        />

        {/* Metrics Grid */}
        <motion.div
          variants={stagger}
          className="grid gap-4 md:grid-cols-4 sm:grid-cols-2"
        >
          <MetricCard
            title="Total Reports"
            value={reports.length}
            icon={FileText}
            color="violet"
            trend={`${reports.length} generated`}
          />
          <MetricCard
            title="Completed"
            value={reports.filter(r => r.status === "completed").length}
            icon={CheckCircle2}
            color="emerald"
            trend="Ready to download"
          />
          <MetricCard
            title="Processing"
            value={reports.filter(r => r.status === "processing").length}
            icon={Loader2}
            color="amber"
            trend="In progress"
          />
          <MetricCard
            title="Scheduled"
            value={reports.filter(r => r.status === "scheduled").length}
            icon={Clock}
            color="cyan"
            trend="Upcoming"
          />
        </motion.div>

        {/* Reports List */}
        <GlassCard>
          <div className="p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-lg bg-violet-500/10 text-violet-400">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Recent Reports</h2>
                <p className="text-slate-400 text-sm mt-1">View and download your generated reports</p>
              </div>
            </div>

            {isLoading ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center justify-center py-12"
              >
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-violet-400 mx-auto mb-3" />
                  <p className="text-slate-400">Loading reports...</p>
                </div>
              </motion.div>
            ) : reports.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No reports yet"
                subtitle="Create your first report to get started with financial insights."
                action={
                  <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogTrigger asChild>
                      <Button className="bg-violet-600 hover:bg-violet-700 text-white mt-4">
                        <Plus className="mr-2 h-4 w-4" />
                        Create Report
                      </Button>
                    </DialogTrigger>
                  </Dialog>
                }
              />
            ) : (
              <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-3">
                {reports.map((report, index) => (
                  <AnimatedListItem key={report.id} index={index}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/30 border border-slate-700/50 hover:border-violet-500/50 transition-all duration-200 group">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="p-3 rounded-lg bg-violet-500/10 text-violet-400 flex-shrink-0 group-hover:bg-violet-500/20 transition-colors">
                          {getTypeIcon(report.type)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-white truncate">{report.name}</p>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-2">
                            <span className="px-2 py-1 rounded-full bg-slate-800/50">{report.type}</span>
                            <span className="px-2 py-1 rounded-full bg-slate-800/50">{report.dateRange}</span>
                            {report.fileSize !== "--" && (
                              <span className="px-2 py-1 rounded-full bg-slate-800/50">{report.fileSize}</span>
                            )}
                            <span className="text-slate-500 ml-auto sm:ml-0">{report.createdAt}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        <StatusBadge status={report.status} />
                        <div className="flex items-center gap-1 border-l border-slate-700/50 pl-3">
                          {report.status === "completed" && (
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleDownload(report)}
                              className="p-2 rounded-lg hover:bg-emerald-500/10 text-emerald-400 hover:text-emerald-300 transition-colors"
                              data-testid={`button-download-${index}`}
                              title="Download report"
                            >
                              <Download className="h-4 w-4" />
                            </motion.button>
                          )}
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleDelete(report)}
                            className="p-2 rounded-lg hover:bg-rose-500/10 text-rose-400 hover:text-rose-300 transition-colors"
                            data-testid={`button-delete-${index}`}
                            title="Delete report"
                          >
                            <Trash2 className="h-4 w-4" />
                          </motion.button>
                        </div>
                      </div>
                    </div>
                  </AnimatedListItem>
                ))}
              </motion.div>
            )}
          </div>
        </GlassCard>
      </motion.div>
    </PageWrapper>
  );
}
