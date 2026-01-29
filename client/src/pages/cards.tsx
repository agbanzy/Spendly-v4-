import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  CreditCard,
  MoreVertical,
  Snowflake,
  Lock,
  Eye,
  EyeOff,
} from "lucide-react";
import { useState } from "react";
import type { VirtualCard } from "@shared/schema";

const cardGradients: Record<string, string> = {
  indigo: "bg-gradient-to-br from-indigo-500 to-purple-600",
  emerald: "bg-gradient-to-br from-emerald-500 to-teal-600",
  rose: "bg-gradient-to-br from-rose-500 to-pink-600",
  amber: "bg-gradient-to-br from-amber-500 to-orange-600",
  slate: "bg-gradient-to-br from-slate-700 to-slate-900",
};

export default function Cards() {
  const [showNumbers, setShowNumbers] = useState<Record<string, boolean>>({});
  
  const { data: cards, isLoading } = useQuery<VirtualCard[]>({
    queryKey: ["/api/cards"],
  });

  const toggleShowNumber = (cardId: string) => {
    setShowNumbers((prev) => ({
      ...prev,
      [cardId]: !prev[cardId],
    }));
  };

  const totalBalance = cards?.reduce((sum, c) => sum + c.balance, 0) || 0;
  const activeCards = cards?.filter((c) => c.status === "Active").length || 0;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight" data-testid="text-cards-title">
            Virtual Cards
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your corporate virtual cards.
          </p>
        </div>
        <Button data-testid="button-issue-card">
          <Plus className="h-4 w-4 mr-2" />
          Issue New Card
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                Total Balance
              </p>
              <CreditCard className="h-4 w-4 text-primary" />
            </div>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <p className="text-2xl font-black" data-testid="text-total-card-balance">
                ${totalBalance.toLocaleString()}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                Active Cards
              </p>
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            </div>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-2xl font-black">{activeCards}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                Total Cards
              </p>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </div>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-2xl font-black">{cards?.length || 0}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cards Grid */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
          Your Cards
        </h3>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-52 rounded-2xl" />
            ))}
          </div>
        ) : cards && cards.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cards.map((card) => (
              <div
                key={card.id}
                className={`relative rounded-2xl p-6 text-white ${cardGradients[card.color] || cardGradients.slate} shadow-xl overflow-hidden`}
                data-testid={`card-${card.id}`}
              >
                {/* Background pattern */}
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute top-10 -right-10 w-40 h-40 border-8 border-white rounded-full" />
                  <div className="absolute -bottom-10 -left-10 w-32 h-32 border-8 border-white rounded-full" />
                </div>

                <div className="relative z-10">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-8">
                    <div>
                      <p className="text-xs font-bold opacity-80 uppercase tracking-widest">
                        {card.name}
                      </p>
                      {card.status === "Frozen" && (
                        <Badge className="mt-2 bg-white/20 text-white border-0">
                          <Snowflake className="h-3 w-3 mr-1" />
                          Frozen
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-white hover:bg-white/10"
                        onClick={() => toggleShowNumber(card.id)}
                      >
                        {showNumbers[card.id] ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-white hover:bg-white/10"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Card Number */}
                  <div className="mb-6">
                    <p className="text-xl font-mono tracking-wider">
                      {showNumbers[card.id] 
                        ? `4532 •••• •••• ${card.last4}`
                        : `•••• •••• •••• ${card.last4}`
                      }
                    </p>
                  </div>

                  {/* Footer */}
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-xs opacity-60 uppercase">Balance</p>
                      <p className="text-xl font-bold">
                        ${card.balance.toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs opacity-60 uppercase">Limit</p>
                      <p className="text-sm font-bold">
                        ${card.limit.toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="text-lg font-bold uppercase">{card.type}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <CreditCard className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-bold mb-1">No cards yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Issue your first virtual card to get started.
              </p>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Issue New Card
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
