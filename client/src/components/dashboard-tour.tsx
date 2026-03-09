import { useEffect, useState } from "react";
import Joyride, { CallBackProps, STATUS, ACTIONS, EVENTS, type Step } from "react-joyride";
import { useTour } from "@/lib/tour-context";

const TOUR_STEPS: Step[] = [
  {
    target: "body",
    content: "Welcome to Financiar! Let's take a quick tour of your financial dashboard so you know where everything is.",
    placement: "center",
    disableBeacon: true,
    title: "👋 Welcome!",
  },
  {
    target: '[data-tour="sidebar"]',
    content: "Navigate between all your financial tools — Dashboard, Transactions, Budget, Invoices, and more — right from the sidebar.",
    title: "Navigation",
    placement: "right",
  },
  {
    target: '[data-tour="balance-card"]',
    content: "Your total balance across all accounts at a glance. Use the eye icon to hide/show amounts, and click Refresh to update.",
    title: "Total Balance",
    placement: "bottom",
  },
  {
    target: '[data-tour="quick-actions"]',
    content: "Quickly add funds to your wallet or send money to others using these action buttons.",
    title: "Quick Actions",
    placement: "bottom",
  },
  {
    target: '[data-tour="sub-balances"]',
    content: "Your money is organized into three wallets: Local Balance (your currency), USD Treasury (global), and Escrow (pending settlements).",
    title: "Balance Breakdown",
    placement: "top",
  },
  {
    target: '[data-tour="virtual-account"]',
    content: "Generate a dedicated virtual account to receive payments directly into your wallet — instant and automatic.",
    title: "Virtual Account",
    placement: "top",
  },
  {
    target: '[data-tour="transactions"]',
    content: "All your transactions appear here. Click 'View All' for the full history with search, filters, and export options.",
    title: "Recent Activity",
    placement: "top",
  },
  {
    target: '[data-tour="settings-link"]',
    content: "Manage your profile, security, team members, and preferences from Settings. That's it — you're all set! 🎉",
    title: "Settings & More",
    placement: "right",
  },
];

export function DashboardTour() {
  const { isTourRunning, isTourCompleted, startTour, completeTour } = useTour();
  const [ready, setReady] = useState(false);

  // Auto-start tour on first visit (after a short delay for DOM to settle)
  useEffect(() => {
    if (!isTourCompleted) {
      const timer = setTimeout(() => {
        setReady(true);
        startTour();
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [isTourCompleted, startTour]);

  const handleCallback = (data: CallBackProps) => {
    const { status, action, type } = data;

    // Tour finished or skipped
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      completeTour();
    }

    // User closed the tour via the X button
    if (action === ACTIONS.CLOSE && type === EVENTS.STEP_AFTER) {
      completeTour();
    }
  };

  if (!ready || !isTourRunning) return null;

  return (
    <Joyride
      steps={TOUR_STEPS}
      run={isTourRunning}
      continuous
      showSkipButton
      showProgress
      scrollToFirstStep
      disableOverlayClose
      callback={handleCallback}
      locale={{
        back: "Back",
        close: "Close",
        last: "Finish",
        next: "Next",
        skip: "Skip Tour",
      }}
      styles={{
        options: {
          primaryColor: "#6B2346",
          zIndex: 10000,
          arrowColor: "#fff",
          backgroundColor: "#fff",
          textColor: "#333",
          overlayColor: "rgba(0, 0, 0, 0.5)",
        },
        tooltipContainer: {
          textAlign: "left",
        },
        tooltipTitle: {
          fontSize: 16,
          fontWeight: 700,
          marginBottom: 4,
        },
        tooltipContent: {
          fontSize: 14,
          lineHeight: 1.6,
        },
        buttonNext: {
          borderRadius: 8,
          padding: "8px 16px",
          fontSize: 13,
          fontWeight: 600,
        },
        buttonBack: {
          marginRight: 8,
          color: "#666",
          fontSize: 13,
        },
        buttonSkip: {
          color: "#999",
          fontSize: 12,
        },
        spotlight: {
          borderRadius: 12,
        },
      }}
    />
  );
}
