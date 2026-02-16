import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { useCompany } from "@/lib/company-context";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  LayoutDashboard,
  Receipt,
  CreditCard,
  Wallet,
  Users,
  PieChart,
  Settings,
  ArrowRightLeft,
  FileText,
  LogOut,
  BarChart3,
  FileSpreadsheet,
  DollarSign,
  Building2,
  Shield,
  UserCog,
  ScrollText,
  Lock,
  Database,
  ChevronDown,
  Check,
  Plus,
  Loader2,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const mainMenuItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Transactions", url: "/transactions", icon: ArrowRightLeft },
  { title: "Expenses", url: "/expenses", icon: Receipt },
  { title: "Bills", url: "/bills", icon: FileText },
  { title: "Budget", url: "/budget", icon: PieChart },
  { title: "Cards", url: "/cards", icon: CreditCard },
];

const financeItems = [
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Reports", url: "/reports", icon: FileSpreadsheet },
  { title: "Payroll", url: "/payroll", icon: DollarSign },
  { title: "Invoices", url: "/invoices", icon: FileText },
  { title: "Vendors", url: "/vendors", icon: Building2 },
];

const managementItems = [
  { title: "Team", url: "/team", icon: Users },
  { title: "Settings", url: "/settings", icon: Settings },
];

const adminItems = [
  { title: "Admin Dashboard", url: "/admin", icon: Shield },
  { title: "User Management", url: "/admin/users", icon: UserCog },
  { title: "Audit Logs", url: "/admin/audit-logs", icon: ScrollText },
  { title: "Organization", url: "/admin/organization", icon: Building2 },
  { title: "Security", url: "/admin/security", icon: Lock },
  { title: "Wallets", url: "/admin/wallets", icon: Wallet },
  { title: "Payouts", url: "/admin/payouts", icon: DollarSign },
  { title: "Exchange Rates", url: "/admin/exchange-rates", icon: ArrowRightLeft },
  { title: "Database", url: "/admin/database", icon: Database },
];

function NavGroup({
  label,
  items,
  location,
}: {
  label: string;
  items: typeof mainMenuItems;
  location: string;
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/60 px-4 mb-1">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const isActive = location === item.url || (item.url !== '/admin' && location.startsWith(item.url + '/'));
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  className={`group relative transition-all duration-200 ${
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                  data-testid={`nav-${item.title.toLowerCase().replace(/\s/g, "-")}`}
                >
                  <Link href={item.url}>
                    <item.icon className={`h-4 w-4 transition-colors ${isActive ? "text-primary" : ""}`} />
                    <span className="truncate">{item.title}</span>
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary" />
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function CompanySwitcher() {
  const { currentCompany, companies, switchCompany, isLoading } = useCompany();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createCompanyMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/companies", { name });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      switchCompany(data.id);
      toast({ title: "Business created", description: `${data.name} has been created successfully.` });
      setIsCreateOpen(false);
      setNewCompanyName("");
    },
    onError: (error: any) => {
      toast({ title: "Failed to create business", description: error.message, variant: "destructive" });
    },
  });

  const companyInitials = (name: string) =>
    name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 px-1 py-1.5">
        <div className="h-8 w-8 rounded-lg bg-muted animate-pulse" />
        <div className="flex-1">
          <div className="h-3.5 w-20 rounded bg-muted animate-pulse mb-1" />
          <div className="h-2.5 w-14 rounded bg-muted animate-pulse" />
        </div>
      </div>
    );
  }

  if (!currentCompany) {
    return (
      <>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-3 w-full px-1 py-1.5 rounded-lg hover:bg-muted/50 transition-colors"
          data-testid="button-create-first-business"
        >
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Plus className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-medium">Create a business</p>
            <p className="text-[10px] text-muted-foreground">Get started</p>
          </div>
        </button>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Business</DialogTitle>
              <DialogDescription>Set up a new business to manage your finances.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="company-name">Business Name</Label>
                <Input
                  id="company-name"
                  placeholder="e.g., Acme Corp"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  data-testid="input-new-company-name"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button
                onClick={() => newCompanyName.trim() && createCompanyMutation.mutate(newCompanyName.trim())}
                disabled={!newCompanyName.trim() || createCompanyMutation.isPending}
                data-testid="button-confirm-create-business"
              >
                {createCompanyMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Create Business
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="flex items-center gap-3 w-full px-1 py-1.5 rounded-lg hover:bg-muted/50 transition-colors"
            data-testid="button-company-switcher"
          >
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
              {currentCompany.logo ? (
                <img src={currentCompany.logo} alt="" className="h-8 w-8 rounded-lg object-cover" />
              ) : (
                companyInitials(currentCompany.name)
              )}
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-semibold truncate">{currentCompany.name}</p>
              <p className="text-[10px] text-muted-foreground capitalize">{currentCompany.role.toLowerCase()}</p>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[--radix-dropdown-menu-trigger-width] min-w-56">
          {companies.map((company) => (
            <DropdownMenuItem
              key={company.id}
              onClick={() => switchCompany(company.id)}
              className="flex items-center gap-3 py-2"
              data-testid={`company-option-${company.id}`}
            >
              <div className="h-7 w-7 rounded-md bg-gradient-to-br from-primary/15 to-purple-500/15 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                {company.logo ? (
                  <img src={company.logo} alt="" className="h-7 w-7 rounded-md object-cover" />
                ) : (
                  companyInitials(company.name)
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{company.name}</p>
                <p className="text-[10px] text-muted-foreground capitalize">{company.role.toLowerCase()}</p>
              </div>
              {company.id === currentCompany.id && (
                <Check className="h-4 w-4 text-primary shrink-0" />
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-3 py-2"
            data-testid="button-add-new-business"
          >
            <div className="h-7 w-7 rounded-md border border-dashed border-muted-foreground/30 flex items-center justify-center shrink-0">
              <Plus className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <span className="text-sm text-muted-foreground">Add new business</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Business</DialogTitle>
            <DialogDescription>Set up a new business to manage your finances separately.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="company-name-2">Business Name</Label>
              <Input
                id="company-name-2"
                placeholder="e.g., Acme Corp"
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                data-testid="input-new-company-name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={() => newCompanyName.trim() && createCompanyMutation.mutate(newCompanyName.trim())}
              disabled={!newCompanyName.trim() || createCompanyMutation.isPending}
              data-testid="button-confirm-create-business"
            >
              {createCompanyMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Create Business
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function AppSidebar() {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

  const initials = user?.name
    ? user.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : "JD";

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <Link href="/dashboard">
          <div className="flex items-center gap-3 cursor-pointer group">
            <div className="relative">
              <img src="/spendly-logo.png" alt="Spendly" className="w-9 h-9 rounded-xl shadow-md transition-shadow group-hover:shadow-lg" />
              <div className="absolute -inset-0.5 bg-gradient-to-br from-primary/20 to-purple-500/20 rounded-xl blur opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-foreground">Spendly</span>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Finance HQ</p>
              </div>
            </div>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="py-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/60 px-4 mb-1">
            Business
          </SidebarGroupLabel>
          <SidebarGroupContent className="px-2">
            <CompanySwitcher />
          </SidebarGroupContent>
        </SidebarGroup>

        <NavGroup label="Overview" items={mainMenuItems} location={location} />
        <NavGroup label="Finance" items={financeItems} location={location} />
        <NavGroup label="Manage" items={managementItems} location={location} />

        {location.startsWith('/admin') && (
          <NavGroup label="Admin" items={adminItems} location={location} />
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted/50 transition-colors group">
          <Avatar className="h-9 w-9 ring-2 ring-primary/10 transition-all group-hover:ring-primary/20">
            {user?.photoURL && <AvatarImage src={user.photoURL} alt={user.name} />}
            <AvatarFallback className="bg-gradient-to-br from-primary/20 to-purple-500/20 text-primary font-semibold text-xs">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{user?.name || "User"}</p>
            <p className="text-[11px] text-muted-foreground truncate">{user?.role || "Member"}</p>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleLogout}
                className="p-2 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-colors"
                data-testid="button-logout"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Sign out</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
