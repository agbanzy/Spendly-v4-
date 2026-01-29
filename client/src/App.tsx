import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { QuickActions } from "@/components/quick-actions";
import { AuthProvider, useAuth } from "@/lib/auth";
import NotFound from "@/pages/not-found";

import LandingPage from "@/pages/landing";
import LoginPage from "@/pages/login";
import SignupPage from "@/pages/signup";
import Dashboard from "@/pages/dashboard";
import Transactions from "@/pages/transactions";
import Expenses from "@/pages/expenses";
import Bills from "@/pages/bills";
import Budget from "@/pages/budget";
import Cards from "@/pages/cards";
import Team from "@/pages/team";
import Settings from "@/pages/settings";
import Analytics from "@/pages/analytics";
import Reports from "@/pages/reports";
import Payroll from "@/pages/payroll";
import Invoices from "@/pages/invoices";
import Vendors from "@/pages/vendors";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }
  
  return <Component />;
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/dashboard">{() => <ProtectedRoute component={Dashboard} />}</Route>
      <Route path="/transactions">{() => <ProtectedRoute component={Transactions} />}</Route>
      <Route path="/expenses">{() => <ProtectedRoute component={Expenses} />}</Route>
      <Route path="/bills">{() => <ProtectedRoute component={Bills} />}</Route>
      <Route path="/budget">{() => <ProtectedRoute component={Budget} />}</Route>
      <Route path="/cards">{() => <ProtectedRoute component={Cards} />}</Route>
      <Route path="/team">{() => <ProtectedRoute component={Team} />}</Route>
      <Route path="/settings">{() => <ProtectedRoute component={Settings} />}</Route>
      <Route path="/analytics">{() => <ProtectedRoute component={Analytics} />}</Route>
      <Route path="/reports">{() => <ProtectedRoute component={Reports} />}</Route>
      <Route path="/payroll">{() => <ProtectedRoute component={Payroll} />}</Route>
      <Route path="/invoices">{() => <ProtectedRoute component={Invoices} />}</Route>
      <Route path="/vendors">{() => <ProtectedRoute component={Vendors} />}</Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function AppLayout() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full overflow-hidden">
        <AppSidebar />
        <SidebarInset className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between gap-4 p-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
            <div className="flex items-center gap-2">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
            </div>
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto">
            <AppRouter />
          </main>
        </SidebarInset>
        <QuickActions />
      </div>
    </SidebarProvider>
  );
}

function PublicRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated } = useAuth();
  
  if (isAuthenticated) {
    return <Redirect to="/dashboard" />;
  }
  
  return <Component />;
}

function AppContent() {
  const [location] = useLocation();
  const { isAuthenticated } = useAuth();
  
  const publicRoutes = ["/", "/login", "/signup"];
  const isPublicRoute = publicRoutes.includes(location);

  if (isPublicRoute) {
    return (
      <Switch>
        <Route path="/">{() => isAuthenticated ? <Redirect to="/dashboard" /> : <LandingPage />}</Route>
        <Route path="/login">{() => <PublicRoute component={LoginPage} />}</Route>
        <Route path="/signup">{() => <PublicRoute component={SignupPage} />}</Route>
      </Switch>
    );
  }

  return <AppLayout />;
}

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="spendly-theme">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
