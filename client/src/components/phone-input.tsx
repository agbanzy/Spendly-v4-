import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { SUPPORTED_COUNTRIES } from "@/lib/constants";
import { ChevronDown, Search } from "lucide-react";

interface PhoneInputProps {
  value: string;
  onChange: (fullNumber: string) => void;
  defaultCountry?: string;
  placeholder?: string;
  className?: string;
  id?: string;
  error?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
}

// Country flag emoji from country code
function countryFlag(code: string): string {
  return code
    .toUpperCase()
    .split("")
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
}

// Parse existing value into country code + local number
function parsePhoneValue(value: string): { countryCode: string; localNumber: string } {
  if (!value || !value.startsWith("+")) {
    return { countryCode: "US", localNumber: value || "" };
  }

  // Try to match against known dial codes (longest match first)
  const sorted = [...SUPPORTED_COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
  for (const c of sorted) {
    if (value.startsWith(c.dial)) {
      return { countryCode: c.code, localNumber: value.slice(c.dial.length) };
    }
  }
  return { countryCode: "US", localNumber: value.replace(/^\+/, "") };
}

export function PhoneInput({
  value,
  onChange,
  defaultCountry = "US",
  placeholder,
  className,
  id,
  error,
  disabled,
  autoFocus,
}: PhoneInputProps) {
  const parsed = parsePhoneValue(value);
  const [selectedCountry, setSelectedCountry] = useState(parsed.countryCode || defaultCountry);
  const [localNumber, setLocalNumber] = useState(parsed.localNumber);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const country = SUPPORTED_COUNTRIES.find((c) => c.code === selectedCountry);
  const dialCode = country?.dial || "+1";

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    if (open) {
      document.addEventListener("mousedown", handler);
      setTimeout(() => searchRef.current?.focus(), 50);
    }
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Sync if external value changes
  useEffect(() => {
    const p = parsePhoneValue(value);
    if (p.countryCode !== selectedCountry) setSelectedCountry(p.countryCode);
    if (p.localNumber !== localNumber) setLocalNumber(p.localNumber);
  }, [value]);

  // Sync when parent country selector changes (e.g. signup page country dropdown)
  useEffect(() => {
    if (defaultCountry && defaultCountry !== selectedCountry) {
      const c = SUPPORTED_COUNTRIES.find((x) => x.code === defaultCountry);
      if (c) {
        setSelectedCountry(defaultCountry);
        // Update the full number with new dial code
        if (localNumber) {
          onChange(`${c.dial}${localNumber}`);
        }
      }
    }
  }, [defaultCountry]);

  const handleLocalChange = (num: string) => {
    // Strip non-digits
    const clean = num.replace(/[^\d]/g, "");
    setLocalNumber(clean);
    onChange(clean ? `${dialCode}${clean}` : "");
  };

  const handleCountrySelect = (code: string) => {
    const c = SUPPORTED_COUNTRIES.find((x) => x.code === code);
    if (!c) return;
    setSelectedCountry(code);
    setOpen(false);
    setSearch("");
    onChange(localNumber ? `${c.dial}${localNumber}` : "");
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const filtered = search.trim()
    ? SUPPORTED_COUNTRIES.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.dial.includes(search) ||
          c.code.toLowerCase().includes(search.toLowerCase())
      )
    : SUPPORTED_COUNTRIES;

  return (
    <div className={cn("relative flex", className)}>
      {/* Country picker button */}
      <div ref={dropdownRef} className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(!open)}
          className={cn(
            "flex items-center gap-1 h-11 px-3 rounded-l-lg border border-r-0 bg-muted/40 text-sm font-medium transition-colors hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/30",
            error ? "border-destructive" : "border-input",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <span className="text-base leading-none">{countryFlag(selectedCountry)}</span>
          <span className="text-muted-foreground text-xs">{dialCode}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>

        {/* Dropdown */}
        {open && (
          <div className="absolute top-full left-0 z-50 mt-1 w-72 max-h-64 rounded-lg border bg-popover shadow-lg overflow-hidden">
            {/* Search */}
            <div className="flex items-center gap-2 px-3 py-2 border-b">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search country..."
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            {/* Country list */}
            <div className="overflow-y-auto max-h-48">
              {filtered.length === 0 ? (
                <p className="px-3 py-4 text-sm text-muted-foreground text-center">No countries found</p>
              ) : (
                filtered.map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => handleCountrySelect(c.code)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-accent transition-colors text-left",
                      c.code === selectedCountry && "bg-accent/50 font-medium"
                    )}
                  >
                    <span className="text-base leading-none">{countryFlag(c.code)}</span>
                    <span className="flex-1 truncate">{c.name}</span>
                    <span className="text-muted-foreground text-xs">{c.dial}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Phone number input */}
      <input
        ref={inputRef}
        id={id}
        type="tel"
        inputMode="numeric"
        disabled={disabled}
        autoFocus={autoFocus}
        value={localNumber}
        onChange={(e) => handleLocalChange(e.target.value)}
        placeholder={placeholder || "Phone number"}
        className={cn(
          "flex-1 h-11 rounded-r-lg border bg-background px-3 py-2 text-base shadow-sm ring-offset-background placeholder:text-muted-foreground transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary focus-visible:shadow-[0_0_0_3px_hsl(var(--primary)/0.12)] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          error ? "border-destructive" : "border-input"
        )}
      />
    </div>
  );
}
