import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Plus,
  PieChart,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
} from "lucide-react";
import type { Budget } from "@shared/schema";

export default function BudgetPage() {
  const { data: budgets, isLoading } = useQuery<Budget[]>({
    queryKey: ["/api/budgets"],
  });

  const totalBudget = budgets?.reduce((sum, b) => sum + b.limit, 0) || 0;
  const totalSpent = budgets?.reduce((sum, b) => sum + b.spent, 0) || 0;
  const overBudget = budgets?.filter((b) => b.spent > b.limit).length || 0;

  const getProgressColor = (spent: number, limit: number) => {
    const percentage = (spent / limit) * 100;
    if (percentage >= 100) return "bg-red-500";
    if (percentage >= 80) return "bg-amber-500";
    return "bg-emerald-500";
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight" data-testid="text-budget-title">
            Budget
          </h1>
          <p className="text-muted-foreground mt-1">
            Set and track spending limits by category.
          </p>
        </div>
        <Button data-testid="button-create-budget">
          <Plus className="h-4 w-4 mr-2" />
          Create Budget
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                Total Budget
              </p>
              <PieChart className="h-4 w-4 text-primary" />
            </div>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <>
                <p className="text-3xl font-black" data-testid="text-total-budget">
                  ${totalBudget.toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Across {budgets?.length || 0} categories
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                Total Spent
              </p>
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </div>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <>
                <p className="text-3xl font-black" data-testid="text-total-spent">
                  ${totalSpent.toLocaleString()}
                </p>
                <div className="mt-2">
                  <Progress 
                    value={(totalSpent / totalBudget) * 100} 
                    className="h-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0}% of total budget
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className={overBudget > 0 ? "border-red-200 dark:border-red-900" : ""}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                Over Budget
              </p>
              <AlertTriangle className={`h-4 w-4 ${overBudget > 0 ? "text-red-600" : "text-muted-foreground"}`} />
            </div>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <p className={`text-3xl font-black ${overBudget > 0 ? "text-red-600" : ""}`}>
                  {overBudget}
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  {overBudget === 0 ? "All budgets on track" : "Categories exceeded"}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Budget Cards */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
          Budget Categories
        </h3>
        
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-6 w-32 mb-4" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-3 w-24" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : budgets && budgets.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {budgets.map((budget) => {
              const percentage = (budget.spent / budget.limit) * 100;
              const isOverBudget = percentage >= 100;
              const isWarning = percentage >= 80 && percentage < 100;
              
              return (
                <Card 
                  key={budget.id}
                  className={isOverBudget ? "border-red-200 dark:border-red-900" : ""}
                  data-testid={`budget-card-${budget.id}`}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h4 className="text-lg font-bold">{budget.name}</h4>
                        <Badge variant="outline" className="text-xs mt-1">
                          {budget.category}
                        </Badge>
                      </div>
                      {isOverBudget && (
                        <Badge variant="destructive" className="text-xs">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Over Budget
                        </Badge>
                      )}
                      {isWarning && (
                        <Badge className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          <TrendingUp className="h-3 w-3 mr-1" />
                          Warning
                        </Badge>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-baseline justify-between">
                        <span className="text-2xl font-black">
                          ${budget.spent.toLocaleString()}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          of ${budget.limit.toLocaleString()}
                        </span>
                      </div>
                      
                      <div className="relative">
                        <Progress 
                          value={Math.min(percentage, 100)} 
                          className="h-3"
                        />
                        {percentage > 100 && (
                          <div 
                            className="absolute top-0 left-full h-3 bg-red-500 rounded-r-full" 
                            style={{ width: `${Math.min(percentage - 100, 50)}%` }}
                          />
                        )}
                      </div>
                      
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{Math.round(percentage)}% used</span>
                        <span className="capitalize">{budget.period}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <PieChart className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-bold mb-1">No budgets yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first budget to start tracking spending.
              </p>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Budget
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
