import { useState, useRef, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, ShieldCheck } from "lucide-react";
import {
  getCachedPin,
  setCachedPin,
  clearPinCache,
  isPinError,
  PIN_ERROR_CODES,
} from "@/lib/pin-cache";

// ── PIN Verification Dialog ────────────────────────────────────
// Collects a 6-digit PIN. No separate verify-pin API call — the
// actual verification happens server-side when the protected
// endpoint is called with the x-transaction-pin header.

interface PinVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified: (pin: string) => void;
  title?: string;
  description?: string;
  error?: string;
}

export function PinVerificationDialog({
  open,
  onOpenChange,
  onVerified,
  title = "Enter Transaction PIN",
  description = "Please enter your 6-digit transaction PIN to authorize this action.",
  error: externalError,
}: PinVerificationDialogProps) {
  const [pin, setPin] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  useEffect(() => {
    if (open) {
      setPin(["", "", "", "", "", ""]);
      setError("");
      setTimeout(() => inputRefs[0].current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    if (externalError) setError(externalError);
  }, [externalError]);

  const handleDigitChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newPin = [...pin];
    newPin[index] = value.slice(-1);
    setPin(newPin);
    setError("");

    if (value && index < 5) {
      inputRefs[index + 1].current?.focus();
    }

    if (value && index === 5) {
      const fullPin = newPin.join("");
      if (fullPin.length === 6) {
        onVerified(fullPin);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !pin[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setPin(pasted.split(""));
      onVerified(pasted);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-full bg-primary/10">
              <Lock className="h-5 w-5 text-primary" />
            </div>
            <DialogTitle data-testid="text-pin-dialog-title">{title}</DialogTitle>
          </div>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex justify-center gap-3 py-6" onPaste={handlePaste}>
          {pin.map((digit, i) => (
            <Input
              key={i}
              ref={inputRefs[i]}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleDigitChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className="w-12 h-12 text-center text-xl font-bold"
              data-testid={`input-pin-digit-${i}`}
              autoComplete="off"
            />
          ))}
        </div>

        {error && (
          <p className="text-sm text-destructive text-center" data-testid="text-pin-error">
            {error}
          </p>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-pin"
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── PIN Setup Dialog ───────────────────────────────────────────
// Shown when user has no PIN set and attempts a sensitive action.
// Two-step: enter PIN, then confirm PIN.

interface PinSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSetupComplete: (pin: string) => void;
}

export function PinSetupDialog({
  open,
  onOpenChange,
  onSetupComplete,
}: PinSetupDialogProps) {
  const [step, setStep] = useState<"create" | "confirm">("create");
  const [createPin, setCreatePin] = useState(["", "", "", "", "", ""]);
  const [confirmPin, setConfirmPin] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];
  const confirmRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  useEffect(() => {
    if (open) {
      setStep("create");
      setCreatePin(["", "", "", "", "", ""]);
      setConfirmPin(["", "", "", "", "", ""]);
      setError("");
      setTimeout(() => createRefs[0].current?.focus(), 100);
    }
  }, [open]);

  const handleDigitChange = (
    refs: React.RefObject<HTMLInputElement | null>[],
    pins: string[],
    setPins: (p: string[]) => void,
    index: number,
    value: string,
    onComplete?: (fullPin: string) => void,
  ) => {
    if (!/^\d*$/.test(value)) return;
    const newPin = [...pins];
    newPin[index] = value.slice(-1);
    setPins(newPin);
    setError("");

    if (value && index < 5) {
      refs[index + 1].current?.focus();
    }
    if (value && index === 5) {
      const fullPin = newPin.join("");
      if (fullPin.length === 6) onComplete?.(fullPin);
    }
  };

  const handleKeyDown = (
    refs: React.RefObject<HTMLInputElement | null>[],
    pins: string[],
    index: number,
    e: React.KeyboardEvent,
  ) => {
    if (e.key === "Backspace" && !pins[index] && index > 0) {
      refs[index - 1].current?.focus();
    }
  };

  const handleCreateComplete = () => {
    setStep("confirm");
    setConfirmPin(["", "", "", "", "", ""]);
    setTimeout(() => confirmRefs[0].current?.focus(), 100);
  };

  const handleConfirmComplete = async (fullPin: string) => {
    const createdPin = createPin.join("");
    if (fullPin !== createdPin) {
      setError("PINs do not match. Please try again.");
      setConfirmPin(["", "", "", "", "", ""]);
      setTimeout(() => confirmRefs[0].current?.focus(), 100);
      return;
    }

    setIsSubmitting(true);
    try {
      const { apiRequest } = await import("@/lib/queryClient");
      const res = await apiRequest("POST", "/api/user/set-pin", { pin: fullPin });
      const data = await res.json();
      if (data.success) {
        onSetupComplete(fullPin);
      } else {
        setError("Failed to set PIN. Please try again.");
      }
    } catch {
      setError("Failed to set PIN. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeRefs = step === "create" ? createRefs : confirmRefs;
  const activePins = step === "create" ? createPin : confirmPin;
  const setActivePins = step === "create" ? setCreatePin : setConfirmPin;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-full bg-primary/10">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <DialogTitle>
              {step === "create" ? "Set Up Transaction PIN" : "Confirm Your PIN"}
            </DialogTitle>
          </div>
          <DialogDescription>
            {step === "create"
              ? "Create a 6-digit PIN to authorize sensitive financial actions. This PIN is required for all payments, transfers, and approvals."
              : "Enter your PIN again to confirm."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-center gap-3 py-6">
          {activePins.map((digit, i) => (
            <Input
              key={`${step}-${i}`}
              ref={activeRefs[i]}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) =>
                handleDigitChange(
                  activeRefs,
                  activePins,
                  setActivePins,
                  i,
                  e.target.value,
                  step === "create" ? handleCreateComplete : handleConfirmComplete,
                )
              }
              onKeyDown={(e) => handleKeyDown(activeRefs, activePins, i, e)}
              className="w-12 h-12 text-center text-xl font-bold"
              disabled={isSubmitting}
              autoComplete="off"
            />
          ))}
        </div>

        {step === "confirm" && (
          <div className="flex justify-center">
            <div className="flex gap-1">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <div className="w-2 h-2 rounded-full bg-primary" />
            </div>
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive text-center">{error}</p>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {step === "confirm" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStep("create");
                setCreatePin(["", "", "", "", "", ""]);
                setError("");
                setTimeout(() => createRefs[0].current?.focus(), 100);
              }}
              disabled={isSubmitting}
            >
              Start Over
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── usePinVerification Hook ────────────────────────────────────
// Central hook for all PIN-protected actions.
//
// Usage in pages:
//   const pin = usePinVerification();
//   // In mutation: mutationFn: (data) => pinProtectedRequest("POST", url, data)
//   // On button click: pin.requirePin(() => mutation.mutate(data))
//   // In mutation onError: if (pin.handlePinError(error, () => mutation.mutate(data))) return;
//   // Render: <>{pin.PinDialogs}</>

export function usePinVerification() {
  const [isPinDialogOpen, setIsPinDialogOpen] = useState(false);
  const [isPinSetupOpen, setIsPinSetupOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [pinError, setPinError] = useState("");

  /** Wrap a sensitive action — prompts for PIN if not cached, then executes */
  const requirePin = useCallback((action: () => void) => {
    const cached = getCachedPin();
    if (cached) {
      action();
    } else {
      setPendingAction(() => action);
      setPinError("");
      setIsPinDialogOpen(true);
    }
  }, []);

  /** Called when user enters PIN in dialog */
  const handlePinVerified = useCallback((pin: string) => {
    setCachedPin(pin);
    setIsPinDialogOpen(false);
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  }, [pendingAction]);

  /** Called after PIN setup completes */
  const handlePinSetupComplete = useCallback((pin: string) => {
    setCachedPin(pin);
    setIsPinSetupOpen(false);
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  }, [pendingAction]);

  /**
   * Call in mutation's onError to handle PIN-related server errors.
   * Returns true if the error was handled (caller should return early).
   * Pass retryAction to re-execute the mutation after PIN is collected.
   */
  const handlePinError = useCallback((error: unknown, retryAction?: () => void): boolean => {
    const msg = error instanceof Error ? error.message : String(error);
    const pinCode = isPinError(msg);
    if (!pinCode) return false;

    if (pinCode === PIN_ERROR_CODES.PIN_SETUP_REQUIRED) {
      if (retryAction) setPendingAction(() => retryAction);
      setIsPinSetupOpen(true);
      return true;
    }

    // PIN_REQUIRED or PIN_INVALID — clear cache and re-prompt
    clearPinCache();
    if (retryAction) setPendingAction(() => retryAction);
    setPinError(
      pinCode === PIN_ERROR_CODES.PIN_INVALID
        ? "Incorrect PIN. Please try again."
        : "",
    );
    setIsPinDialogOpen(true);
    return true;
  }, []);

  /** JSX for both dialogs — render this in your page component */
  const PinDialogs = (
    <>
      <PinVerificationDialog
        open={isPinDialogOpen}
        onOpenChange={setIsPinDialogOpen}
        onVerified={handlePinVerified}
        error={pinError}
      />
      <PinSetupDialog
        open={isPinSetupOpen}
        onOpenChange={setIsPinSetupOpen}
        onSetupComplete={handlePinSetupComplete}
      />
    </>
  );

  return {
    isPinDialogOpen,
    setIsPinDialogOpen,
    isPinSetupOpen,
    setIsPinSetupOpen,
    requirePin,
    handlePinVerified,
    handlePinSetupComplete,
    handlePinError,
    PinDialogs,
  };
}
