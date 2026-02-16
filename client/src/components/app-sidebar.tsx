import { useLocation, Link } from "wouter";
import { useAuth } from "@/lib/auth";
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
