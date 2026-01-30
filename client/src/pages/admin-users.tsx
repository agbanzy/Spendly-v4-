import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  Search,
  Users,
  UserCog,
  MoreVertical,
  Shield,
  ShieldCheck,
  ShieldX,
  Edit,
  Trash2,
  UserPlus,
  Filter,
  ArrowLeft,
  Lock,
  Unlock,
  Key,
} from "lucide-react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { TeamMember } from "@shared/schema";
import { Permission } from "@shared/schema";

const roles = ['Owner', 'Admin', 'Manager', 'Editor', 'Employee', 'Viewer'];

const allPermissions = Object.values(Permission);

export default function AdminUsers() {
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editOpen, setEditOpen] = useState(false);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<TeamMember | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const { toast } = useToast();

  const { data: users, isLoading } = useQuery<TeamMember[]>({
    queryKey: ["/api/team"],
  });

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    return users.filter((user) => {
      const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = roleFilter === "all" || user.role === roleFilter;
      const matchesStatus = statusFilter === "all" || user.status === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  const editForm = useForm({
    defaultValues: {
      name: "",
      email: "",
      role: "Employee",
      department: "",
    },
  });

  const updateUser = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest("PATCH", `/api/team/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team"] });
      toast({ title: "User updated successfully" });
      setEditOpen(false);
      setSelectedUser(null);
    },
    onError: () => {
      toast({ title: "Failed to update user", variant: "destructive" });
    },
  });

  const toggleUserStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return apiRequest("PATCH", `/api/team/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team"] });
      toast({ title: "User status updated" });
    },
    onError: () => {
      toast({ title: "Failed to update status", variant: "destructive" });
    },
  });

  const handleEditUser = (user: TeamMember) => {
    setSelectedUser(user);
    editForm.reset({
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department || "",
    });
    setEditOpen(true);
  };

  const handleManagePermissions = (user: TeamMember) => {
    setSelectedUser(user);
    setSelectedPermissions(user.permissions || []);
    setPermissionsOpen(true);
  };

  const togglePermission = (permission: string) => {
    setSelectedPermissions(prev =>
      prev.includes(permission)
        ? prev.filter(p => p !== permission)
        : [...prev, permission]
    );
  };

  const savePermissions = () => {
    if (!selectedUser) return;
    updateUser.mutate({
      id: selectedUser.id,
      data: { permissions: selectedPermissions },
    });
    setPermissionsOpen(false);
  };

  const onEditSubmit = (data: any) => {
    if (!selectedUser) return;
    updateUser.mutate({
      id: selectedUser.id,
      data,
    });
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'Owner': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
      case 'Admin': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      case 'Manager': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'Editor': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
      case 'Employee': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
      default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400';
    }
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
            <h1 className="text-3xl font-black tracking-tight flex items-center gap-3" data-testid="text-admin-users-title">
              <UserCog className="h-8 w-8 text-primary" />
              User Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage users, roles, and permissions
            </p>
          </div>
        </div>
        <Link href="/team">
          <Button data-testid="button-add-user">
            <UserPlus className="h-4 w-4 mr-2" />
            Add User
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="glass card-hover">
          <CardContent className="p-4">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Total Users</p>
            <p className="text-2xl font-black">{users?.length || 0}</p>
          </CardContent>
        </Card>
        <Card className="glass card-hover">
          <CardContent className="p-4">
            <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">Active</p>
            <p className="text-2xl font-black text-emerald-600">{users?.filter(u => u.status === 'Active').length || 0}</p>
          </CardContent>
        </Card>
        <Card className="glass card-hover">
          <CardContent className="p-4">
            <p className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-widest mb-1">Admins</p>
            <p className="text-2xl font-black text-red-600">{users?.filter(u => u.role === 'Admin' || u.role === 'Owner').length || 0}</p>
          </CardContent>
        </Card>
        <Card className="glass card-hover">
          <CardContent className="p-4">
            <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-1">Inactive</p>
            <p className="text-2xl font-black text-slate-600">{users?.filter(u => u.status === 'Inactive').length || 0}</p>
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
                placeholder="Search users..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search-users"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full md:w-40" data-testid="select-role-filter">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {roles.map((role) => (
                  <SelectItem key={role} value={role}>{role}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-40" data-testid="select-status-filter">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users List */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-sm font-bold uppercase tracking-widest">
            All Users ({filteredUsers.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-48 mb-2" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-5 w-20" />
                </div>
              ))}
            </div>
          ) : filteredUsers.length > 0 ? (
            <div className="divide-y divide-border">
              {filteredUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                  data-testid={`user-row-${user.id}`}
                >
                  <div className="flex items-center gap-4">
                    <Avatar className="h-12 w-12 border-2 border-primary/10">
                      <AvatarFallback className="font-bold bg-primary/10">
                        {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-bold">{user.name}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={getRoleBadgeColor(user.role)}>
                      <Shield className="h-3 w-3 mr-1" />
                      {user.role}
                    </Badge>
                    <Badge variant={user.status === 'Active' ? 'default' : 'secondary'}>
                      {user.status === 'Active' ? (
                        <ShieldCheck className="h-3 w-3 mr-1" />
                      ) : (
                        <ShieldX className="h-3 w-3 mr-1" />
                      )}
                      {user.status}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" data-testid={`button-user-menu-${user.id}`}>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditUser(user)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit User
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleManagePermissions(user)}>
                          <Key className="h-4 w-4 mr-2" />
                          Manage Permissions
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => toggleUserStatus.mutate({
                            id: user.id,
                            status: user.status === 'Active' ? 'Inactive' : 'Active',
                          })}
                        >
                          {user.status === 'Active' ? (
                            <>
                              <Lock className="h-4 w-4 mr-2" />
                              Deactivate
                            </>
                          ) : (
                            <>
                              <Unlock className="h-4 w-4 mr-2" />
                              Activate
                            </>
                          )}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-bold mb-1">No users found</h3>
              <p className="text-sm text-muted-foreground">Try adjusting your filters</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input id="edit-name" {...editForm.register("name", { required: true })} data-testid="input-edit-name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input id="edit-email" type="email" {...editForm.register("email", { required: true })} data-testid="input-edit-email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">Role</Label>
              <Select onValueChange={(value) => editForm.setValue("role", value)} value={editForm.watch("role")}>
                <SelectTrigger data-testid="select-edit-role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role} value={role}>{role}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={updateUser.isPending} data-testid="button-save-user">
                {updateUser.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Manage Permissions Dialog */}
      <Dialog open={permissionsOpen} onOpenChange={setPermissionsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Manage Permissions - {selectedUser?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[400px] overflow-y-auto">
            {allPermissions.map((permission) => (
              <div
                key={permission}
                className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted cursor-pointer"
                onClick={() => togglePermission(permission)}
              >
                <Checkbox
                  checked={selectedPermissions.includes(permission)}
                  onCheckedChange={() => togglePermission(permission)}
                />
                <div>
                  <p className="font-medium text-sm">{permission.replace(/_/g, ' ')}</p>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPermissionsOpen(false)}>Cancel</Button>
            <Button onClick={savePermissions} disabled={updateUser.isPending} data-testid="button-save-permissions">
              {updateUser.isPending ? "Saving..." : "Save Permissions"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
