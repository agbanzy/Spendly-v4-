/**
 * SPENDLY v4 — Extended UI Components
 * Reusable animated components for consistent UX across all pages
 */

import { ReactNode, forwardRef } from "react";
import { motion, type Variants } from "framer-motion";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Loader2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  type LucideIcon,
} from "lucide-react";

// ═══════════════════════════════════════════
// ANIMATION VARIANTS
// ═══════════════════════════════════════════

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.25, 0.4, 0.25, 1] } },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.35 } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.35, ease: [0.25, 0.4, 0.25, 1] } },
};

export const stagger: Variants = {
  visible: { transition: { staggerChildren: 0.06 } },
};

export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.4, ease: [0.25, 0.4, 0.25, 1] } },
};

// ═══════════════════════════════════════════
// PAGE WRAPPER — Animated entry for every page
// ═══════════════════════════════════════════

export function PageWrapper({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={stagger}
      className={cn("p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 min-h-screen", className)}
    >
      {children}
    </motion.div>
  );
}

// ═══════════════════════════════════════════
// PAGE HEADER — Consistent page title area
// ═══════════════════════════════════════════

export function PageHeader({
  title,
  subtitle,
  badge,
  badgeVariant = "default",
  icon: Icon,
  actions,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  badgeVariant?: "default" | "secondary" | "outline" | "destructive";
  icon?: LucideIcon;
  actions?: ReactNode;
}) {
  return (
    <motion.div variants={fadeUp} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        {badge && (
          <Badge variant={badgeVariant} className="mb-2 text-[10px] font-bold uppercase tracking-[0.1em] gap-1.5 bg-primary/8 text-primary border-primary/15">
            {Icon && <Icon className="h-3 w-3" />}
            {badge}
          </Badge>
        )}
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="text-muted-foreground text-sm mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </motion.div>
  );
}

// ═══════════════════════════════════════════
// METRIC CARD — Animated stat card
// ═══════════════════════════════════════════

const metricColorMap = {
  primary: { bg: "from-primary/12 to-primary/4", icon: "text-primary", ring: "ring-primary/10" },
  emerald: { bg: "from-emerald-500/12 to-emerald-500/4", icon: "text-emerald-600 dark:text-emerald-400", ring: "ring-emerald-500/10" },
  amber: { bg: "from-amber-500/12 to-amber-500/4", icon: "text-amber-600 dark:text-amber-400", ring: "ring-amber-500/10" },
  rose: { bg: "from-rose-500/12 to-rose-500/4", icon: "text-rose-600 dark:text-rose-400", ring: "ring-rose-500/10" },
  violet: { bg: "from-violet-500/12 to-violet-500/4", icon: "text-violet-600 dark:text-violet-400", ring: "ring-violet-500/10" },
  cyan: { bg: "from-cyan-500/12 to-cyan-500/4", icon: "text-cyan-600 dark:text-cyan-400", ring: "ring-cyan-500/10" },
};

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = "primary",
  trend,
  trendLabel,
  loading = false,
  className = "",
  ...rest
}: {
  title: string;
  value: ReactNode;
  subtitle?: string;
  icon: LucideIcon;
  color?: keyof typeof metricColorMap;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
  loading?: boolean;
  className?: string;
  [key: string]: any;
}) {
  const colors = metricColorMap[color];

  return (
    <motion.div variants={fadeUp}>
      <Card className={cn("card-hover border bg-card overflow-hidden group", className)}>
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-3">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">{title}</p>
            <div className={cn("p-2 rounded-xl bg-gradient-to-br ring-1", colors.bg, colors.ring)}>
              <Icon className={cn("h-4 w-4", colors.icon)} />
            </div>
          </div>
          {loading ? (
            <div className="h-8 w-24 rounded-lg shimmer" />
          ) : (
            <p className="text-2xl font-extrabold tracking-tight">{value}</p>
          )}
          <div className="flex items-center gap-2 mt-1.5">
            {trend && trendLabel && (
              <span className={cn(
                "inline-flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-md",
                trend === "up" ? "text-emerald-700 bg-emerald-500/10 dark:text-emerald-400 dark:bg-emerald-500/15" :
                trend === "down" ? "text-rose-700 bg-rose-500/10 dark:text-rose-400 dark:bg-rose-500/15" :
                "text-muted-foreground bg-muted"
              )}>
                {trend === "up" ? <TrendingUp className="h-3 w-3" /> : trend === "down" ? <TrendingDown className="h-3 w-3" /> : null}
                {trendLabel}
              </span>
            )}
            {subtitle && <span className="text-[11px] text-muted-foreground">{subtitle}</span>}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ═══════════════════════════════════════════
// STATUS BADGE — Consistent status chips
// ═══════════════════════════════════════════

const statusConfig = {
  completed: { label: "Completed", icon: CheckCircle2, className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400" },
  paid: { label: "Paid", icon: CheckCircle2, className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400" },
  approved: { label: "Approved", icon: CheckCircle2, className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400" },
  active: { label: "Active", icon: CheckCircle2, className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400" },
  success: { label: "Success", icon: CheckCircle2, className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400" },
  pending: { label: "Pending", icon: Clock, className: "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400" },
  processing: { label: "Processing", icon: Loader2, className: "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400 [&>svg]:animate-spin" },
  unpaid: { label: "Unpaid", icon: Clock, className: "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400" },
  warning: { label: "Warning", icon: AlertTriangle, className: "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400" },
  overdue: { label: "Overdue", icon: AlertTriangle, className: "bg-rose-500/10 text-rose-700 border-rose-500/20 dark:text-rose-400" },
  rejected: { label: "Rejected", icon: XCircle, className: "bg-rose-500/10 text-rose-700 border-rose-500/20 dark:text-rose-400" },
  failed: { label: "Failed", icon: XCircle, className: "bg-rose-500/10 text-rose-700 border-rose-500/20 dark:text-rose-400" },
  frozen: { label: "Frozen", icon: AlertCircle, className: "bg-sky-500/10 text-sky-700 border-sky-500/20 dark:text-sky-400" },
  draft: { label: "Draft", icon: Clock, className: "bg-slate-500/10 text-slate-600 border-slate-500/20 dark:text-slate-400" },
  inactive: { label: "Inactive", icon: AlertCircle, className: "bg-slate-500/10 text-slate-600 border-slate-500/20 dark:text-slate-400" },
};

export function StatusBadge({
  status,
  label,
  className = "",
  variant,
  ...rest
}: {
  status: keyof typeof statusConfig | string;
  label?: string;
  className?: string;
  variant?: string;
  [key: string]: any;
}) {
  const key = status.toLowerCase().replace(/\s/g, "") as keyof typeof statusConfig;
  const config = statusConfig[key] || statusConfig.pending;
  const StatusIcon = config.icon;

  return (
    <Badge variant="outline" className={cn("text-[11px] font-semibold gap-1 px-2 py-0.5 border", config.className, className)}>
      <StatusIcon className="h-3 w-3" />
      {label || config.label}
    </Badge>
  );
}

// ═══════════════════════════════════════════
// ANIMATED LIST ITEM — For transaction/expense rows
// ═══════════════════════════════════════════

export function AnimatedListItem({
  children,
  className = "",
  index = 0,
  delay,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  index?: number;
  delay?: number;
  [key: string]: any;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay ?? index * 0.04, duration: 0.3, ease: [0.25, 0.4, 0.25, 1] }}
      className={cn(
        "group/row",
        className
      )}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

// ═══════════════════════════════════════════
// ICON BUBBLE — Colored icon container
// ═══════════════════════════════════════════

export function IconBubble({
  icon: Icon,
  color = "primary",
  size = "md",
  className = "",
}: {
  icon: LucideIcon;
  color?: keyof typeof metricColorMap;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const colors = metricColorMap[color];
  const sizeMap = {
    sm: "p-1.5 [&>svg]:h-3.5 [&>svg]:w-3.5",
    md: "p-2.5 [&>svg]:h-4.5 [&>svg]:w-4.5",
    lg: "p-3.5 [&>svg]:h-5.5 [&>svg]:w-5.5",
  };

  return (
    <div className={cn("rounded-xl bg-gradient-to-br ring-1", colors.bg, colors.ring, sizeMap[size], className)}>
      <Icon className={colors.icon} />
    </div>
  );
}

// ═══════════════════════════════════════════
// EMPTY STATE — Consistent zero-data view
// ═══════════════════════════════════════════

export function EmptyState({
  icon: Icon,
  title,
  description,
  subtitle,
  action,
  color = "primary",
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  subtitle?: string;
  action?: ReactNode | { label: string; icon?: LucideIcon; onClick: () => void };
  color?: keyof typeof metricColorMap;
}) {
  const colors = metricColorMap[color];
  const desc = description || subtitle;

  const actionElement = action && typeof action === "object" && "label" in action ? (
    <Button onClick={action.onClick} className="gap-2">
      {action.icon && <action.icon className="h-4 w-4" />}
      {action.label}
    </Button>
  ) : action;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center justify-center py-16 px-4 text-center"
    >
      <div className={cn("p-4 rounded-2xl bg-gradient-to-br mb-4 ring-1", colors.bg, colors.ring)}>
        <Icon className={cn("h-8 w-8", colors.icon)} />
      </div>
      <h3 className="text-lg font-bold mb-1">{title}</h3>
      {desc && <p className="text-sm text-muted-foreground max-w-sm mb-4">{desc}</p>}
      {actionElement}
    </motion.div>
  );
}

// ═══════════════════════════════════════════
// FORM FIELD — Animated input with validation feedback
// ═══════════════════════════════════════════

interface FormFieldProps {
  label: string;
  id?: string;
  error?: string;
  success?: string;
  hint?: string;
  required?: boolean;
  icon?: LucideIcon;
  children?: ReactNode;
}

export function FormField({
  label,
  id,
  error,
  success,
  hint,
  required,
  icon: Icon,
  children,
}: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium flex items-center gap-1">
        {label}
        {required && <span className="text-rose-500">*</span>}
      </Label>
      <div className="relative">
        {Icon && (
          <Icon className={cn(
            "absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors",
            error ? "text-rose-500" : success ? "text-emerald-500" : "text-muted-foreground"
          )} />
        )}
        {children}
      </div>
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-[12px] text-rose-600 dark:text-rose-400 flex items-center gap-1"
        >
          <XCircle className="h-3 w-3" />
          {error}
        </motion.p>
      )}
      {success && !error && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-[12px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1"
        >
          <CheckCircle2 className="h-3 w-3" />
          {success}
        </motion.p>
      )}
      {hint && !error && !success && (
        <p className="text-[12px] text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// ANIMATED NUMBER — Count-up effect
// ═══════════════════════════════════════════

export function AnimatedNumber({
  value,
  prefix = "",
  suffix = "",
  className = "",
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.4, 0.25, 1] }}
      className={className}
    >
      {prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}
    </motion.span>
  );
}

// ═══════════════════════════════════════════
// SECTION LABEL — Consistent section headers
// ═══════════════════════════════════════════

export function SectionLabel({
  icon: Icon,
  children,
  className = "",
}: {
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.h3 variants={fadeUp} className={cn("text-[11px] font-bold text-muted-foreground uppercase tracking-[0.1em] flex items-center gap-2", className)}>
      {Icon && <Icon className="h-3.5 w-3.5 text-primary" />}
      {children}
    </motion.h3>
  );
}

// ═══════════════════════════════════════════
// GLASS CARD — Glass-morphism wrapper
// ═══════════════════════════════════════════

export function GlassCard({
  children,
  className = "",
  hover = true,
  padding = "p-5",
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  padding?: string;
}) {
  return (
    <motion.div variants={fadeUp}>
      <Card className={cn("glass border overflow-hidden", hover && "card-hover", className)}>
        <CardContent className={padding}>{children}</CardContent>
      </Card>
    </motion.div>
  );
}

// ═══════════════════════════════════════════
// TOAST FEEDBACK VARIANTS — For success/error states
// ═══════════════════════════════════════════

export function SuccessFeedback({ message, title, icon: CustomIcon }: { message: string; title?: string; icon?: LucideIcon }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-700 dark:text-emerald-400 text-sm flex items-center gap-2"
    >
      {CustomIcon ? <CustomIcon className="h-4 w-4 shrink-0" /> : <CheckCircle2 className="h-4 w-4 shrink-0" />}
      <span>{title ? <strong>{title}: </strong> : null}{message}</span>
    </motion.div>
  );
}

export function ErrorFeedback({ message, title, icon: CustomIcon }: { message: string; title?: string; icon?: LucideIcon }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-700 dark:text-rose-400 text-sm flex items-center gap-2"
    >
      {CustomIcon ? <CustomIcon className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
      <span>{title ? <strong>{title}: </strong> : null}{message}</span>
    </motion.div>
  );
}

export function WarningFeedback({ message, title, icon: CustomIcon }: { message: string; title?: string; icon?: LucideIcon }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-700 dark:text-amber-400 text-sm flex items-center gap-2"
    >
      {CustomIcon ? <CustomIcon className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
      <span>{title ? <strong>{title}: </strong> : null}{message}</span>
    </motion.div>
  );
}

export function InfoFeedback({ message, title, icon: CustomIcon }: { message: string; title?: string; icon?: LucideIcon }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="p-3 bg-primary/8 border border-primary/15 rounded-xl text-primary text-sm flex items-center gap-2"
    >
      {CustomIcon ? <CustomIcon className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
      <span>{title ? <strong>{title}: </strong> : null}{message}</span>
    </motion.div>
  );
}

// ═══════════════════════════════════════════
// PROGRESS RING — Circular progress for budgets
// ═══════════════════════════════════════════

export function ProgressRing({
  value,
  max = 100,
  size = 64,
  strokeWidth = 5,
  color = "primary",
  children,
}: {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  children?: ReactNode;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = Math.min((value / max) * 100, 100);
  const offset = circumference - (percentage / 100) * circumference;

  const strokeColor = percentage > 100
    ? "stroke-rose-500"
    : percentage > 80
    ? "stroke-amber-500"
    : color === "primary"
    ? "stroke-primary"
    : `stroke-${color}-500`;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/30"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className={strokeColor}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: [0.25, 0.4, 0.25, 1] }}
          style={{ strokeDasharray: circumference }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children || <span className="text-xs font-bold">{Math.round(percentage)}%</span>}
      </div>
    </div>
  );
}
