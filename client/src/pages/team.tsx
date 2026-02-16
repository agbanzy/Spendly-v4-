import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Search,
  Users,
  UserPlus,
  MoreVertical,
  Mail,
  Shield,
  Pencil,
  Trash2,
  Loader2,
  UserX,
  UserCheck,
  Building2,
  Palette,
  DollarSign,
  FolderPlus,
  Send,
  Clock,
  XCircle,
  CheckCircle,
  Link2,
  Copy,
} from "lucide-react";
import type { TeamMember, Department, CompanySettings } from "@shared/schema";

const roleColors: Record<string, string> = {
  OWNER: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  ADMIN: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  MANAGER: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  EDITOR: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  EMPLOYEE: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300",
  VIEWER: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

const departmentColors = [
  { name: "Indigo", value: "#6366f1" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Emerald", value: "#10b981" },
  { name: "Amber", value: "#f59e0b" },
  { name: "Rose", value: "#f43f5e" },
  { name: "Purple", value: "#a855f7" },
  { name: "Cyan", value: "#06b6d4" },
  { name: "Orange", value: "#f97316" },
];

export default function Team() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("members");
  const [isMemberOpen, setIsMemberOpen] = useState(false);
  const [isDeptOpen, setIsDeptOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "member" | "department"; id: string; name: string } | null>(null);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: "", email: "", role: "EMPLOYEE", department: "" });

  const { data: settings } = useQuery<CompanySettings>({
    queryKey: ["/api/settings"],
  });

  // Currency formatting
  const currencySymbols: Record<string, string> = {
    USD: "$", EUR: "€", GBP: "£", NGN: "₦", KES: "KSh", GHS: "₵", ZAR: "R"
  };
  const currency = settings?.currency || "USD";
  const currencySymbol = currencySymbols[currency] || "$";
  
  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) || 0 : amount;
    return `${currencySymbol}${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const [memberForm, setMemberForm] = useState({
    name: "",
    email: "",
    role: "EMPLOYEE",
    department: "",
  });

  const [deptForm, setDeptForm] = useState({
    name: "",
    description: "",
    budget: "",
    color: "#6366f1",
    headId: "",
  });

  const { data: team, isLoading: teamLoading } = useQuery<TeamMember[]>({
    queryKey: ["/api/team"],
  });

  const { data: departments, isLoading: deptsLoading } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  const { data: myCompanies } = useQuery<any[]>({
    queryKey: ["/api/companies"],
  });

  const currentCompany = myCompanies?.[0];

  const { data: invitations, isLoading: invitationsLoading } = useQuery<any[]>({
    queryKey: [`/api/companies/${currentCompany?.id}/invitations`],
    enabled: !!currentCompany?.id,
  });

  const invalidateInvitations = () => {
    if (currentCompany?.id) {
      queryClient.invalidateQueries({ queryKey: [`/api/companies/${currentCompany.id}/invitations`] });
    }
    queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
    queryClient.invalidateQueries({ queryKey: ["/api/team"] });
  };

  const sendInviteMutation = useMutation({
    mutationFn: async (data: { name: string; email: string; role: string; department?: string }) => {
      let companyId = currentCompany?.id;
      if (!companyId) {
        const res = await apiRequest("POST", "/api/companies", {
          name: settings?.companyName || "My Company",
          currency: settings?.currency || "USD",
          country: settings?.countryCode || "US",
        });
        const newCompany = await res.json();
        companyId = newCompany.id;
        queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      }
      return apiRequest("POST", `/api/companies/${companyId}/invitations`, data);
    },
    onSuccess: () => {
      invalidateInvitations();
      toast({ title: "Invitation sent", description: "An email invitation has been sent to the team member." });
      setIsInviteOpen(false);
      setInviteForm({ name: "", email: "", role: "EMPLOYEE", department: "" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to send invitation", description: error.message, variant: "destructive" });
    },
  });

  const revokeInviteMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      return apiRequest("DELETE", `/api/companies/${currentCompany?.id}/invitations/${invitationId}`);
    },
    onSuccess: () => {
      invalidateInvitations();
      toast({ title: "Invitation revoked" });
    },
    onError: () => {
      toast({ title: "Failed to revoke invitation", variant: "destructive" });
    },
  });

  const createMemberMutation = useMutation({
    mutationFn: async (data: typeof memberForm) => {
      const res = await apiRequest("POST", "/api/team", data);
      return res.json();
    },
    onSuccess: (data: { inviteEmailSent?: boolean; inviteEmailError?: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/team"] });
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      if (data?.inviteEmailSent) {
        toast({ 
          title: "Team member added", 
          description: "An invite email has been sent to the new team member."
        });
      } else {
        toast({ 
          title: "Team member added", 
          description: data?.inviteEmailError 
            ? `Invite email failed: ${data.inviteEmailError}` 
            : "Team member created but invite email could not be sent."
        });
      }
      setIsMemberOpen(false);
      resetMemberForm();
    },
    onError: () => {
      toast({ title: "Failed to add team member", variant: "destructive" });
    },
  });

  const updateMemberMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      return apiRequest("PATCH", `/api/team/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team"] });
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      toast({ title: "Team member updated successfully" });
      setIsMemberOpen(false);
      setEditingMember(null);
      resetMemberForm();
    },
    onError: () => {
      toast({ title: "Failed to update team member", variant: "destructive" });
    },
  });

  const deleteMemberMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/team/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team"] });
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      toast({ title: "Team member removed successfully" });
      setIsDeleteOpen(false);
      setDeleteTarget(null);
    },
    onError: () => {
      toast({ title: "Failed to remove team member", variant: "destructive" });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return apiRequest("PATCH", `/api/team/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team"] });
      toast({ title: "Member status updated" });
    },
    onError: () => {
      toast({ title: "Failed to update status", variant: "destructive" });
    },
  });

  const createDeptMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; budget: string; color: string; headId: string | null }) => {
      return apiRequest("POST", "/api/departments", {
        ...data,
        budget: data.budget ? parseFloat(data.budget) : null,
        headId: data.headId || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      toast({ title: "Department created successfully" });
      setIsDeptOpen(false);
      resetDeptForm();
    },
    onError: () => {
      toast({ title: "Failed to create department", variant: "destructive" });
    },
  });

  const updateDeptMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      return apiRequest("PATCH", `/api/departments/${id}`, {
        ...data,
        budget: data.budget ? parseFloat(data.budget as string) : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      toast({ title: "Department updated successfully" });
      setIsDeptOpen(false);
      setEditingDept(null);
      resetDeptForm();
    },
    onError: () => {
      toast({ title: "Failed to update department", variant: "destructive" });
    },
  });

  const deleteDeptMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/departments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/team"] });
      toast({ title: "Department deleted successfully" });
      setIsDeleteOpen(false);
      setDeleteTarget(null);
    },
    onError: () => {
      toast({ title: "Failed to delete department", variant: "destructive" });
    },
  });

  const resetMemberForm = () => {
    setMemberForm({ name: "", email: "", role: "EMPLOYEE", department: "" });
  };

  const resetDeptForm = () => {
    setDeptForm({ name: "", description: "", budget: "", color: "#6366f1", headId: "" });
  };

  const openEditMember = (member: TeamMember) => {
    setEditingMember(member);
    setMemberForm({
      name: member.name,
      email: member.email,
      role: member.role,
      department: member.department,
    });
    setIsMemberOpen(true);
  };

  const openEditDept = (dept: Department) => {
    setEditingDept(dept);
    setDeptForm({
      name: dept.name,
      description: dept.description || "",
      budget: dept.budget ? String(dept.budget) : "",
      color: dept.color,
      headId: dept.headId || "",
    });
    setIsDeptOpen(true);
  };

  const handleMemberSubmit = () => {
    if (!memberForm.name || !memberForm.email) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    if (editingMember) {
      updateMemberMutation.mutate({ id: editingMember.id, data: memberForm });
    } else {
      createMemberMutation.mutate(memberForm);
    }
  };

  const handleDeptSubmit = () => {
    if (!deptForm.name) {
      toast({ title: "Department name is required", variant: "destructive" });
      return;
    }
    // Convert "none" to null for headId
    const submitData = {
      ...deptForm,
      headId: deptForm.headId === "none" ? null : deptForm.headId
    };
    if (editingDept) {
      updateDeptMutation.mutate({ id: editingDept.id, data: submitData });
    } else {
      createDeptMutation.mutate(submitData);
    }
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === "member") {
      deleteMemberMutation.mutate(deleteTarget.id);
    } else {
      deleteDeptMutation.mutate(deleteTarget.id);
    }
  };

  const filteredTeam = team?.filter(
    (member) =>
      (departmentFilter === "all" || member.department === departmentFilter) &&
      (member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
       member.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
       member.department.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const activeMembers = team?.filter((m) => m.status === "Active").length || 0;
  const departmentList = departments || [];
  const allDepartments = Array.from(new Set([...(team?.map(m => m.department) || []), ...departmentList.map(d => d.name)]));

  const getMemberCountForDept = (deptName: string) => team?.filter(m => m.department === deptName).length || 0;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 texture-mesh min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight" data-testid="text-team-title">Team Management</h1>
          <p className="text-muted-foreground mt-1">Manage team members and departments</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => { resetDeptForm(); setEditingDept(null); setIsDeptOpen(true); }} data-testid="button-add-department">
            <FolderPlus className="h-4 w-4 mr-2" />Add Department
          </Button>
          <Button onClick={() => { resetMemberForm(); setEditingMember(null); setIsMemberOpen(true); }} data-testid="button-add-member">
            <UserPlus className="h-4 w-4 mr-2" />Add Member
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="glass card-hover">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Total Members</p>
              <div className="p-2 bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl">
                <Users className="h-4 w-4 text-primary" />
              </div>
            </div>
            {teamLoading ? <Skeleton className="h-8 w-12" /> : <p className="text-2xl font-black" data-testid="text-total-members">{team?.length || 0}</p>}
          </CardContent>
        </Card>
        <Card className="glass card-hover">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Active</p>
              <div className="p-2 bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 rounded-xl">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              </div>
            </div>
            {teamLoading ? <Skeleton className="h-8 w-12" /> : <p className="text-2xl font-black text-emerald-600" data-testid="text-active-members">{activeMembers}</p>}
          </CardContent>
        </Card>
        <Card className="glass card-hover">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Admins</p>
              <div className="p-2 bg-gradient-to-br from-amber-500/20 to-amber-500/5 rounded-xl">
                <Shield className="h-4 w-4 text-amber-600" />
              </div>
            </div>
            {teamLoading ? <Skeleton className="h-8 w-12" /> : <p className="text-2xl font-black" data-testid="text-admin-count">{team?.filter((m) => m.role === "ADMIN" || m.role === "OWNER").length || 0}</p>}
          </CardContent>
        </Card>
        <Card className="glass card-hover">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Departments</p>
              <div className="p-2 bg-gradient-to-br from-cyan-500/20 to-cyan-500/5 rounded-xl">
                <Building2 className="h-4 w-4 text-cyan-600" />
              </div>
            </div>
            {deptsLoading ? <Skeleton className="h-8 w-12" /> : <p className="text-2xl font-black" data-testid="text-dept-count">{departmentList.length || allDepartments.length}</p>}
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <TabsList>
            <TabsTrigger value="members" data-testid="tab-members">
              <Users className="h-4 w-4 mr-2" />Members
            </TabsTrigger>
            <TabsTrigger value="departments" data-testid="tab-departments">
              <Building2 className="h-4 w-4 mr-2" />Departments
            </TabsTrigger>
            <TabsTrigger value="invitations" data-testid="tab-invitations">
              <Send className="h-4 w-4 mr-2" />Invitations
              {invitations && invitations.filter(i => i.status === 'pending').length > 0 && (
                <Badge variant="secondary" className="ml-1.5 text-xs">{invitations.filter(i => i.status === 'pending').length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {activeTab === "members" && (
            <div className="flex items-center gap-2">
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="w-40" data-testid="select-department-filter">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {allDepartments.map((dept) => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search members..." className="pl-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} data-testid="input-search-team" />
              </div>
            </div>
          )}
        </div>

        <TabsContent value="members">
          <Card>
            <CardHeader className="border-b flex flex-row items-center justify-between gap-4">
              <CardTitle className="text-sm font-bold uppercase tracking-widest">All Members</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {teamLoading ? (
                <div className="p-6 space-y-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-4">
                        <Skeleton className="h-12 w-12 rounded-full" />
                        <div><Skeleton className="h-4 w-32 mb-2" /><Skeleton className="h-3 w-48" /></div>
                      </div>
                      <Skeleton className="h-6 w-20" />
                    </div>
                  ))}
                </div>
              ) : filteredTeam && filteredTeam.length > 0 ? (
                <div className="divide-y divide-border">
                  {filteredTeam.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors" data-testid={`team-member-${member.id}`}>
                      <div className="flex items-center gap-4">
                        <Avatar className="h-12 w-12">
                          {member.avatar && <AvatarImage src={member.avatar} />}
                          <AvatarFallback className="bg-primary/10 text-primary font-bold">{member.name.split(' ').map(n => n[0]).join('').toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold truncate" data-testid={`text-member-name-${member.id}`}>{member.name}</p>
                            {member.status === "Active" && <span className="w-2 h-2 bg-emerald-500 rounded-full" />}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground truncate">{member.email}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <Badge variant="outline" className="text-xs mb-1">{member.department}</Badge>
                          <br />
                          <Badge variant="secondary" className={`text-xs ${roleColors[member.role] || ""}`}>{member.role}</Badge>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`button-member-menu-${member.id}`}><MoreVertical className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditMember(member)} data-testid={`button-edit-member-${member.id}`}><Pencil className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toggleStatusMutation.mutate({ id: member.id, status: member.status === "Active" ? "Inactive" : "Active" })} data-testid={`button-toggle-status-${member.id}`}>
                              {member.status === "Active" ? <><UserX className="h-4 w-4 mr-2" />Deactivate</> : <><UserCheck className="h-4 w-4 mr-2" />Activate</>}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600" onClick={() => { setDeleteTarget({ type: "member", id: member.id, name: member.name }); setIsDeleteOpen(true); }} data-testid={`button-delete-member-${member.id}`}><Trash2 className="h-4 w-4 mr-2" />Remove</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <Users className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-bold mb-1">No team members yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">Add your first team member to get started.</p>
                  <Button onClick={() => { resetMemberForm(); setEditingMember(null); setIsMemberOpen(true); }} data-testid="button-add-first-member"><UserPlus className="h-4 w-4 mr-2" />Add Member</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="departments">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {deptsLoading ? (
              [1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <Skeleton className="h-6 w-32 mb-2" />
                    <Skeleton className="h-4 w-full mb-4" />
                    <Skeleton className="h-8 w-20" />
                  </CardContent>
                </Card>
              ))
            ) : departmentList.length > 0 ? (
              departmentList.map((dept) => (
                <Card key={dept.id} className="group hover:shadow-lg transition-shadow" data-testid={`department-card-${dept.id}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${dept.color}20` }}>
                          <Building2 className="h-5 w-5" style={{ color: dept.color }} />
                        </div>
                        <div>
                          <CardTitle className="text-lg" data-testid={`text-dept-name-${dept.id}`}>{dept.name}</CardTitle>
                          <p className="text-sm text-muted-foreground">{getMemberCountForDept(dept.name)} members</p>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" data-testid={`button-dept-menu-${dept.id}`}><MoreVertical className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDept(dept)} data-testid={`button-edit-dept-${dept.id}`}><Pencil className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-600" onClick={() => { setDeleteTarget({ type: "department", id: dept.id, name: dept.name }); setIsDeleteOpen(true); }} data-testid={`button-delete-dept-${dept.id}`}><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {dept.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{dept.description}</p>
                    )}
                    <div className="flex items-center justify-between">
                      {dept.budget && (
                        <div className="flex items-center gap-1 text-sm">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{formatCurrency(dept.budget)}</span>
                          <span className="text-muted-foreground">budget</span>
                        </div>
                      )}
                      <Badge variant={dept.status === "Active" ? "default" : "secondary"} className={dept.status === "Active" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : ""}>{dept.status}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card className="col-span-full">
                <CardContent className="p-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <Building2 className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-bold mb-1">No departments yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">Create your first department to organize your team.</p>
                  <Button onClick={() => { resetDeptForm(); setEditingDept(null); setIsDeptOpen(true); }} data-testid="button-add-first-department"><FolderPlus className="h-4 w-4 mr-2" />Create Department</Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="invitations">
          <Card>
            <CardHeader className="border-b flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="text-sm font-bold uppercase tracking-widest">Pending Invitations</CardTitle>
                <CardDescription>Track and manage team invitations</CardDescription>
              </div>
              <Button onClick={() => { setInviteForm({ name: "", email: "", role: "EMPLOYEE", department: "" }); setIsInviteOpen(true); }} data-testid="button-new-invite">
                <Send className="h-4 w-4 mr-2" />New Invite
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {invitationsLoading ? (
                <div className="p-6 space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center justify-between py-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-6 w-20" />
                    </div>
                  ))}
                </div>
              ) : !currentCompany ? (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <Building2 className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-bold mb-1">No company set up</h3>
                  <p className="text-sm text-muted-foreground mb-4">Company invitations require a company to be configured. Contact your admin.</p>
                </div>
              ) : invitations && invitations.length > 0 ? (
                <div className="divide-y divide-border">
                  {invitations.map((inv: any) => (
                    <div key={inv.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors" data-testid={`invitation-${inv.id}`}>
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${inv.status === 'pending' ? 'bg-amber-100 dark:bg-amber-900/30' : inv.status === 'accepted' ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                          {inv.status === 'pending' ? <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" /> :
                           inv.status === 'accepted' ? <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /> :
                           <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate" data-testid={`text-invite-email-${inv.id}`}>{inv.email}</p>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className={`text-xs ${roleColors[inv.role] || ""}`}>{inv.role}</Badge>
                            {inv.department && <Badge variant="outline" className="text-xs">{inv.department}</Badge>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={inv.status === 'pending' ? 'secondary' : inv.status === 'accepted' ? 'default' : 'destructive'} className="text-xs capitalize">
                          {inv.status}
                        </Badge>
                        {inv.status === 'pending' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              const url = `${window.location.origin}/invite/${inv.token}`;
                              navigator.clipboard.writeText(url);
                              toast({ title: "Invite link copied to clipboard" });
                            }}
                            data-testid={`button-copy-invite-${inv.id}`}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        )}
                        {inv.status === 'pending' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => revokeInviteMutation.mutate(inv.id)}
                            disabled={revokeInviteMutation.isPending}
                            data-testid={`button-revoke-invite-${inv.id}`}
                          >
                            <XCircle className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <Send className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-bold mb-1">No invitations sent</h3>
                  <p className="text-sm text-muted-foreground mb-4">Send invitations to add team members to your company.</p>
                  <Button onClick={() => { setInviteForm({ name: "", email: "", role: "EMPLOYEE", department: "" }); setIsInviteOpen(true); }} data-testid="button-send-first-invite">
                    <Send className="h-4 w-4 mr-2" />Send First Invite
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isMemberOpen} onOpenChange={setIsMemberOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingMember ? "Edit Team Member" : "Add Team Member"}</DialogTitle>
            <DialogDescription>{editingMember ? "Update the team member's details." : "Add a new member to your team."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input id="name" value={memberForm.name} onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })} placeholder="John Doe" data-testid="input-member-name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address *</Label>
              <Input id="email" type="email" value={memberForm.email} onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })} placeholder="john@company.com" data-testid="input-member-email" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value={memberForm.role} onValueChange={(value) => setMemberForm({ ...memberForm, role: value })}>
                  <SelectTrigger data-testid="select-member-role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OWNER">Owner</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="MANAGER">Manager</SelectItem>
                    <SelectItem value="EDITOR">Editor</SelectItem>
                    <SelectItem value="EMPLOYEE">Employee</SelectItem>
                    <SelectItem value="VIEWER">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <Select value={memberForm.department} onValueChange={(value) => setMemberForm({ ...memberForm, department: value })}>
                  <SelectTrigger data-testid="select-member-department"><SelectValue placeholder="Select department" /></SelectTrigger>
                  <SelectContent>
                    {departmentList.length > 0 ? (
                      departmentList.map((dept) => (
                        <SelectItem key={dept.id} value={dept.name}>{dept.name}</SelectItem>
                      ))
                    ) : (
                      <>
                        <SelectItem value="Engineering">Engineering</SelectItem>
                        <SelectItem value="Marketing">Marketing</SelectItem>
                        <SelectItem value="Sales">Sales</SelectItem>
                        <SelectItem value="Finance">Finance</SelectItem>
                        <SelectItem value="Operations">Operations</SelectItem>
                        <SelectItem value="HR">HR</SelectItem>
                        <SelectItem value="Product">Product</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMemberOpen(false)} data-testid="button-cancel-member">Cancel</Button>
            <Button onClick={handleMemberSubmit} disabled={createMemberMutation.isPending || updateMemberMutation.isPending} data-testid="button-submit-member">
              {(createMemberMutation.isPending || updateMemberMutation.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingMember ? "Update Member" : "Add Member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeptOpen} onOpenChange={setIsDeptOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDept ? "Edit Department" : "Create Department"}</DialogTitle>
            <DialogDescription>{editingDept ? "Update department details." : "Create a new department to organize your team."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="deptName">Department Name *</Label>
              <Input id="deptName" value={deptForm.name} onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })} placeholder="e.g. Engineering" data-testid="input-dept-name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deptDesc">Description</Label>
              <Textarea id="deptDesc" value={deptForm.description} onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })} placeholder="Describe the department's responsibilities..." className="resize-none" data-testid="input-dept-description" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="deptBudget">Monthly Budget</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="deptBudget" type="number" className="pl-10" value={deptForm.budget} onChange={(e) => setDeptForm({ ...deptForm, budget: e.target.value })} placeholder="50000" data-testid="input-dept-budget" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex gap-2 flex-wrap">
                  {departmentColors.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      className={`w-8 h-8 rounded-lg transition-transform hover:scale-110 ${deptForm.color === color.value ? "ring-2 ring-offset-2 ring-primary" : ""}`}
                      style={{ backgroundColor: color.value }}
                      onClick={() => setDeptForm({ ...deptForm, color: color.value })}
                      title={color.name}
                      data-testid={`button-color-${color.name.toLowerCase()}`}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="deptHead">Department Head</Label>
              <Select value={deptForm.headId} onValueChange={(value) => setDeptForm({ ...deptForm, headId: value })}>
                <SelectTrigger data-testid="select-dept-head"><SelectValue placeholder="Select a department head" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No head assigned</SelectItem>
                  {team?.filter(m => m.role === "MANAGER" || m.role === "ADMIN" || m.role === "OWNER").map((member) => (
                    <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeptOpen(false)} data-testid="button-cancel-dept">Cancel</Button>
            <Button onClick={handleDeptSubmit} disabled={createDeptMutation.isPending || updateDeptMutation.isPending} data-testid="button-submit-dept">
              {(createDeptMutation.isPending || updateDeptMutation.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingDept ? "Update Department" : "Create Department"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Team Invitation</DialogTitle>
            <DialogDescription>
              {currentCompany
                ? `Invite a new member to ${currentCompany.name}. They will receive an email with a link to join.`
                : "Send an invitation to join your team."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="inviteName">Full Name *</Label>
              <Input id="inviteName" value={inviteForm.name} onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })} placeholder="Jane Doe" data-testid="input-invite-name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inviteEmail">Email Address *</Label>
              <Input id="inviteEmail" type="email" value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} placeholder="colleague@company.com" data-testid="input-invite-email" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="inviteRole">Role</Label>
                <Select value={inviteForm.role} onValueChange={(value) => setInviteForm({ ...inviteForm, role: value })}>
                  <SelectTrigger data-testid="select-invite-role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="MANAGER">Manager</SelectItem>
                    <SelectItem value="EMPLOYEE">Employee</SelectItem>
                    <SelectItem value="VIEWER">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="inviteDept">Department</Label>
                <Select value={inviteForm.department} onValueChange={(value) => setInviteForm({ ...inviteForm, department: value })}>
                  <SelectTrigger data-testid="select-invite-department"><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No department</SelectItem>
                    {departmentList.length > 0 ? (
                      departmentList.map((dept) => (
                        <SelectItem key={dept.id} value={dept.name}>{dept.name}</SelectItem>
                      ))
                    ) : (
                      <>
                        <SelectItem value="Engineering">Engineering</SelectItem>
                        <SelectItem value="Marketing">Marketing</SelectItem>
                        <SelectItem value="Sales">Sales</SelectItem>
                        <SelectItem value="Finance">Finance</SelectItem>
                        <SelectItem value="Operations">Operations</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsInviteOpen(false)} data-testid="button-cancel-invite">Cancel</Button>
            <Button onClick={() => {
              if (!inviteForm.name || !inviteForm.email) {
                toast({ title: "Name and email are required", variant: "destructive" });
                return;
              }
              sendInviteMutation.mutate({
                name: inviteForm.name,
                email: inviteForm.email,
                role: inviteForm.role,
                department: inviteForm.department && inviteForm.department !== "none" ? inviteForm.department : undefined,
              });
            }} disabled={sendInviteMutation.isPending} data-testid="button-confirm-invite">
              {sendInviteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Send Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === "member"
                ? `This will permanently remove ${deleteTarget.name} from your team. This action cannot be undone.`
                : `This will permanently delete the ${deleteTarget?.name} department. Members in this department will need to be reassigned.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700" data-testid="button-confirm-delete">
              {(deleteMemberMutation.isPending || deleteDeptMutation.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
