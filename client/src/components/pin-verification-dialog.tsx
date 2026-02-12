import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
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
import { Loader2, Lock, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PinVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified: () => void;
  title?: string;
  description?: string;
}

export function PinVerificationDialog({
  open,
  onOpenChange,
  onVerified,
  title = "Enter Transaction PIN",
  description = "Please enter your 4-digit transaction PIN to authorize this action.",
}: PinVerificationDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [pin, setPin] = useState(["", "", "", ""]);
  const [error, setError] = useState("");
  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  useEffect(() => {
    if (open) {
      setPin(["", "", "", ""]);
      setError("");
      setTimeout(() => inputRefs[0].current?.focus(), 100);
    }
  }, [open]);

  const verifyMutation = useMutation({
    mutationFn: async (pinValue: string) => {
      const res = await apiRequest("POST", "/api/user/verify-pin", {
        firebaseUid: user?.id,
        pin: pinValue,
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.valid) {
        onOpenChange(false);
        onVerified();
      } else {
        setError("Incorrect PIN. Please try again.");
        setPin(["", "", "", ""]);
        inputRefs[0].current?.focus();
      }
    },
    onError: () => {
      setError("Failed to verify PIN. Please try again.");
      setPin(["", "", "", ""]);
      inputRefs[0].current?.focus();
    },
  });

  const handleDigitChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newPin = [...pin];
    newPin[index] = value.slice(-1);
    setPin(newPin);
    setError("");

    if (value && index < 3) {
      inputRefs[index + 1].current?.focus();
    }

    if (value && index === 3) {
      const fullPin = newPin.join("");
      if (fullPin.length === 4) {
        verifyMutation.mutate(fullPin);
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
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
    if (pasted.length === 4) {
      const newPin = pasted.split("");
      setPin(newPin);
      verifyMutation.mutate(pasted);
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
              className="w-14 h-14 text-center text-2xl font-bold"
              data-testid={`input-pin-digit-${i}`}
              disabled={verifyMutation.isPending}
              autoComplete="off"
            />
          ))}
        </div>

        {error && (
          <p className="text-sm text-destructive text-center" data-testid="text-pin-error">
            {error}
          </p>
        )}

        {verifyMutation.isPending && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Verifying PIN...
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={verifyMutation.isPending}
            data-testid="button-cancel-pin"
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function usePinVerification() {
  const { user } = useAuth();
  const [isPinRequired, setIsPinRequired] = useState(false);
  const [isPinDialogOpen, setIsPinDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    fetch(`/api/user-profile/${user.id}`)
      .then((res) => res.ok ? res.json() : null)
      .then((profile) => {
        if (profile?.transactionPinEnabled) {
          setIsPinRequired(true);
        }
      })
      .catch(() => {});
  }, [user?.id]);

  const requirePin = (action: () => void) => {
    if (isPinRequired) {
      setPendingAction(() => action);
      setIsPinDialogOpen(true);
    } else {
      action();
    }
  };

  const handlePinVerified = () => {
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  };

  return {
    isPinRequired,
    isPinDialogOpen,
    setIsPinDialogOpen,
    requirePin,
    handlePinVerified,
  };
}
