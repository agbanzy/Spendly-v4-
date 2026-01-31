import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowRight, 
  CheckCircle2, 
  CreditCard, 
  Globe2, 
  BarChart3, 
  Shield, 
  Users, 
  Zap,
  Building2,
  Wallet,
  FileText,
  TrendingUp,
  Lock,
  Clock,
  Star,
  ChevronRight,
  Smartphone,
  Download
} from "lucide-react";
import { SiApple, SiGoogleplay } from "react-icons/si";
import { ThemeToggle } from "@/components/theme-toggle";

export default function LandingPage() {
  const [, setLocation] = useLocation();

  const features = [
    {
      icon: CreditCard,
      title: "Virtual Cards",
      description: "Issue unlimited virtual cards with custom spending limits and controls for your team.",
      color: "text-indigo-600"
    },
    {
      icon: Globe2,
      title: "Global Payments",
      description: "Send and receive payments in 50+ currencies with competitive exchange rates.",
      color: "text-emerald-600"
    },
    {
      icon: BarChart3,
      title: "Real-time Analytics",
      description: "Get instant visibility into company spending with powerful dashboards and reports.",
      color: "text-amber-600"
    },
    {
      icon: Shield,
      title: "Enterprise Security",
      description: "Bank-grade encryption with multi-factor authentication and role-based access.",
      color: "text-rose-600"
    },
    {
      icon: Users,
      title: "Team Management",
      description: "Manage permissions, approval workflows, and spending policies for your entire team.",
      color: "text-cyan-600"
    },
    {
      icon: Zap,
      title: "Automated Workflows",
      description: "Automate expense approvals, reimbursements, and accounting sync.",
      color: "text-violet-600"
    }
  ];

  const stats = [
    { value: "$2B+", label: "Processed annually" },
    { value: "50+", label: "Countries supported" },
    { value: "10K+", label: "Teams trust us" },
    { value: "99.99%", label: "Uptime SLA" }
  ];

  const testimonials = [
    {
      quote: "Spendly transformed how we manage expenses. What used to take days now happens in minutes.",
      author: "Sarah Chen",
      role: "CFO at TechCorp",
      avatar: "SC"
    },
    {
      quote: "The virtual cards feature alone saved us thousands in unauthorized spending.",
      author: "Michael Roberts",
      role: "Finance Director at GlobalScale",
      avatar: "MR"
    },
    {
      quote: "Finally, a platform that understands the needs of high-growth teams.",
      author: "Emily Davis",
      role: "COO at StartupHub",
      avatar: "ED"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-8">
            <Link href="/">
              <span className="flex items-center gap-2 font-bold text-xl" data-testid="link-logo">
                <img src="/spendly-logo.png" alt="Spendly" className="h-8 w-8 rounded-lg" />
                <span>Spendly</span>
              </span>
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</a>
              <a href="#testimonials" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Testimonials</a>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button variant="ghost" onClick={() => setLocation("/login")} data-testid="button-login">
              Log in
            </Button>
            <Button onClick={() => setLocation("/signup")} data-testid="button-signup">
              Get Started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden py-20 md:py-32">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-background to-background dark:from-indigo-950/20" />
          <div className="container relative mx-auto px-4">
            <div className="mx-auto max-w-3xl text-center">
              <Badge variant="secondary" className="mb-6">
                <Star className="mr-1 h-3 w-3" />
                Trusted by 10,000+ teams worldwide
              </Badge>
              <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl" data-testid="text-hero-title">
                The Financial Operating System for{" "}
                <span className="text-indigo-600">High-Growth Teams</span>
              </h1>
              <p className="mb-8 text-lg text-muted-foreground md:text-xl">
                Manage expenses, issue virtual cards, automate payouts, and gain real-time 
                visibility into your company's spending. All in one powerful platform.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button size="lg" onClick={() => setLocation("/signup")} data-testid="button-get-started">
                  Get Started
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button size="lg" variant="outline" data-testid="button-demo">
                  <Clock className="mr-2 h-4 w-4" />
                  Book a Demo
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y bg-muted/30 py-12">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {stats.map((stat, index) => (
                <div key={index} className="text-center">
                  <div className="text-3xl md:text-4xl font-bold text-indigo-600" data-testid={`text-stat-${index}`}>
                    {stat.value}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="py-20">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4" data-testid="text-features-title">
                Everything you need to manage spend
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                From expense tracking to virtual cards, Spendly gives you complete control 
                over your company's finances.
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature, index) => (
                <Card key={index} className="hover-elevate transition-all" data-testid={`card-feature-${index}`}>
                  <CardContent className="p-6">
                    <div className={`inline-flex p-3 rounded-lg bg-muted mb-4 ${feature.color}`}>
                      <feature.icon className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <Badge variant="secondary" className="mb-4">Virtual Cards</Badge>
                <h2 className="text-3xl font-bold mb-4">
                  Issue cards in seconds, not days
                </h2>
                <p className="text-lg text-muted-foreground mb-6">
                  Create unlimited virtual cards with custom spending limits, merchant 
                  restrictions, and expiration dates. Perfect for subscriptions, marketing 
                  spend, and team purchases.
                </p>
                <ul className="space-y-3">
                  {[
                    "Instant card creation with custom limits",
                    "Real-time transaction notifications",
                    "Freeze or cancel cards instantly",
                    "Detailed spending analytics per card"
                  ].map((item, index) => (
                    <li key={index} className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <Button className="mt-6" variant="outline">
                  Learn more
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
              <div className="relative">
                <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-2xl p-8 text-white shadow-2xl transform rotate-3 hover:rotate-0 transition-transform">
                  <div className="flex justify-between items-start mb-12">
                    <div>
                      <div className="text-sm opacity-80">Marketing Team</div>
                      <div className="text-2xl font-bold mt-1">$8,500.00</div>
                    </div>
                    <div className="text-right">
                      <CreditCard className="h-10 w-10 opacity-80" />
                    </div>
                  </div>
                  <div className="text-xl tracking-widest mb-8">**** **** **** 4532</div>
                  <div className="flex justify-between text-sm">
                    <div>
                      <div className="opacity-60">Card Holder</div>
                      <div>Sarah Chen</div>
                    </div>
                    <div className="text-right">
                      <div className="opacity-60">Expires</div>
                      <div>12/28</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="testimonials" className="py-20">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">Loved by finance teams</h2>
              <p className="text-lg text-muted-foreground">
                See why thousands of companies trust Spendly for their expense management.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {testimonials.map((testimonial, index) => (
                <Card key={index} className="hover-elevate" data-testid={`card-testimonial-${index}`}>
                  <CardContent className="p-6">
                    <div className="flex gap-1 mb-4">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                    <p className="text-muted-foreground mb-6">"{testimonial.quote}"</p>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-semibold text-sm">
                        {testimonial.avatar}
                      </div>
                      <div>
                        <div className="font-medium">{testimonial.author}</div>
                        <div className="text-sm text-muted-foreground">{testimonial.role}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 bg-gradient-to-br from-indigo-600 to-indigo-800 text-white">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to transform your expense management?
            </h2>
            <p className="text-lg opacity-90 mb-8 max-w-2xl mx-auto">
              Join thousands of companies that trust Spendly to manage their finances.
              Get started today.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" variant="secondary" onClick={() => setLocation("/signup")}>
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" className="bg-transparent border-white/30 text-white hover:bg-white/10">
                Schedule Demo
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 font-bold text-lg mb-4">
                <img src="/spendly-logo.png" alt="Spendly" className="h-6 w-6 rounded-md" />
                Spendly
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                The financial operating system for high-growth teams.
              </p>
              <a href="https://spendlymanager.com" target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 hover:underline" data-testid="link-website">
                spendlymanager.com
              </a>
            </div>
            <div>
              <div className="font-semibold mb-4">Product</div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground transition-colors">Virtual Cards</a></li>
                <li><a href="#features" className="hover:text-foreground transition-colors">Expense Management</a></li>
                <li><a href="#features" className="hover:text-foreground transition-colors">Global Payments</a></li>
                <li><a href="#features" className="hover:text-foreground transition-colors">Analytics</a></li>
              </ul>
            </div>
            <div>
              <div className="font-semibold mb-4">Company</div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#testimonials" className="hover:text-foreground transition-colors">About</a></li>
                <li><a href="#testimonials" className="hover:text-foreground transition-colors">Blog</a></li>
                <li><a href="#features" className="hover:text-foreground transition-colors">Features</a></li>
                <li><Link href="/signup"><span className="hover:text-foreground transition-colors cursor-pointer">Get Started</span></Link></li>
              </ul>
            </div>
            <div>
              <div className="font-semibold mb-4">Legal</div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/privacy"><span className="hover:text-foreground transition-colors cursor-pointer">Privacy Policy</span></Link></li>
                <li><Link href="/terms"><span className="hover:text-foreground transition-colors cursor-pointer">Terms of Service</span></Link></li>
                <li><Link href="/privacy"><span className="hover:text-foreground transition-colors cursor-pointer">Cookie Policy</span></Link></li>
              </ul>
            </div>
            <div>
              <div className="font-semibold mb-4">Mobile Apps</div>
              <div className="space-y-3">
                <a 
                  href="https://apps.apple.com/app/spendly-expense-manager" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 bg-slate-900 dark:bg-slate-800 text-white rounded-lg hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
                  data-testid="link-app-store"
                >
                  <SiApple className="h-5 w-5" />
                  <div className="text-xs">
                    <div className="opacity-75">Download on the</div>
                    <div className="font-semibold">App Store</div>
                  </div>
                </a>
                <a 
                  href="https://play.google.com/store/apps/details?id=com.spendly.app" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 bg-slate-900 dark:bg-slate-800 text-white rounded-lg hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
                  data-testid="link-play-store"
                >
                  <SiGoogleplay className="h-5 w-5" />
                  <div className="text-xs">
                    <div className="opacity-75">Get it on</div>
                    <div className="font-semibold">Google Play</div>
                  </div>
                </a>
              </div>
            </div>
          </div>
          <div className="border-t mt-8 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              © 2026 Spendly Manager. All rights reserved. | <a href="https://spendlymanager.com" className="text-indigo-600 hover:underline">spendlymanager.com</a>
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
