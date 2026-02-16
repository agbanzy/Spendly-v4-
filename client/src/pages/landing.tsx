import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion, useInView, useScroll, useTransform } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Globe2,
  BarChart3,
  Shield,
  Users,
  Zap,
  Wallet,
  TrendingUp,
  Lock,
  Star,
  ChevronRight,
  ArrowUpRight,
  Sparkles,
  Receipt,
  PieChart,
  Building2,
  CircleDollarSign,
  MousePointerClick,
} from "lucide-react";
import { SiApple, SiGoogleplay } from "react-icons/si";
import { ThemeToggle } from "@/components/theme-toggle";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.25, 0.4, 0.25, 1] } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: [0.25, 0.4, 0.25, 1] } },
};

function AnimatedSection({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={stagger}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function FloatingOrb({ className = "", delay = 0 }: { className?: string; delay?: number }) {
  return (
    <motion.div
      className={`absolute rounded-full blur-3xl pointer-events-none ${className}`}
      animate={{
        y: [0, -20, 0],
        x: [0, 10, 0],
        scale: [1, 1.1, 1],
      }}
      transition={{
        duration: 8,
        repeat: Infinity,
        ease: "easeInOut",
        delay,
      }}
    />
  );
}

export default function LandingPage() {
  const [, setLocation] = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll();
  const heroOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.15], [1, 0.96]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const features = [
    {
      icon: CreditCard,
      title: "Virtual Cards",
      description: "Issue unlimited virtual cards with custom spending limits and merchant controls.",
      gradient: "from-violet-500/10 to-indigo-500/10",
      iconColor: "text-violet-600 dark:text-violet-400",
      iconBg: "bg-violet-500/10",
    },
    {
      icon: Globe2,
      title: "Global Payments",
      description: "Send and receive payments in 50+ currencies with competitive exchange rates.",
      gradient: "from-emerald-500/10 to-teal-500/10",
      iconColor: "text-emerald-600 dark:text-emerald-400",
      iconBg: "bg-emerald-500/10",
    },
    {
      icon: BarChart3,
      title: "Real-time Analytics",
      description: "Instant visibility into company spending with powerful dashboards and reports.",
      gradient: "from-amber-500/10 to-orange-500/10",
      iconColor: "text-amber-600 dark:text-amber-400",
      iconBg: "bg-amber-500/10",
    },
    {
      icon: Shield,
      title: "Enterprise Security",
      description: "Bank-grade encryption with multi-factor authentication and role-based access.",
      gradient: "from-rose-500/10 to-pink-500/10",
      iconColor: "text-rose-600 dark:text-rose-400",
      iconBg: "bg-rose-500/10",
    },
    {
      icon: Users,
      title: "Team Management",
      description: "Manage permissions, approval workflows, and spending policies for your team.",
      gradient: "from-cyan-500/10 to-sky-500/10",
      iconColor: "text-cyan-600 dark:text-cyan-400",
      iconBg: "bg-cyan-500/10",
    },
    {
      icon: Zap,
      title: "Automated Workflows",
      description: "Automate expense approvals, reimbursements, and accounting sync seamlessly.",
      gradient: "from-purple-500/10 to-fuchsia-500/10",
      iconColor: "text-purple-600 dark:text-purple-400",
      iconBg: "bg-purple-500/10",
    },
  ];

  const stats = [
    { value: "$2B+", label: "Processed annually", icon: CircleDollarSign },
    { value: "50+", label: "Countries supported", icon: Globe2 },
    { value: "10K+", label: "Teams trust us", icon: Users },
    { value: "99.99%", label: "Uptime SLA", icon: Zap },
  ];

  const testimonials = [
    {
      quote: "Spendly transformed how we manage expenses. What used to take days now happens in minutes.",
      author: "Sarah Chen",
      role: "CFO at TechCorp",
      avatar: "SC",
    },
    {
      quote: "The virtual cards feature alone saved us thousands in unauthorized spending.",
      author: "Michael Roberts",
      role: "Finance Director at GlobalScale",
      avatar: "MR",
    },
    {
      quote: "Finally, a platform that understands the needs of high-growth teams.",
      author: "Emily Davis",
      role: "COO at StartupHub",
      avatar: "ED",
    },
  ];

  const bentoItems = [
    {
      title: "Expense Tracking",
      description: "Auto-categorize and track every expense in real time",
      icon: Receipt,
      span: "md:col-span-2",
      gradient: "from-violet-600 to-indigo-600",
    },
    {
      title: "Budget Control",
      description: "Set limits and get alerts before overspending",
      icon: PieChart,
      span: "md:col-span-1",
      gradient: "from-emerald-600 to-teal-600",
    },
    {
      title: "Smart Payroll",
      description: "Manage salaries, bonuses, and deductions in one place",
      icon: CircleDollarSign,
      span: "md:col-span-1",
      gradient: "from-amber-600 to-orange-600",
    },
    {
      title: "Invoicing",
      description: "Create, send, and track professional invoices effortlessly",
      icon: Building2,
      span: "md:col-span-2",
      gradient: "from-rose-600 to-pink-600",
    },
  ];

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* ═══ NAVBAR ═══ */}
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
              <span className="flex items-center gap-2.5 font-bold text-xl group" data-testid="link-logo">
                <div className="relative">
                  <img src="/spendly-logo.png" alt="Spendly" className="h-9 w-9 rounded-xl shadow-md group-hover:shadow-lg transition-shadow" />
                  <div className="absolute -inset-0.5 bg-gradient-to-br from-primary/30 to-purple-500/30 rounded-xl blur opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <span className="tracking-tight">Spendly</span>
              </span>
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              {["Features", "How it works", "Testimonials"].map((item) => (
                <a
                  key={item}
                  href={`#${item.toLowerCase().replace(/\s+/g, "-")}`}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-lg hover:bg-muted/50"
                >
                  {item}
                </a>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" onClick={() => setLocation("/login")} className="hidden sm:flex" data-testid="button-login">
              Log in
            </Button>
            <Button onClick={() => setLocation("/signup")} className="gap-2 shadow-md shadow-primary/20" data-testid="button-signup">
              Get Started <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* ═══ HERO ═══ */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-32 overflow-hidden" ref={heroRef}>
        {/* Background effects */}
        <FloatingOrb className="w-[600px] h-[600px] bg-primary/8 -top-48 -right-48" />
        <FloatingOrb className="w-[400px] h-[400px] bg-purple-500/6 top-1/2 -left-32" delay={2} />
        <FloatingOrb className="w-[300px] h-[300px] bg-emerald-500/6 bottom-0 right-1/4" delay={4} />

        {/* Grid overlay */}
        <div className="absolute inset-0 texture-grid opacity-50" />

        <motion.div style={{ opacity: heroOpacity, scale: heroScale }} className="container relative mx-auto px-4 md:px-6">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={stagger}
            className="mx-auto max-w-4xl text-center"
          >
            <motion.div variants={fadeUp}>
              <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-sm font-medium gap-2 bg-primary/5 border-primary/10 text-primary hover:bg-primary/10 transition-colors">
                <Sparkles className="h-3.5 w-3.5" />
                Trusted by 10,000+ teams worldwide
              </Badge>
            </motion.div>

            <motion.h1 variants={fadeUp} className="mb-6 text-4xl font-extrabold tracking-tight sm:text-5xl md:text-7xl leading-[1.08]" data-testid="text-hero-title">
              The Financial{" "}
              <br className="hidden sm:block" />
              Operating System for{" "}
              <span className="gradient-text">
                High-Growth Teams
              </span>
            </motion.h1>

            <motion.p variants={fadeUp} className="mb-10 text-lg text-muted-foreground md:text-xl max-w-2xl mx-auto leading-relaxed">
              Manage expenses, issue virtual cards, automate payouts, and gain real-time
              visibility into your company's spending — all in one powerful platform.
            </motion.p>

            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" onClick={() => setLocation("/signup")} className="gap-2 h-12 px-8 text-base shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all" data-testid="button-get-started">
                Start for Free <ArrowRight className="h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" className="gap-2 h-12 px-8 text-base" data-testid="button-demo">
                <MousePointerClick className="h-4 w-4" />
                Book a Demo
              </Button>
            </motion.div>

            <motion.div variants={fadeUp} className="mt-8 flex items-center justify-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Free 14-day trial</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> No credit card needed</span>
              <span className="hidden sm:flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Cancel anytime</span>
            </motion.div>
          </motion.div>

          {/* Hero visual — Dashboard preview card */}
          <motion.div
            variants={scaleIn}
            initial="hidden"
            animate="visible"
            className="mt-16 md:mt-20 mx-auto max-w-5xl"
          >
            <div className="relative rounded-2xl border bg-card/80 backdrop-blur-sm shadow-2xl shadow-primary/5 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-primary/3 to-transparent pointer-events-none" />
              {/* Mock dashboard header */}
              <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400/80" />
                  <div className="w-3 h-3 rounded-full bg-amber-400/80" />
                  <div className="w-3 h-3 rounded-full bg-emerald-400/80" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="px-4 py-1 rounded-lg bg-muted/50 text-xs text-muted-foreground">dashboard.spendlymanager.com</div>
                </div>
              </div>
              {/* Mock dashboard content */}
              <div className="p-6 md:p-8 space-y-6">
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: "Total Balance", value: "$284,592", change: "+12.5%", color: "text-emerald-500" },
                    { label: "Monthly Spend", value: "$42,380", change: "-3.2%", color: "text-rose-500" },
                    { label: "Active Cards", value: "24", change: "+4", color: "text-primary" },
                  ].map((item, i) => (
                    <div key={i} className="p-4 rounded-xl bg-muted/40 border border-border/50">
                      <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                      <p className="text-xl md:text-2xl font-bold">{item.value}</p>
                      <span className={`text-xs font-medium ${item.color}`}>{item.change}</span>
                    </div>
                  ))}
                </div>
                {/* Mock chart bars */}
                <div className="flex items-end gap-2 h-32 px-4">
                  {[40, 65, 45, 80, 55, 70, 90, 60, 75, 50, 85, 95].map((h, i) => (
                    <motion.div
                      key={i}
                      className="flex-1 rounded-t-md bg-gradient-to-t from-primary/60 to-primary/20"
                      initial={{ height: 0 }}
                      animate={{ height: `${h}%` }}
                      transition={{ delay: 0.8 + i * 0.05, duration: 0.5, ease: "easeOut" }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* ═══ STATS ═══ */}
      <AnimatedSection>
        <section className="border-y bg-muted/20 py-16">
          <div className="container mx-auto px-4 md:px-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
              {stats.map((stat, index) => (
                <motion.div key={index} variants={fadeUp} className="text-center group">
                  <div className="inline-flex p-3 rounded-2xl bg-primary/5 mb-3 group-hover:bg-primary/10 transition-colors">
                    <stat.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="text-3xl md:text-4xl font-extrabold tracking-tight gradient-text" data-testid={`text-stat-${index}`}>
                    {stat.value}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      </AnimatedSection>

      {/* ═══ FEATURES BENTO GRID ═══ */}
      <AnimatedSection>
        <section id="features" className="py-24 md:py-32">
          <div className="container mx-auto px-4 md:px-6">
            <motion.div variants={fadeUp} className="text-center mb-16">
              <Badge variant="secondary" className="mb-4 gap-1.5 bg-primary/5 text-primary border-primary/10">
                <Zap className="h-3 w-3" /> Features
              </Badge>
              <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-4" data-testid="text-features-title">
                Everything you need to{" "}
                <span className="gradient-text">manage spend</span>
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                From expense tracking to virtual cards, Spendly gives you complete control
                over your company's finances.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {features.map((feature, index) => (
                <motion.div key={index} variants={fadeUp}>
                  <Card className={`group card-hover border bg-gradient-to-br ${feature.gradient} h-full`} data-testid={`card-feature-${index}`}>
                    <CardContent className="p-6 md:p-8">
                      <div className={`inline-flex p-3 rounded-2xl ${feature.iconBg} mb-5`}>
                        <feature.icon className={`h-6 w-6 ${feature.iconColor}`} />
                      </div>
                      <h3 className="text-lg font-bold mb-2 group-hover:text-primary transition-colors">{feature.title}</h3>
                      <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      </AnimatedSection>

      {/* ═══ HOW IT WORKS — BENTO ═══ */}
      <AnimatedSection>
        <section id="how-it-works" className="py-24 md:py-32 bg-muted/20">
          <div className="container mx-auto px-4 md:px-6">
            <motion.div variants={fadeUp} className="text-center mb-16">
              <Badge variant="secondary" className="mb-4 gap-1.5 bg-primary/5 text-primary border-primary/10">
                <MousePointerClick className="h-3 w-3" /> Platform
              </Badge>
              <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-4">
                One platform,{" "}
                <span className="gradient-text">infinite control</span>
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Everything you need to run your finances — beautifully integrated.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-4">
              {bentoItems.map((item, index) => (
                <motion.div key={index} variants={fadeUp} className={item.span}>
                  <div className="bento-card group relative h-full rounded-2xl border bg-card p-6 md:p-8 overflow-hidden card-hover">
                    <div className={`absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl ${item.gradient} opacity-5 rounded-full blur-3xl group-hover:opacity-10 transition-opacity`} />
                    <div className="relative z-10">
                      <div className={`inline-flex p-3 rounded-2xl bg-gradient-to-br ${item.gradient} text-white mb-5 shadow-lg`}>
                        <item.icon className="h-6 w-6" />
                      </div>
                      <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                      <p className="text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      </AnimatedSection>

      {/* ═══ VIRTUAL CARD SHOWCASE ═══ */}
      <AnimatedSection>
        <section className="py-24 md:py-32">
          <div className="container mx-auto px-4 md:px-6">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <motion.div variants={fadeUp}>
                <Badge variant="secondary" className="mb-4 gap-1.5 bg-primary/5 text-primary border-primary/10">
                  <CreditCard className="h-3 w-3" /> Virtual Cards
                </Badge>
                <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-4">
                  Issue cards in{" "}
                  <span className="gradient-text">seconds</span>, not days
                </h2>
                <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                  Create unlimited virtual cards with custom spending limits, merchant
                  restrictions, and expiration dates. Perfect for subscriptions, marketing
                  spend, and team purchases.
                </p>
                <ul className="space-y-4 mb-8">
                  {[
                    "Instant card creation with custom limits",
                    "Real-time transaction notifications",
                    "Freeze or cancel cards instantly",
                    "Detailed spending analytics per card",
                  ].map((item, index) => (
                    <li key={index} className="flex items-center gap-3 text-sm">
                      <div className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <Button variant="outline" className="gap-2">
                  Learn more <ChevronRight className="h-4 w-4" />
                </Button>
              </motion.div>

              <motion.div variants={scaleIn} className="relative flex justify-center">
                {/* Glow behind card */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-purple-500/20 rounded-full blur-[80px]" />

                {/* Card */}
                <div className="relative">
                  <motion.div
                    className="w-full max-w-[380px] aspect-[1.6/1] rounded-2xl p-6 md:p-8 text-white shadow-2xl overflow-hidden"
                    style={{
                      background: "linear-gradient(135deg, hsl(250 89% 55%), hsl(280 65% 55%), hsl(250 89% 45%))",
                    }}
                    whileHover={{ rotateY: -5, rotateX: 5 }}
                    transition={{ type: "spring", stiffness: 200 }}
                  >
                    <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_top_right,_white_0%,_transparent_60%)]" />
                    <div className="relative z-10 flex flex-col justify-between h-full">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-xs font-medium opacity-70 tracking-wider uppercase">Marketing Team</div>
                          <div className="text-2xl font-bold mt-1">$8,500.00</div>
                        </div>
                        <CreditCard className="h-8 w-8 opacity-60" />
                      </div>
                      <div>
                        <div className="text-lg tracking-[0.25em] mb-4 font-mono opacity-90">•••• •••• •••• 4532</div>
                        <div className="flex justify-between text-xs">
                          <div>
                            <div className="opacity-50 uppercase tracking-wider">Card Holder</div>
                            <div className="font-medium mt-0.5">Sarah Chen</div>
                          </div>
                          <div className="text-right">
                            <div className="opacity-50 uppercase tracking-wider">Expires</div>
                            <div className="font-medium mt-0.5">12/28</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  {/* Floating badges */}
                  <motion.div
                    className="absolute -top-4 -right-4 px-3 py-2 rounded-xl bg-card border shadow-lg text-xs font-medium flex items-center gap-2"
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Active
                  </motion.div>

                  <motion.div
                    className="absolute -bottom-3 -left-3 px-3 py-2 rounded-xl bg-card border shadow-lg text-xs font-medium flex items-center gap-2"
                    animate={{ y: [0, 6, 0] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                  >
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400">-12% vs last month</span>
                  </motion.div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>
      </AnimatedSection>

      {/* ═══ TESTIMONIALS ═══ */}
      <AnimatedSection>
        <section id="testimonials" className="py-24 md:py-32 bg-muted/20">
          <div className="container mx-auto px-4 md:px-6">
            <motion.div variants={fadeUp} className="text-center mb-16">
              <Badge variant="secondary" className="mb-4 gap-1.5 bg-primary/5 text-primary border-primary/10">
                <Star className="h-3 w-3" /> Testimonials
              </Badge>
              <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-4">
                Loved by{" "}
                <span className="gradient-text">finance teams</span>
              </h2>
              <p className="text-lg text-muted-foreground">
                See why thousands of companies trust Spendly for expense management.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-6">
              {testimonials.map((testimonial, index) => (
                <motion.div key={index} variants={fadeUp}>
                  <Card className="card-hover h-full bg-card" data-testid={`card-testimonial-${index}`}>
                    <CardContent className="p-6 md:p-8">
                      <div className="flex gap-1 mb-5">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                        ))}
                      </div>
                      <p className="text-foreground leading-relaxed mb-6">"{testimonial.quote}"</p>
                      <div className="flex items-center gap-3 pt-4 border-t">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center text-primary font-semibold text-sm">
                          {testimonial.avatar}
                        </div>
                        <div>
                          <div className="font-semibold text-sm">{testimonial.author}</div>
                          <div className="text-xs text-muted-foreground">{testimonial.role}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      </AnimatedSection>

      {/* ═══ CTA ═══ */}
      <AnimatedSection>
        <section className="py-24 md:py-32 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-purple-500/5" />
          <FloatingOrb className="w-[500px] h-[500px] bg-primary/8 -top-48 -left-48" />
          <FloatingOrb className="w-[400px] h-[400px] bg-purple-500/6 -bottom-32 -right-32" delay={3} />

          <motion.div variants={fadeUp} className="container relative mx-auto px-4 md:px-6 text-center">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-6">
                Ready to transform your{" "}
                <span className="gradient-text">expense management</span>?
              </h2>
              <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto">
                Join thousands of companies that trust Spendly to manage their finances.
                Get started today — it's free.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button size="lg" onClick={() => setLocation("/signup")} className="gap-2 h-12 px-8 text-base shadow-lg shadow-primary/25">
                  Get Started Free <ArrowRight className="h-4 w-4" />
                </Button>
                <Button size="lg" variant="outline" className="gap-2 h-12 px-8 text-base">
                  Schedule Demo
                </Button>
              </div>
            </div>
          </motion.div>
        </section>
      </AnimatedSection>

      {/* ═══ FOOTER ═══ */}
      <footer className="border-t py-16 bg-card/50">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 md:gap-12">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2.5 font-bold text-lg mb-4">
                <img src="/spendly-logo.png" alt="Spendly" className="h-7 w-7 rounded-lg" />
                Spendly
              </div>
              <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                The financial operating system for high-growth teams.
              </p>
              <a href="https://spendlymanager.com" target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline" data-testid="link-website">
                spendlymanager.com
              </a>
            </div>
            <div>
              <div className="font-semibold mb-4 text-sm">Product</div>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground transition-colors">Virtual Cards</a></li>
                <li><a href="#features" className="hover:text-foreground transition-colors">Expense Management</a></li>
                <li><a href="#features" className="hover:text-foreground transition-colors">Global Payments</a></li>
                <li><a href="#features" className="hover:text-foreground transition-colors">Analytics</a></li>
              </ul>
            </div>
            <div>
              <div className="font-semibold mb-4 text-sm">Company</div>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li><a href="#testimonials" className="hover:text-foreground transition-colors">About</a></li>
                <li><a href="#testimonials" className="hover:text-foreground transition-colors">Blog</a></li>
                <li><a href="#features" className="hover:text-foreground transition-colors">Features</a></li>
                <li><Link href="/signup"><span className="hover:text-foreground transition-colors cursor-pointer">Get Started</span></Link></li>
              </ul>
            </div>
            <div>
              <div className="font-semibold mb-4 text-sm">Legal</div>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li><Link href="/privacy"><span className="hover:text-foreground transition-colors cursor-pointer">Privacy Policy</span></Link></li>
                <li><Link href="/terms"><span className="hover:text-foreground transition-colors cursor-pointer">Terms of Service</span></Link></li>
                <li><Link href="/privacy"><span className="hover:text-foreground transition-colors cursor-pointer">Cookie Policy</span></Link></li>
              </ul>
            </div>
            <div>
              <div className="font-semibold mb-4 text-sm">Mobile Apps</div>
              <div className="space-y-3">
                <a
                  href="https://apps.apple.com/app/spendly-expense-manager"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 px-3 py-2.5 bg-foreground text-background rounded-xl hover:opacity-90 transition-opacity"
                  data-testid="link-app-store"
                >
                  <SiApple className="h-5 w-5" />
                  <div className="text-xs">
                    <div className="opacity-70">Download on the</div>
                    <div className="font-semibold">App Store</div>
                  </div>
                </a>
                <a
                  href="https://play.google.com/store/apps/details?id=com.spendly.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 px-3 py-2.5 bg-foreground text-background rounded-xl hover:opacity-90 transition-opacity"
                  data-testid="link-play-store"
                >
                  <SiGoogleplay className="h-5 w-5" />
                  <div className="text-xs">
                    <div className="opacity-70">Get it on</div>
                    <div className="font-semibold">Google Play</div>
                  </div>
                </a>
              </div>
            </div>
          </div>
          <div className="border-t mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              © 2026 Spendly Manager. All rights reserved. | <a href="https://spendlymanager.com" className="text-primary hover:underline">spendlymanager.com</a>
            </p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <Lock className="h-4 w-4" />
              <span>Bank-grade security</span>
              <span>•</span>
              <span>SOC 2 Compliant</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
