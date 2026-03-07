import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  ArrowRight,
  CreditCard,
  Globe,
  Receipt,
  FileText,
  Users,
  FileCheck,
  Shield,
  Lock,
  TrendingUp,
  Banknote,
  Menu,
  X,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

/* ──────────────────────────────────────────────
   Scroll-reveal hook using IntersectionObserver
   ────────────────────────────────────────────── */
function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) { setIsVisible(true); return; }

    // Check if already in viewport on mount
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
    );

    observer.observe(el);

    // Fallback: reveal after 2s in case observer never fires
    const timeout = setTimeout(() => setIsVisible(true), 2000);

    return () => { observer.disconnect(); clearTimeout(timeout); };
  }, []);

  return { ref, isVisible };
}

function RevealSection({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { ref, isVisible } = useScrollReveal();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      } ${className}`}
    >
      {children}
    </div>
  );
}

/* ──────────────────────────────────────────────
   Landing Page
   ────────────────────────────────────────────── */
export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) setMobileMenuOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);

  /* ── Data ── */
  const features = [
    {
      icon: CreditCard,
      title: "Virtual Cards",
      description:
        "Issue unlimited virtual cards with custom spending limits, merchant restrictions, and real-time controls.",
    },
    {
      icon: Globe,
      title: "Global Payments",
      description:
        "Send and receive payments in 50+ currencies with competitive exchange rates and same-day settlement.",
    },
    {
      icon: Receipt,
      title: "Expense Management",
      description:
        "Automate expense tracking, receipt capture, and approval workflows to eliminate manual work.",
    },
    {
      icon: FileText,
      title: "Bill Payments",
      description:
        "Schedule and automate vendor payments with smart due-date reminders and batch processing.",
    },
    {
      icon: Users,
      title: "Payroll",
      description:
        "Run payroll across multiple countries with tax compliance, deductions, and direct deposit built in.",
    },
    {
      icon: FileCheck,
      title: "Invoicing",
      description:
        "Create, send, and track professional invoices with automated reminders and online payment collection.",
    },
  ];

  const stats = [
    { value: "$2B+", label: "Processed" },
    { value: "50+", label: "Countries" },
    { value: "10,000+", label: "Teams" },
    { value: "99.99%", label: "Uptime" },
  ];

  const testimonials = [
    {
      quote:
        "Financiar transformed how we manage our treasury operations. The visibility into cash flow across entities is exceptional.",
      author: "Sarah Chen",
      role: "CFO",
      company: "Meridian Capital",
    },
    {
      quote:
        "The virtual cards and approval workflows alone saved our finance team 20 hours a week. Implementation was seamless.",
      author: "Michael Roberts",
      role: "VP Finance",
      company: "Atlas Ventures",
    },
    {
      quote:
        "We evaluated six platforms before choosing Financiar. The depth of controls and reporting is unmatched for our scale.",
      author: "Emily Nakamura",
      role: "Head of Operations",
      company: "Cerulean Group",
    },
  ];

  const steps = [
    {
      step: "1",
      title: "Sign Up & Verify",
      description:
        "Create your account in minutes. Complete KYC verification with our streamlined onboarding process.",
    },
    {
      step: "2",
      title: "Fund & Configure",
      description:
        "Connect your bank accounts, set spending policies, and configure approval workflows for your team.",
    },
    {
      step: "3",
      title: "Manage & Scale",
      description:
        "Issue cards, process payments, and gain real-time visibility into every dollar across your organization.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* ════════════════════════════════════════
          NAVIGATION
         ════════════════════════════════════════ */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-background/80 backdrop-blur-xl border-b shadow-sm"
            : "bg-transparent"
        }`}
      >
        <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-8">
            <Link href="/">
              <span className="flex items-center">
                <img
                  src="/financiar-logo.svg"
                  className="h-9"
                  alt="Financiar"
                />
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              {["Features", "Solutions", "About"].map((item) => (
                <a
                  key={item}
                  href={`#${item.toLowerCase()}`}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-lg"
                >
                  {item}
                </a>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/login">
              <Button variant="ghost" className="hidden sm:inline-flex text-sm">
                Log In
              </Button>
            </Link>
            <Link href="/signup">
              <Button className="hidden sm:inline-flex text-sm">
                Get Started
              </Button>
            </Link>

            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t bg-background/95 backdrop-blur-xl">
            <div className="container mx-auto px-4 py-4 space-y-3">
              {["Features", "Solutions", "About"].map((item) => (
                <a
                  key={item}
                  href={`#${item.toLowerCase()}`}
                  className="block text-sm text-muted-foreground hover:text-foreground py-2"
                  onClick={closeMobileMenu}
                >
                  {item}
                </a>
              ))}
              <Separator />
              <div className="flex flex-col gap-2 pt-2">
                <Link href="/login" onClick={closeMobileMenu}>
                  <Button variant="ghost" className="w-full justify-start">
                    Log In
                  </Button>
                </Link>
                <Link href="/signup" onClick={closeMobileMenu}>
                  <Button className="w-full">Get Started</Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* ════════════════════════════════════════
          HERO
         ════════════════════════════════════════ */}
      <section className="relative pt-32 pb-20 md:pt-44 md:pb-32">
        <div className="container mx-auto px-4 md:px-6">
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl tracking-tight leading-[1.1] mb-6 text-foreground">
              The Financial Operating System for Modern Businesses
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed font-sans">
              Manage expenses, issue virtual cards, process global payments, and
              gain complete visibility into your company finances — all from one
              elegant platform.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <Link href="/signup">
                <Button
                  size="lg"
                  className="h-12 px-8 text-base gap-2 shadow-lg"
                >
                  Start Free Trial
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Button
                size="lg"
                variant="outline"
                className="h-12 px-8 text-base"
              >
                Book a Demo
              </Button>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                Bank-grade encryption
              </span>
              <span className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" />
                50+ currencies
              </span>
              <span className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-primary" />
                SOC 2 compliant
              </span>
            </div>
          </div>

          {/* Dashboard mockup */}
          <RevealSection className="mt-16 md:mt-20 mx-auto max-w-5xl">
            <div className="rounded-2xl border bg-card shadow-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-muted-foreground/20" />
                  <div className="w-3 h-3 rounded-full bg-muted-foreground/20" />
                  <div className="w-3 h-3 rounded-full bg-muted-foreground/20" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="px-4 py-1 rounded-md bg-muted/50 text-xs text-muted-foreground font-mono">
                    app.financiar.com/dashboard
                  </div>
                </div>
              </div>

              <div className="p-6 md:p-8 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    {
                      label: "Total Balance",
                      value: "$284,592.00",
                      change: "+12.5%",
                      positive: true,
                    },
                    {
                      label: "Monthly Spend",
                      value: "$42,380.00",
                      change: "-3.2%",
                      positive: false,
                    },
                    {
                      label: "Active Cards",
                      value: "24",
                      change: "+4 this month",
                      positive: true,
                    },
                  ].map((item, i) => (
                    <div
                      key={i}
                      className="p-4 rounded-xl border bg-background"
                    >
                      <p className="text-xs text-muted-foreground mb-1 font-sans">
                        {item.label}
                      </p>
                      <p className="text-xl md:text-2xl font-display font-bold tracking-tight">
                        {item.value}
                      </p>
                      <span
                        className={`text-xs font-medium ${
                          item.positive
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {item.change}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex items-end gap-2 h-28 px-2">
                  {[35, 55, 40, 70, 50, 65, 85, 55, 70, 45, 75, 90].map(
                    (h, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-t bg-primary/20 transition-all duration-500"
                        style={{ height: `${h}%` }}
                      />
                    )
                  )}
                </div>
              </div>
            </div>
          </RevealSection>
        </div>
      </section>

      {/* ════════════════════════════════════════
          LOGO CLOUD
         ════════════════════════════════════════ */}
      <RevealSection>
        <section className="py-12 border-y bg-muted/20">
          <div className="container mx-auto px-4 md:px-6">
            <p className="text-center text-xs uppercase tracking-widest text-muted-foreground mb-8 font-sans">
              Trusted by leading companies
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
              {["Stripe", "Visa", "Mastercard", "Paystack"].map((name) => (
                <span
                  key={name}
                  className="text-lg md:text-xl font-display font-semibold text-muted-foreground/40 select-none"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        </section>
      </RevealSection>

      {/* ════════════════════════════════════════
          FEATURES GRID
         ════════════════════════════════════════ */}
      <RevealSection>
        <section id="features" className="py-24 md:py-32">
          <div className="container mx-auto px-4 md:px-6">
            <div className="text-center mb-16">
              <h2 className="font-display text-3xl md:text-4xl lg:text-5xl tracking-tight mb-4">
                Everything your finance team needs
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto font-sans">
                A comprehensive suite of tools to manage, control, and optimize
                every aspect of your business finances.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature, index) => (
                <RevealSection key={index}>
                  <Card className="h-full border bg-card hover:border-primary/20 transition-colors duration-300">
                    <CardContent className="p-6 md:p-8">
                      <div className="inline-flex p-3 rounded-xl bg-primary/5 mb-5">
                        <feature.icon className="h-5 w-5 text-primary" />
                      </div>
                      <h3 className="font-display text-lg font-semibold mb-2">
                        {feature.title}
                      </h3>
                      <p className="text-muted-foreground text-sm leading-relaxed font-sans">
                        {feature.description}
                      </p>
                    </CardContent>
                  </Card>
                </RevealSection>
              ))}
            </div>
          </div>
        </section>
      </RevealSection>

      {/* ════════════════════════════════════════
          PRODUCT SHOWCASE
         ════════════════════════════════════════ */}
      <RevealSection>
        <section id="solutions" className="py-24 md:py-32 bg-muted/20">
          <div className="container mx-auto px-4 md:px-6">
            <div className="text-center mb-16">
              <h2 className="font-display text-3xl md:text-4xl lg:text-5xl tracking-tight mb-4">
                Built for clarity and control
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto font-sans">
                A clean, intuitive dashboard that gives you instant visibility
                into your financial operations.
              </p>
            </div>

            <div className="mx-auto max-w-5xl">
              <Card className="border bg-card overflow-hidden">
                <CardContent className="p-0">
                  <div className="p-6 md:p-8">
                    <div className="grid md:grid-cols-3 gap-6 mb-8">
                      <div className="md:col-span-1 p-5 rounded-xl border bg-primary/5">
                        <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-sans">
                          Available Balance
                        </p>
                        <p className="text-3xl font-display font-bold tracking-tight text-foreground">
                          $284,592
                        </p>
                        <div className="flex items-center gap-1 mt-2 text-xs text-emerald-600 dark:text-emerald-400 font-sans">
                          <TrendingUp className="h-3 w-3" />
                          <span>+12.5% from last month</span>
                        </div>
                      </div>

                      <div className="md:col-span-2 p-5 rounded-xl border">
                        <p className="text-xs text-muted-foreground mb-4 uppercase tracking-wider font-sans">
                          Monthly Spending
                        </p>
                        <div className="flex items-end gap-3 h-20">
                          {[
                            { month: "Jul", h: 45 },
                            { month: "Aug", h: 60 },
                            { month: "Sep", h: 40 },
                            { month: "Oct", h: 75 },
                            { month: "Nov", h: 55 },
                            { month: "Dec", h: 65 },
                            { month: "Jan", h: 50 },
                            { month: "Feb", h: 80 },
                          ].map((bar, i) => (
                            <div
                              key={i}
                              className="flex-1 flex flex-col items-center gap-1"
                            >
                              <div
                                className="w-full rounded-sm bg-primary/15"
                                style={{ height: `${bar.h}%` }}
                              />
                              <span className="text-[10px] text-muted-foreground font-sans">
                                {bar.month}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border">
                      <div className="px-5 py-3 border-b">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-sans">
                          Recent Transactions
                        </p>
                      </div>
                      <div className="divide-y">
                        {[
                          {
                            name: "AWS Cloud Services",
                            category: "Infrastructure",
                            amount: "-$4,250.00",
                            date: "Today",
                          },
                          {
                            name: "Adobe Creative Cloud",
                            category: "Software",
                            amount: "-$599.00",
                            date: "Yesterday",
                          },
                          {
                            name: "Client Payment — Meridian",
                            category: "Revenue",
                            amount: "+$12,800.00",
                            date: "Mar 3",
                          },
                          {
                            name: "Office Supplies Co.",
                            category: "Operations",
                            amount: "-$342.50",
                            date: "Mar 2",
                          },
                        ].map((tx, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between px-5 py-3"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                                <Banknote className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div>
                                <p className="text-sm font-medium font-sans">
                                  {tx.name}
                                </p>
                                <p className="text-xs text-muted-foreground font-sans">
                                  {tx.category}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p
                                className={`text-sm font-medium font-mono ${
                                  tx.amount.startsWith("+")
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-foreground"
                                }`}
                              >
                                {tx.amount}
                              </p>
                              <p className="text-xs text-muted-foreground font-sans">
                                {tx.date}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </RevealSection>

      {/* ════════════════════════════════════════
          HOW IT WORKS
         ════════════════════════════════════════ */}
      <RevealSection>
        <section className="py-24 md:py-32">
          <div className="container mx-auto px-4 md:px-6">
            <div className="text-center mb-16">
              <h2 className="font-display text-3xl md:text-4xl lg:text-5xl tracking-tight mb-4">
                Get started in three steps
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto font-sans">
                From sign-up to full financial control in under 24 hours.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 md:gap-12 max-w-4xl mx-auto">
              {steps.map((item, index) => (
                <RevealSection key={index}>
                  <div className="text-center md:text-left">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full border-2 border-primary text-primary font-display text-lg font-bold mb-5">
                      {item.step}
                    </div>
                    <h3 className="font-display text-lg font-semibold mb-2">
                      {item.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed font-sans">
                      {item.description}
                    </p>
                  </div>
                </RevealSection>
              ))}
            </div>
          </div>
        </section>
      </RevealSection>

      {/* ════════════════════════════════════════
          STATS
         ════════════════════════════════════════ */}
      <RevealSection>
        <section className="py-20 border-y bg-muted/20">
          <div className="container mx-auto px-4 md:px-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
              {stats.map((stat, index) => (
                <div key={index} className="text-center">
                  <div className="font-display text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-foreground mb-1">
                    {stat.value}
                  </div>
                  <div className="text-sm text-muted-foreground font-sans">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </RevealSection>

      {/* ════════════════════════════════════════
          TESTIMONIALS
         ════════════════════════════════════════ */}
      <RevealSection>
        <section id="about" className="py-24 md:py-32">
          <div className="container mx-auto px-4 md:px-6">
            <div className="text-center mb-16">
              <h2 className="font-display text-3xl md:text-4xl lg:text-5xl tracking-tight mb-4">
                Trusted by finance leaders
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto font-sans">
                Hear from the teams building the future of business finance.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {testimonials.map((t, index) => (
                <RevealSection key={index}>
                  <Card className="h-full border bg-card">
                    <CardContent className="p-6 md:p-8 flex flex-col h-full">
                      <p className="text-foreground leading-relaxed mb-6 flex-1 font-sans">
                        &ldquo;{t.quote}&rdquo;
                      </p>
                      <div className="pt-4 border-t">
                        <p className="font-semibold text-sm font-sans">
                          {t.author}
                        </p>
                        <p className="text-xs text-muted-foreground font-sans">
                          {t.role}, {t.company}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </RevealSection>
              ))}
            </div>
          </div>
        </section>
      </RevealSection>

      {/* ════════════════════════════════════════
          CTA
         ════════════════════════════════════════ */}
      <RevealSection>
        <section className="py-24 md:py-32 bg-primary/[0.03]">
          <div className="container mx-auto px-4 md:px-6 text-center">
            <div className="max-w-2xl mx-auto">
              <h2 className="font-display text-3xl md:text-4xl lg:text-5xl tracking-tight mb-6">
                Ready to transform your business finances?
              </h2>
              <p className="text-lg text-muted-foreground mb-10 font-sans">
                Join thousands of companies that rely on Financiar to manage,
                control, and grow their financial operations.
              </p>
              <Link href="/signup">
                <Button
                  size="lg"
                  className="h-12 px-8 text-base gap-2 shadow-lg"
                >
                  Get Started Free
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </RevealSection>

      {/* ════════════════════════════════════════
          FOOTER
         ════════════════════════════════════════ */}
      <footer className="border-t py-16 bg-card/50">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 md:gap-12">
            <div className="col-span-2 md:col-span-1">
              <div className="mb-4">
                <img
                  src="/financiar-logo.svg"
                  className="h-7"
                  alt="Financiar"
                />
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed font-sans">
                The financial operating system for modern businesses.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-sm mb-4 font-sans">Product</h4>
              <ul className="space-y-2.5 text-sm text-muted-foreground font-sans">
                <li>
                  <a
                    href="#features"
                    className="hover:text-foreground transition-colors"
                  >
                    Virtual Cards
                  </a>
                </li>
                <li>
                  <a
                    href="#features"
                    className="hover:text-foreground transition-colors"
                  >
                    Payments
                  </a>
                </li>
                <li>
                  <a
                    href="#features"
                    className="hover:text-foreground transition-colors"
                  >
                    Expense Management
                  </a>
                </li>
                <li>
                  <a
                    href="#features"
                    className="hover:text-foreground transition-colors"
                  >
                    Invoicing
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-sm mb-4 font-sans">Company</h4>
              <ul className="space-y-2.5 text-sm text-muted-foreground font-sans">
                <li>
                  <a
                    href="#about"
                    className="hover:text-foreground transition-colors"
                  >
                    About
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="hover:text-foreground transition-colors"
                  >
                    Careers
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="hover:text-foreground transition-colors"
                  >
                    Blog
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="hover:text-foreground transition-colors"
                  >
                    Press
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-sm mb-4 font-sans">Legal</h4>
              <ul className="space-y-2.5 text-sm text-muted-foreground font-sans">
                <li>
                  <Link href="/privacy">
                    <span className="hover:text-foreground transition-colors cursor-pointer">
                      Privacy Policy
                    </span>
                  </Link>
                </li>
                <li>
                  <Link href="/terms">
                    <span className="hover:text-foreground transition-colors cursor-pointer">
                      Terms of Service
                    </span>
                  </Link>
                </li>
                <li>
                  <Link href="/privacy">
                    <span className="hover:text-foreground transition-colors cursor-pointer">
                      Cookie Policy
                    </span>
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-sm mb-4 font-sans">Support</h4>
              <ul className="space-y-2.5 text-sm text-muted-foreground font-sans">
                <li>
                  <a
                    href="#"
                    className="hover:text-foreground transition-colors"
                  >
                    Help Center
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="hover:text-foreground transition-colors"
                  >
                    Documentation
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="hover:text-foreground transition-colors"
                  >
                    API Reference
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="hover:text-foreground transition-colors"
                  >
                    Contact
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <Separator className="my-12" />

          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground font-sans">
              &copy; 2026 Financiar. All rights reserved.
            </p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground font-sans">
              <Lock className="h-3.5 w-3.5" />
              <span>Bank-grade security</span>
              <span className="text-border">|</span>
              <span>SOC 2 Compliant</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
