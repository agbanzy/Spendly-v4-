import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer" data-testid="link-privacy-home">
              <img src="/financiar-logo.svg" alt="Financiar" className="h-10 w-10 rounded-xl" />
              <span className="font-bold text-xl">Financiar</span>
            </div>
          </Link>
          <Link href="/">
            <Button variant="ghost" size="sm" data-testid="button-privacy-back">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold mb-2" data-testid="text-privacy-title">Privacy Policy</h1>
        <p className="text-muted-foreground mb-10">Last updated: March 8, 2026</p>

        <div className="prose dark:prose-invert max-w-none space-y-8 text-muted-foreground">
          {/* 1 */}
          <section>
            <h2 className="text-xl font-semibold text-foreground">1. Introduction</h2>
            <p>
              Financiar Inc. ("Financiar," "we," "us," or "our") is committed to protecting the privacy of our users. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our financial management platform and related services (collectively, the "Services"). This policy applies to all users worldwide, including the European Economic Area (EEA), United Kingdom, United States, Nigeria, South Africa, and other jurisdictions where we operate.
            </p>
            <p className="mt-3">
              For the purposes of the EU General Data Protection Regulation (GDPR), Financiar acts as the <strong>data controller</strong> for your account and billing data, and as a <strong>data processor</strong> on behalf of your organization for employee and financial data processed through the platform. For data protection inquiries, contact us at privacy@thefinanciar.com.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-xl font-semibold text-foreground">2. Information We Collect</h2>

            <h3 className="text-lg font-medium text-foreground mt-4">2.1 Information You Provide</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Account Information:</strong> Name, email address, phone number, company name, job title, country, and password credentials.</li>
              <li><strong>Business Information:</strong> Company registration details, tax identification numbers, industry, and business address.</li>
              <li><strong>Financial Data:</strong> Bank account details, payment card information (collected directly by our payment processors — not stored on our servers), transaction records, expense reports, invoices, and payroll data.</li>
              <li><strong>Identity Verification:</strong> Government-issued identification, proof of address, and beneficial ownership information as required for KYC/AML compliance.</li>
              <li><strong>Communications:</strong> Support requests, feedback, and other correspondence with us.</li>
            </ul>

            <h3 className="text-lg font-medium text-foreground mt-4">2.2 Information Collected Automatically</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Device Information:</strong> IP address, browser type, operating system, device identifiers, and screen resolution.</li>
              <li><strong>Usage Data:</strong> Pages visited, features used, timestamps, click patterns, and session duration.</li>
              <li><strong>Log Data:</strong> Server logs including access times, error logs, and referring URLs.</li>
              <li><strong>Location Data:</strong> Approximate geographic location derived from IP address (we do not collect precise GPS data).</li>
            </ul>

            <h3 className="text-lg font-medium text-foreground mt-4">2.3 Information from Third Parties</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Payment Processors:</strong> Transaction status, settlement confirmations, and fraud screening results from Stripe and Paystack.</li>
              <li><strong>Authentication Providers:</strong> Profile information from Google OAuth or other single sign-on providers you choose to use.</li>
              <li><strong>Identity Verification Services:</strong> KYC verification results and risk assessments.</li>
            </ul>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-xl font-semibold text-foreground">3. Legal Bases for Processing (GDPR)</h2>
            <p>If you are in the EEA or UK, we process your personal data on the following legal bases:</p>
            <div className="overflow-x-auto mt-3">
              <table className="min-w-full border border-border text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="border border-border px-4 py-2 text-left font-semibold text-foreground">Purpose</th>
                    <th className="border border-border px-4 py-2 text-left font-semibold text-foreground">Legal Basis</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td className="border border-border px-4 py-2">Providing the Services</td><td className="border border-border px-4 py-2">Performance of contract</td></tr>
                  <tr><td className="border border-border px-4 py-2">Processing payments and transfers</td><td className="border border-border px-4 py-2">Performance of contract</td></tr>
                  <tr><td className="border border-border px-4 py-2">KYC/AML identity verification</td><td className="border border-border px-4 py-2">Legal obligation</td></tr>
                  <tr><td className="border border-border px-4 py-2">Fraud prevention and security</td><td className="border border-border px-4 py-2">Legitimate interest</td></tr>
                  <tr><td className="border border-border px-4 py-2">Product analytics and improvement</td><td className="border border-border px-4 py-2">Legitimate interest</td></tr>
                  <tr><td className="border border-border px-4 py-2">Marketing communications</td><td className="border border-border px-4 py-2">Consent (opt-in)</td></tr>
                  <tr><td className="border border-border px-4 py-2">Tax and financial record keeping</td><td className="border border-border px-4 py-2">Legal obligation</td></tr>
                  <tr><td className="border border-border px-4 py-2">Responding to support requests</td><td className="border border-border px-4 py-2">Performance of contract / Legitimate interest</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-xl font-semibold text-foreground">4. How We Use Your Information</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Operate, maintain, and improve the Services;</li>
              <li>Process transactions, transfers, payroll disbursements, and invoice payments;</li>
              <li>Verify your identity and comply with AML/KYC requirements;</li>
              <li>Detect, prevent, and investigate fraud, unauthorized access, and other illegal activities;</li>
              <li>Send transactional notifications (payment confirmations, approval requests, security alerts);</li>
              <li>Provide customer support and respond to inquiries;</li>
              <li>Generate anonymized, aggregated analytics to improve the platform;</li>
              <li>Comply with legal obligations, regulatory requirements, and law enforcement requests;</li>
              <li>Enforce our Terms of Service and protect our rights and property.</li>
            </ul>
            <p className="mt-3">
              We do <strong>not</strong> use your financial data for advertising, sell your personal information, or provide it to third parties for their own marketing purposes.
            </p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-xl font-semibold text-foreground">5. Information Sharing and Sub-Processors</h2>
            <p>We share your information only as described below:</p>

            <div className="overflow-x-auto mt-3">
              <table className="min-w-full border border-border text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="border border-border px-4 py-2 text-left font-semibold text-foreground">Sub-Processor</th>
                    <th className="border border-border px-4 py-2 text-left font-semibold text-foreground">Purpose</th>
                    <th className="border border-border px-4 py-2 text-left font-semibold text-foreground">Data Shared</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-border px-4 py-2">Stripe, Inc.</td>
                    <td className="border border-border px-4 py-2">Payment processing, card issuance (US/EU/AU)</td>
                    <td className="border border-border px-4 py-2">Transaction data, identity, card details</td>
                  </tr>
                  <tr>
                    <td className="border border-border px-4 py-2">Paystack Payments Ltd.</td>
                    <td className="border border-border px-4 py-2">Payment processing, bank transfers (Africa)</td>
                    <td className="border border-border px-4 py-2">Transaction data, identity, bank details</td>
                  </tr>
                  <tr>
                    <td className="border border-border px-4 py-2">Amazon Web Services (AWS)</td>
                    <td className="border border-border px-4 py-2">Cloud infrastructure, authentication (Cognito), email (SES)</td>
                    <td className="border border-border px-4 py-2">All platform data (encrypted at rest and in transit)</td>
                  </tr>
                  <tr>
                    <td className="border border-border px-4 py-2">Google (Firebase Auth)</td>
                    <td className="border border-border px-4 py-2">Authentication, OAuth</td>
                    <td className="border border-border px-4 py-2">Auth credentials, profile data</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="mt-3">We may also disclose information:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Legal Compliance:</strong> When required by law, court order, subpoena, or regulatory authority;</li>
              <li><strong>Safety:</strong> To protect the rights, safety, or property of Financiar, our users, or the public;</li>
              <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets (you will be notified of any change in controller);</li>
              <li><strong>With Your Consent:</strong> When you explicitly authorize us to share your information.</li>
            </ul>

            <p className="mt-3 font-medium text-foreground">
              Payment card data (card numbers, CVV, expiry dates) is collected directly by our payment processors and is never stored on Financiar's servers. Our payment processors maintain PCI DSS Level 1 compliance.
            </p>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-xl font-semibold text-foreground">6. International Data Transfers</h2>
            <p>
              Your information may be transferred to and processed in countries other than your country of residence, including the United States. When we transfer data outside the EEA, UK, or other jurisdictions with data transfer restrictions, we rely on:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>European Commission adequacy decisions;</li>
              <li>Standard Contractual Clauses (SCCs) approved by the European Commission;</li>
              <li>UK International Data Transfer Agreement or UK Addendum to SCCs;</li>
              <li>Binding corporate rules of our sub-processors;</li>
              <li>Your explicit consent where no other mechanism is available.</li>
            </ul>
            <p className="mt-3">
              For transfers from Nigeria, we comply with the Nigeria Data Protection Act 2023 requirements, including adequacy assessments approved by the Nigeria Data Protection Commission. For transfers from South Africa, we comply with POPIA Section 72 requirements.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-xl font-semibold text-foreground">7. Data Retention</h2>
            <p>We retain your data for the minimum period necessary for the purposes described in this policy:</p>
            <div className="overflow-x-auto mt-3">
              <table className="min-w-full border border-border text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="border border-border px-4 py-2 text-left font-semibold text-foreground">Data Category</th>
                    <th className="border border-border px-4 py-2 text-left font-semibold text-foreground">Retention Period</th>
                    <th className="border border-border px-4 py-2 text-left font-semibold text-foreground">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td className="border border-border px-4 py-2">Account data</td><td className="border border-border px-4 py-2">Duration of account + 30 days</td><td className="border border-border px-4 py-2">Service delivery</td></tr>
                  <tr><td className="border border-border px-4 py-2">Transaction records</td><td className="border border-border px-4 py-2">7 years after transaction</td><td className="border border-border px-4 py-2">Tax/AML legal obligations</td></tr>
                  <tr><td className="border border-border px-4 py-2">KYC/identity documents</td><td className="border border-border px-4 py-2">5 years after account closure</td><td className="border border-border px-4 py-2">AML regulatory requirements</td></tr>
                  <tr><td className="border border-border px-4 py-2">Payroll records</td><td className="border border-border px-4 py-2">7 years after creation</td><td className="border border-border px-4 py-2">Employment/tax law</td></tr>
                  <tr><td className="border border-border px-4 py-2">Usage/log data</td><td className="border border-border px-4 py-2">12 months</td><td className="border border-border px-4 py-2">Security and analytics</td></tr>
                  <tr><td className="border border-border px-4 py-2">Support communications</td><td className="border border-border px-4 py-2">3 years after resolution</td><td className="border border-border px-4 py-2">Service improvement</td></tr>
                  <tr><td className="border border-border px-4 py-2">Marketing consent records</td><td className="border border-border px-4 py-2">Duration of consent + 3 years</td><td className="border border-border px-4 py-2">Consent compliance</td></tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3">After the retention period expires, data is securely deleted or anonymized.</p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-xl font-semibold text-foreground">8. Your Rights</h2>
            <p>Depending on your location, you have the following rights regarding your personal data:</p>

            <h3 className="text-lg font-medium text-foreground mt-4">All Users</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Access:</strong> Request a copy of the personal data we hold about you.</li>
              <li><strong>Correction:</strong> Request correction of inaccurate or incomplete data.</li>
              <li><strong>Deletion:</strong> Request deletion of your personal data, subject to legal retention obligations.</li>
              <li><strong>Data Export:</strong> Receive your data in a structured, machine-readable format (CSV or JSON).</li>
              <li><strong>Opt-Out:</strong> Unsubscribe from marketing communications at any time.</li>
            </ul>

            <h3 className="text-lg font-medium text-foreground mt-4">EEA/UK Users (GDPR)</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Right to restriction of processing;</li>
              <li>Right to object to processing based on legitimate interest;</li>
              <li>Right not to be subject to decisions based solely on automated processing;</li>
              <li>Right to withdraw consent at any time (where processing is based on consent);</li>
              <li>Right to lodge a complaint with your local supervisory authority.</li>
            </ul>

            <h3 className="text-lg font-medium text-foreground mt-4">California Residents (CCPA/CPRA)</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Right to know what personal information is collected and how it is used;</li>
              <li>Right to delete personal information;</li>
              <li>Right to opt out of the sale or sharing of personal information;</li>
              <li>Right to limit use of sensitive personal information;</li>
              <li>Right to non-discrimination for exercising your rights.</li>
            </ul>
            <p className="mt-2">
              <strong>We do not sell or share personal information</strong> as defined under the CCPA/CPRA. We do not use sensitive personal information for purposes other than providing the Services.
            </p>

            <h3 className="text-lg font-medium text-foreground mt-4">Nigerian Users (NDPA 2023)</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>All GDPR-equivalent rights under the Nigeria Data Protection Act;</li>
              <li>Right to be informed about cross-border data transfers;</li>
              <li>Right to lodge a complaint with the Nigeria Data Protection Commission (NDPC).</li>
            </ul>

            <h3 className="text-lg font-medium text-foreground mt-4">South African Users (POPIA)</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Right to access, correction, and deletion;</li>
              <li>Right to object to processing for direct marketing;</li>
              <li>Right to lodge a complaint with the Information Regulator.</li>
            </ul>

            <p className="mt-4">
              To exercise any of these rights, contact us at <strong>privacy@thefinanciar.com</strong>. We will respond within 30 days (or sooner where required by applicable law). We may request identity verification before processing your request.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-xl font-semibold text-foreground">9. Security Measures</h2>
            <p>We implement appropriate technical and organizational measures to protect your data, including:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>AES-256 encryption for data at rest and TLS 1.2+ for data in transit;</li>
              <li>Transaction PIN requirements for sensitive financial operations;</li>
              <li>Role-based access controls and multi-factor authentication;</li>
              <li>Regular security assessments and infrastructure monitoring;</li>
              <li>AWS infrastructure with SOC 2 Type II compliance;</li>
              <li>PCI DSS compliance through our payment processor partnerships (Stripe, Paystack);</li>
              <li>Automated threat detection and incident response procedures.</li>
            </ul>
            <p className="mt-3">
              While we take commercially reasonable measures to protect your data, no system is perfectly secure. In the event of a data breach affecting your personal information, we will notify you and the relevant supervisory authority in accordance with applicable law.
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-xl font-semibold text-foreground">10. Cookies and Tracking Technologies</h2>
            <p>
              We use cookies and similar technologies to operate the platform, remember your preferences, and analyze usage patterns. For detailed information about the cookies we use and how to manage them, please see our <Link href="/cookies" className="text-primary underline">Cookie Policy</Link>.
            </p>
            <p className="mt-3">
              We do not engage in cross-site behavioral advertising tracking. We do not use third-party advertising cookies.
            </p>
          </section>

          {/* 11 */}
          <section>
            <h2 className="text-xl font-semibold text-foreground">11. Children's Privacy</h2>
            <p>
              Our Services are intended for business use by individuals aged 18 and older. We do not knowingly collect personal information from anyone under 18. If we become aware that we have collected data from a minor, we will take steps to delete it promptly. If you believe we have inadvertently collected data from a minor, please contact us at privacy@thefinanciar.com.
            </p>
          </section>

          {/* 12 */}
          <section>
            <h2 className="text-xl font-semibold text-foreground">12. Automated Decision-Making</h2>
            <p>
              We may use automated systems for fraud detection, transaction risk scoring, and compliance screening. These systems may flag or delay transactions based on risk indicators. You have the right to request human review of any automated decision that significantly affects you. Contact support@thefinanciar.com to request a review.
            </p>
          </section>

          {/* 13 */}
          <section>
            <h2 className="text-xl font-semibold text-foreground">13. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time to reflect changes in our practices, technology, or legal requirements. We will provide at least 30 days' notice of material changes by email or prominent notice within the platform. The "Last updated" date at the top of this page indicates when the policy was last revised. Your continued use of the Services after the effective date constitutes acceptance of the updated policy.
            </p>
          </section>

          {/* 14 */}
          <section>
            <h2 className="text-xl font-semibold text-foreground">14. Contact Us</h2>
            <p>If you have questions about this Privacy Policy or our data practices:</p>
            <ul className="list-none pl-0 space-y-1 mt-2">
              <li><strong>Privacy inquiries:</strong> privacy@thefinanciar.com</li>
              <li><strong>Data protection requests:</strong> privacy@thefinanciar.com</li>
              <li><strong>General support:</strong> support@thefinanciar.com</li>
            </ul>
            <p className="mt-3">
              <strong>EU/UK supervisory authority:</strong> You may lodge a complaint with your local data protection authority. A list of EU supervisory authorities is available at <span className="text-primary">edpb.europa.eu</span>.
            </p>
            <p className="mt-2">
              <strong>Nigeria:</strong> Nigeria Data Protection Commission (NDPC) — <span className="text-primary">ndpc.gov.ng</span>
            </p>
            <p className="mt-2">
              <strong>South Africa:</strong> Information Regulator — <span className="text-primary">inforegulator.org.za</span>
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
