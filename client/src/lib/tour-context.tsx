import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface TourContextType {
  isTourRunning: boolean;
  isTourCompleted: boolean;
  startTour: () => void;
  completeTour: () => void;
  resetTour: () => void;
}

const TOUR_KEY = "financiar_tour_completed";

const TourContext = createContext<TourContextType | undefined>(undefined);

export function TourProvider({ children }: { children: ReactNode }) {
  const [isTourRunning, setIsTourRunning] = useState(false);
  const [isTourCompleted, setIsTourCompleted] = useState(() => {
    return localStorage.getItem(TOUR_KEY) === "true";
  });

  const startTour = useCallback(() => {
    setIsTourRunning(true);
  }, []);

  const completeTour = useCallback(() => {
    setIsTourRunning(false);
    setIsTourCompleted(true);
    localStorage.setItem(TOUR_KEY, "true");
  }, []);

  const resetTour = useCallback(() => {
    setIsTourCompleted(false);
    localStorage.removeItem(TOUR_KEY);
  }, []);

  return (
    <TourContext.Provider value={{ isTourRunning, isTourCompleted, startTour, completeTour, resetTour }}>
      {children}
    </TourContext.Provider>
  );
}

export function useTour() {
  const context = useContext(TourContext);
  if (context === undefined) {
    throw new Error("useTour must be used within a TourProvider");
  }
  return context;
}
