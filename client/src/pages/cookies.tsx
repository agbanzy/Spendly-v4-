import { Link } from "wouter";
import { ArrowLeft, Cookie, Shield, Settings, BarChart3 } from "lucide-react";

export default function CookiePolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer group">
              <ArrowLeft className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              <img src="/financiar-logo.svg" alt="Financiar" className="h-8 w-8 rounded-lg" />
              <span className="font-bold text-lg">Financiar</span>
            </div>
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Cookie Policy</h1>
          <p className="text-muted-foreground">Last updated: March 8, 2026</p>
        </div>

        <div className="prose prose-slate dark:prose-invert max-w-none space-y-8">
          <section>
            <p className="text-muted-foreground leading-relaxed">
              This Cookie Policy explains how Financiar ("we", "us", "our") uses cookies and similar technologies
              when you visit our platform at app.thefinanciar.com and related services. By using our services,
              you consent to the use of cookies as described in this policy.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Cookie className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-xl font-semibold m-0">What Are Cookies?</h2>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              Cookies are small text files stored on your device when you visit a website. They help us provide
              you with a better experience by remembering your preferences, keeping you signed in, and understanding
              how you use our platform.
            </p>
          </section>

          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-xl font-semibold m-0">Essential Cookies</h2>
            </div>
            <p className="text-muted-foreground leading-relaxed mb-4">
              These cookies are strictly necessary for the platform to function. They cannot be disabled.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-medium">Cookie</th>
                    <th className="text-left py-2 pr-4 font-medium">Purpose</th>
                    <th className="text-left py-2 font-medium">Duration</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b">
                    <td className="py-2 pr-4 font-mono text-xs">CognitoIdentityServiceProvider.*</td>
                    <td className="py-2 pr-4">Authentication session tokens (AWS Cognito)</td>
                    <td className="py-2">1 hour / 30 days (refresh)</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4 font-mono text-xs">sms_id_token</td>
                    <td className="py-2 pr-4">SMS-based authentication session</td>
                    <td className="py-2">Session</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4 font-mono text-xs">pin_cache</td>
                    <td className="py-2 pr-4">Transaction PIN verification cache</td>
                    <td className="py-2">5 minutes</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4 font-mono text-xs">theme</td>
                    <td className="py-2 pr-4">Light/dark mode preference</td>
                    <td className="py-2">Persistent</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Settings className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-xl font-semibold m-0">Functional Cookies</h2>
            </div>
            <p className="text-muted-foreground leading-relaxed mb-4">
              These cookies enable enhanced functionality and personalization.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-medium">Cookie</th>
                    <th className="text-left py-2 pr-4 font-medium">Purpose</th>
                    <th className="text-left py-2 font-medium">Duration</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b">
                    <td className="py-2 pr-4 font-mono text-xs">sidebar_state</td>
                    <td className="py-2 pr-4">Remembers sidebar collapsed/expanded state</td>
                    <td className="py-2">Persistent</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4 font-mono text-xs">locale</td>
                    <td className="py-2 pr-4">Language and regional preferences</td>
                    <td className="py-2">Persistent</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4 font-mono text-xs">onboarding_step</td>
                    <td className="py-2 pr-4">Tracks onboarding progress</td>
                    <td className="py-2">30 days</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-xl font-semibold m-0">Analytics Cookies</h2>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              We may use anonymized analytics to understand how our platform is used and improve the experience.
              We do not use third-party advertising cookies. Any analytics data is aggregated and cannot be used
              to identify individual users.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Third-Party Services</h2>
            <p className="text-muted-foreground leading-relaxed">
              Our platform integrates with the following third-party services that may set their own cookies:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1 mt-2">
              <li><strong>Stripe</strong> — Payment processing and fraud prevention</li>
              <li><strong>Paystack</strong> — Payment processing for African markets</li>
              <li><strong>AWS Cognito</strong> — Authentication and session management</li>
              <li><strong>Google OAuth</strong> — Social sign-in functionality</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-3">
              These services operate under their own privacy and cookie policies. We recommend reviewing their
              respective policies for details on their data practices.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Managing Cookies</h2>
            <p className="text-muted-foreground leading-relaxed">
              You can control cookies through your browser settings. Most browsers allow you to block or delete
              cookies. However, disabling essential cookies will prevent you from using core platform features
              like signing in.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-3">
              To manage cookies in popular browsers:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1 mt-2">
              <li><strong>Chrome:</strong> Settings &gt; Privacy and Security &gt; Cookies</li>
              <li><strong>Firefox:</strong> Settings &gt; Privacy &amp; Security &gt; Cookies</li>
              <li><strong>Safari:</strong> Preferences &gt; Privacy &gt; Manage Website Data</li>
              <li><strong>Edge:</strong> Settings &gt; Cookies and Site Permissions</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Updates to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this Cookie Policy from time to time. Changes will be posted on this page with an
              updated revision date. Continued use of our platform after changes constitutes acceptance of the
              updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have questions about our use of cookies, please contact us at{" "}
              <a href="mailto:privacy@thefinanciar.com" className="text-primary hover:text-primary/80">
                privacy@thefinanciar.com
              </a>.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
