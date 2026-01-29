import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
} from "lucide-react";
import type { TeamMember } from "@shared/schema";

const roleColors: Record<string, string> = {
  OWNER: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  ADMIN: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  MANAGER: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  EDITOR: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  EMPLOYEE: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300",
  VIEWER: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

export default function Team() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "EMPLOYEE",
    department: "Engineering",
  });

  const { data: team, isLoading } = useQuery<TeamMember[]>({
    queryKey: ["/api/team"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("POST", "/api/team", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team"] });
      toast({ title: "Team member invited successfully" });
      setIsOpen(false);
      resetForm();
    },
    onError: () => {
      toast({ title: "Failed to invite team member", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      return apiRequest("PATCH", `/api/team/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team"] });
      toast({ title: "Team member updated successfully" });
      setIsOpen(false);
      setEditingMember(null);
      resetForm();
    },
    onError: () => {
      toast({ title: "Failed to update team member", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/team/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team"] });
      toast({ title: "Team member removed successfully" });
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

  const resetForm = () => {
    setFormData({ name: "", email: "", role: "EMPLOYEE", department: "Engineering" });
  };

  const openEditDialog = (member: TeamMember) => {
    setEditingMember(member);
    setFormData({
      name: member.name,
      email: member.email,
      role: member.role,
      department: member.department,
    });
    setIsOpen(true);
  };

  const handleSubmit = () => {
    if (editingMember) {
      updateMutation.mutate({ id: editingMember.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const filteredTeam = team?.filter(
    (member) =>
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeMembers = team?.filter((m) => m.status === "Active").length || 0;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 texture-mesh min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight" data-testid="text-team-title">Team</h1>
          <p className="text-muted-foreground mt-1">Manage team members and their permissions.</p>
        </div>
        <Button onClick={() => { resetForm(); setEditingMember(null); setIsOpen(true); }} data-testid="button-invite-member">
          <UserPlus className="h-4 w-4 mr-2" />Invite Member
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Total Members</p>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
            {isLoading ? <Skeleton className="h-8 w-12" /> : <p className="text-2xl font-black">{team?.length || 0}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Active</p>
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            </div>
            {isLoading ? <Skeleton className="h-8 w-12" /> : <p className="text-2xl font-black text-emerald-600">{activeMembers}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Admins</p>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </div>
            {isLoading ? <Skeleton className="h-8 w-12" /> : <p className="text-2xl font-black">{team?.filter((m) => m.role === "ADMIN" || m.role === "OWNER").length || 0}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Departments</p>
            </div>
            {isLoading ? <Skeleton className="h-8 w-12" /> : <p className="text-2xl font-black">{new Set(team?.map((m) => m.department)).size || 0}</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search team members..." className="pl-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} data-testid="input-search-team" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b"><CardTitle className="text-sm font-bold uppercase tracking-widest">All Members</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
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
                        <p className="text-sm font-bold truncate">{member.name}</p>
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
                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(member)}><Pencil className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleStatusMutation.mutate({ id: member.id, status: member.status === "Active" ? "Inactive" : "Active" })}>
                          {member.status === "Active" ? <><UserX className="h-4 w-4 mr-2" />Deactivate</> : <><UserCheck className="h-4 w-4 mr-2" />Activate</>}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-red-600" onClick={() => deleteMutation.mutate(member.id)}><Trash2 className="h-4 w-4 mr-2" />Remove</DropdownMenuItem>
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
              <p className="text-sm text-muted-foreground mb-4">Invite your first team member to get started.</p>
              <Button onClick={() => setIsOpen(true)}><UserPlus className="h-4 w-4 mr-2" />Invite Member</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingMember ? "Edit Team Member" : "Invite Team Member"}</DialogTitle>
            <DialogDescription>{editingMember ? "Update the team member's details." : "Send an invitation to join your team."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="John Doe" data-testid="input-member-name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="john@company.com" data-testid="input-member-email" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
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
                <Select value={formData.department} onValueChange={(value) => setFormData({ ...formData, department: value })}>
                  <SelectTrigger data-testid="select-member-department"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Engineering">Engineering</SelectItem>
                    <SelectItem value="Marketing">Marketing</SelectItem>
                    <SelectItem value="Sales">Sales</SelectItem>
                    <SelectItem value="Finance">Finance</SelectItem>
                    <SelectItem value="Operations">Operations</SelectItem>
                    <SelectItem value="HR">HR</SelectItem>
                    <SelectItem value="Product">Product</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-member">
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingMember ? "Update Member" : "Send Invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
