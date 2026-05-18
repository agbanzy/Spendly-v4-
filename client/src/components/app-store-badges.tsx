import { cn } from "@/lib/utils";

// Reusable mobile-app-store badges for the landing page (hero + footer)
// and any future marketing surface that wants to surface the mobile app.
//
// Both targets:
//   - iOS (App Store) — link is `pending` until the App Store listing goes
//     live (TestFlight / EAS preview only as of v1.0.3 per mobile/app.json).
//     Until then the badge stays visible but resolves to a coming-soon
//     anchor so the layout stays stable.
//   - Android (Google Play) — package name `com.financiar.app` lives on
//     play.google.com once the listing is published. Until then the URL
//     404s gracefully, which is fine; remove the badge or swap href once
//     the listing is live.

// Centralised URLs so we don't sprinkle dashboard.* strings across the
// codebase. Override per-deploy by editing this file.
const APP_STORE_URL = "#download-ios"; // TODO: replace with https://apps.apple.com/app/financiar/id<APP_ID> when the App Store listing is live
const GOOGLE_PLAY_URL = "https://play.google.com/store/apps/details?id=com.financiar.app";

export interface AppStoreBadgesProps {
  /** Layout direction. Defaults to `row` for the hero; `column` works for narrow footer columns. */
  orientation?: "row" | "column";
  /** Visual size. `sm` is footer-sized, `md` is hero-sized. */
  size?: "sm" | "md";
  /** Optional className applied to the wrapper. */
  className?: string;
}

export function AppStoreBadges({
  orientation = "row",
  size = "md",
  className,
}: AppStoreBadgesProps) {
  const wrapper = cn(
    "flex items-center",
    orientation === "row" ? "flex-row gap-3 flex-wrap" : "flex-col gap-2 items-start",
    className,
  );

  // The actual badge graphics are SVG components below — keeping them inline
  // (rather than as image assets) means no extra HTTP requests, no asset
  // pipeline coupling, and the dark-mode treatment is CSS-controllable.
  const badgeHeight = size === "md" ? "h-12" : "h-10";

  return (
    <div className={wrapper} data-testid="app-store-badges">
      <a
        href={APP_STORE_URL}
        target={APP_STORE_URL.startsWith("http") ? "_blank" : undefined}
        rel={APP_STORE_URL.startsWith("http") ? "noopener noreferrer" : undefined}
        aria-label="Download on the App Store"
        data-testid="badge-app-store"
        className="inline-flex transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
      >
        <AppStoreBadge className={badgeHeight} />
      </a>
      <a
        href={GOOGLE_PLAY_URL}
        target={GOOGLE_PLAY_URL.startsWith("http") ? "_blank" : undefined}
        rel={GOOGLE_PLAY_URL.startsWith("http") ? "noopener noreferrer" : undefined}
        aria-label="Get it on Google Play"
        data-testid="badge-google-play"
        className="inline-flex transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
      >
        <GooglePlayBadge className={badgeHeight} />
      </a>
    </div>
  );
}

// ------- SVG badges -------
// Brand-asset-accurate badges per Apple's MARCOM guidelines + Google's
// brand-asset library. Black-on-white treatment works in both light and
// dark themes; the surrounding link element gets a focus ring for
// keyboard accessibility.

function AppStoreBadge({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 120 40"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-hidden="true"
    >
      <rect width="120" height="40" rx="6" fill="#000" />
      <g fill="#fff">
        <path d="M27.5 21.1c0-2.5 2-3.7 2.1-3.7-1.1-1.7-2.9-1.9-3.6-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.2-.9-1.6 0-3.2.9-4 2.4-1.7 3-.4 7.4 1.2 9.8.8 1.2 1.8 2.5 3.1 2.5 1.2-.1 1.7-.8 3.2-.8s2 .8 3.3.8c1.4 0 2.3-1.2 3.1-2.4 1-1.4 1.4-2.7 1.4-2.8-.1 0-2.6-1-2.6-3.9zm-2.4-7.2c.7-.8 1.1-1.9 1-3-.9.1-2 .6-2.7 1.4-.6.7-1.2 1.8-1 2.9 1 .1 2-.4 2.7-1.3z"/>
        <text x="40" y="16" fontFamily="-apple-system,BlinkMacSystemFont,sans-serif" fontSize="7" fontWeight="400" fill="#fff">Download on the</text>
        <text x="40" y="29" fontFamily="-apple-system,BlinkMacSystemFont,sans-serif" fontSize="14" fontWeight="600" fill="#fff">App Store</text>
      </g>
    </svg>
  );
}

function GooglePlayBadge({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 135 40"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-hidden="true"
    >
      <rect width="135" height="40" rx="6" fill="#000" />
      <g>
        {/* Google Play triangle — 4-colour gradient approximation */}
        <path d="M16.5 9.2c-.4.4-.6 1.1-.6 1.9v17.8c0 .8.2 1.4.6 1.8l.1.1L26.4 21v-.2L16.5 9.1l.1.1z" fill="#5BC9F4"/>
        <path d="M29.7 24.4l-3.3-3.3v-.2l3.3-3.3.1.1 4 2.3c1.1.6 1.1 1.7 0 2.3l-4 2.1z" fill="#FFCE00"/>
        <path d="M29.8 24.3l-3.4-3.4L16.5 30.8c.4.4 1 .4 1.7.1l11.6-6.6" fill="#FF3D44"/>
        <path d="M29.8 17.7L18.2 11c-.7-.4-1.3-.3-1.7.1l9.9 9.8 3.4-3.2z" fill="#48FF48"/>
        <text x="42" y="16" fontFamily="Roboto,Arial,sans-serif" fontSize="7" fontWeight="400" fill="#fff">GET IT ON</text>
        <text x="42" y="29" fontFamily="Roboto,Arial,sans-serif" fontSize="14" fontWeight="500" fill="#fff">Google Play</text>
      </g>
    </svg>
  );
}
