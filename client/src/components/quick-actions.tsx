import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { 
  Plus, 
  X,
  Receipt,
  Wallet,
  FileBarChart
} from "lucide-react";

export function QuickActions() {
  const [, setLocation] = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const actions = [
    {
      label: "Fund Wallet",
      icon: Wallet,
      onClick: () => {
        setLocation("/dashboard?action=fund");
        setIsOpen(false);
      },
      color: "bg-emerald-500 hover:bg-emerald-600"
    },
    {
      label: "New Expense",
      icon: Receipt,
      onClick: () => {
        setLocation("/expenses?action=new");
        setIsOpen(false);
      },
      color: "bg-blue-500 hover:bg-blue-600"
    },
    {
      label: "Pay Bills",
      icon: FileBarChart,
      onClick: () => {
        setLocation("/bills");
        setIsOpen(false);
      },
      color: "bg-purple-500 hover:bg-purple-600"
    }
  ];

  return (
    <>
      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-[60]">
        {/* Action buttons - appear when open */}
        <div className={`flex flex-col gap-3 mb-3 transition-all duration-200 ${isOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"}`}>
          {actions.map((action, idx) => (
            <button
              key={idx}
              onClick={(e) => {
                e.stopPropagation();
                action.onClick();
              }}
              className={`flex items-center gap-3 justify-end z-[70]`}
              data-testid={`quick-action-${action.label.toLowerCase().replace(/\s/g, "-")}`}
            >
              <span className="bg-background border px-3 py-1.5 rounded-lg shadow-md text-sm font-medium">
                {action.label}
              </span>
              <div className={`w-12 h-12 rounded-full ${action.color} text-white flex items-center justify-center shadow-lg transition-transform hover:scale-110`}>
                <action.icon className="h-5 w-5" />
              </div>
            </button>
          ))}
        </div>

        {/* Main FAB button */}
        <Button
          onClick={() => setIsOpen(!isOpen)}
          className={`w-14 h-14 rounded-full shadow-xl transition-all duration-200 ${
            isOpen 
              ? "bg-gray-600 hover:bg-gray-700 rotate-45" 
              : "bg-indigo-600 hover:bg-indigo-700"
          }`}
          data-testid="button-quick-actions"
        >
          {isOpen ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
        </Button>
      </div>

      {/* Backdrop overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/30 z-50" 
          onClick={() => setIsOpen(false)} 
        />
      )}
    </>
  );
}
