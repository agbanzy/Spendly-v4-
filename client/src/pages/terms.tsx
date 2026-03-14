import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer" data-testid="link-terms-home">
              <img src="/financiar-logo.png" alt="Financiar" className="h-14 w-14 rounded-xl" />
              <span className="font-bold text-xl">Financiar</span>
            </div>
          </Link>
          <Link href="/">
            <Button variant="ghost" size="sm" data-testid="button-terms-back">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold mb-2" data-testid="text-terms-title">Terms of Service</h1>
        <p className="text-muted-foreground mb-10">Last updated: March 8, 2026</p>

        <div className="prose dark:prose-invert max-w-none space-y-8 text-muted-foreground">
          {/* 1 */}
          <section>
            <h2 className="text-xl font-semibold text-foreground">1. Agreement to Terms</h2>
            <p>
              These Terms of Service ("Terms") constitute a legally binding agreement between you (the "User," "you," or "your") — whether an individual or an entity — and Financiar Inc. ("Financiar," "we," "us," or "our"). By creating an account, accessing, or using any of our services, you acknowledge that you have read, understood, and agree to be bound by these Terms and our <Link href="/privacy" className="text-primary underline">Privacy Policy</Link>. If you do not agree to these Terms, do not access or use our services.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-xl font-semibold text-foreground">2. Eligibility</h2>
            <p>Our services are intended for business use. By using Financiar, you represent and warrant that:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>You are at least 18 years of age;</li>
              <li>You have the legal authority to enter into these Terms on behalf of yourself or the entity you represent;</li>
              <li>Your use of Financiar complies with all applicable laws and regulations in your jurisdiction;</li>
              <li>You are not located in, or a national or resident of, any country subject to comprehensive trade sanctions.</li>
            </ul>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-xl font-semibold text-foreground">3. Description of Services</h2>
            <p>
              Financiar provides a cloud-based financial management platform for businesses ("Services"), which may include:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Expense tracking, categorization, and approval workflows;</li>
              <li>Budget management and financial analytics;</li>
              <li>Bank transfer initiation and payment processing (facilitated by third-party payment processors);</li>
              <li>Virtual and physical card issuance and management;</li>
              <li>Payroll processing and disbursement;</li>
              <li>Invoice creation, sending, and payment collection;</li>
              <li>Vendor and supplier management;</li>
              <li>Multi-currency wallet and account management.</li>
            </ul>
            <p className="mt-3 font-medium text-foreground">
              IMPORTANT: Financiar is not a bank, money services business, or licensed financial institution. Payment processing, card issuance, and fund custody services are provided by our banking and payment partners, including Stripe, Inc. and Paystack Payments Limited, subject to their own terms of service. Your use of payment features constitutes agreement to the applicable partner's terms.
            </p>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-xl font-semibold text-foreground">4. Account Registration and Security</h2>
            <p>You agree to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Provide accurate, current, and complete information during registration;</li>
              <li>Maintain and promptly update your account information;</li>
              <li>Keep your login credentials and transaction PIN confidential;</li>
              <li>Immediately notify us of any unauthorized access to or use of your account;</li>
              <li>Accept responsibility for all activities that occur under your account.</li>
            </ul>
            <p className="mt-3">
              We reserve the right to suspend or terminate accounts that contain inaccurate information, are used in violation of these Terms, or pose a security risk.
            </p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-xl font-semibold text-foreground">5. Fees and Payment</h2>
            <p>
              Certain features of the Services require payment of fees. All fees are stated in the currency applicable to your account and are exclusive of taxes unless otherwise indicated.
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Subscription fees</strong> are billed in advance on a recurring basis (monthly or annually) and are non-refundable except as required by applicable law.</li>
              <li><strong>Transaction fees</strong> (transfers, card transactions, payroll processing) are charged per transaction as disclosed in our pricing schedule.</li>
              <li><strong>Currency conversion</strong> fees apply to cross-currency transactions at the rate disclosed at the time of the transaction.</li>
              <li>We may change our fees upon 30 days' prior written notice. Continued use after the effective date constitutes acceptance of the new fees.</li>
            </ul>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-xl font-semibold text-foreground">6. Acceptable Use</h2>
            <p>You agree not to use the Services to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Violate any applicable law, regulation, or third-party rights;</li>
              <li>Process transactions for illegal goods or services;</li>
              <li>Engage in money laundering, terrorist financing, or sanctions evasion;</li>
              <li>Submit false, misleading, or fraudulent transaction information;</li>
              <li>Attempt to circumvent security controls, transaction limits, or approval workflows;</li>
              <li>Use the platform for personal (non-business) financial management;</li>
              <li>Interfere with, disrupt, or create an undue burden on the Services or connected infrastructure;</li>
              <li>Reverse-engineer, decompile, or attempt to extract source code from the Services.</li>
            </ul>
            <p className="mt-3">
              We may investigate suspected violations and cooperate with law enforcement. Violations may result in immediate suspension or termination of your account.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-xl font-semibold text-foreground">7. KYC and Compliance Obligations</h2>
            <p>
              To comply with anti-money laundering (AML) and know-your-customer (KYC) regulations, we may require you to provide identity verification documents, proof of business registration, beneficial ownership information, or other documentation. You agree to provide such information promptly and accurately. We reserve the right to restrict, suspend, or close your account if verification requirements are not met.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-xl font-semibold text-foreground">8. Intellectual Property</h2>
            <p>
              All rights, title, and interest in the Services — including software, designs, trademarks, logos, and documentation — are and shall remain the exclusive property of Financiar and its licensors. These Terms grant you no right, title, or interest in the Services except for a limited, non-exclusive, non-transferable, revocable license to use the Services in accordance with these Terms.
            </p>
            <p className="mt-3">
              You retain all rights to the data you submit to the Services ("User Data"). By using the Services, you grant Financiar a limited license to process User Data solely to provide and improve the Services.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-xl font-semibold text-foreground">9. Third-Party Services</h2>
            <p>
              The Services integrate with third-party providers including, but not limited to:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Stripe, Inc.</strong> — Payment processing, card issuance, and fund transfers for supported regions;</li>
              <li><strong>Paystack Payments Limited</strong> — Payment processing and bank transfers for African markets;</li>
              <li><strong>Amazon Web Services (AWS)</strong> — Cloud infrastructure, authentication (Cognito), and notification services.</li>
            </ul>
            <p className="mt-3">
              Your use of third-party services is subject to their respective terms and privacy policies. We are not responsible for the acts or omissions of third-party providers, including payment processing delays, outages, or errors.
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-xl font-semibold text-foreground">10. Disclaimer of Warranties</h2>
            <p className="font-medium text-foreground">
              THE SERVICES ARE PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, STATUTORY, OR OTHERWISE, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT.
            </p>
            <p className="mt-3">
              Without limiting the foregoing, Financiar does not warrant that: (a) the Services will be uninterrupted, timely, secure, or error-free; (b) the results obtained from the Services will be accurate or reliable; (c) the Services will meet your specific requirements; or (d) any errors in the Services will be corrected.
            </p>
            <p className="mt-3">
              We do not provide tax, legal, or financial advice. Any financial data, reports, or analytics provided through the Services are for informational purposes only and should not be relied upon as the sole basis for any financial decision.
            </p>
          </section>

          {/* 11 */}
          <section>
            <h2 className="text-xl font-semibold text-foreground">11. Limitation of Liability</h2>
            <p className="font-medium text-foreground">
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL FINANCIAR, ITS AFFILIATES, OFFICERS, DIRECTORS, EMPLOYEES, OR AGENTS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, REVENUE, BUSINESS OPPORTUNITIES, OR GOODWILL, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF OR INABILITY TO USE THE SERVICES, REGARDLESS OF THE THEORY OF LIABILITY.
            </p>
            <p className="mt-3 font-medium text-foreground">
              FINANCIAR'S TOTAL AGGREGATE LIABILITY TO YOU FOR ALL CLAIMS ARISING FROM OR RELATING TO THESE TERMS OR THE SERVICES SHALL NOT EXCEED THE GREATER OF: (A) THE TOTAL FEES PAID BY YOU TO FINANCIAR DURING THE TWELVE (12) MONTHS IMMEDIATELY PRECEDING THE EVENT GIVING RISE TO THE CLAIM; OR (B) ONE HUNDRED U.S. DOLLARS (USD $100).
            </p>
            <p className="mt-3">
              This limitation applies regardless of whether any remedy fails of its essential purpose. Some jurisdictions do not allow the exclusion or limitation of certain damages, so these limitations may not apply to you to the extent prohibited by applicable law.
            </p>
          </section>

          {/* 12 */}
          <section>
            <h2 className="text-xl font-semibold text-foreground">12. Indemnification</h2>
            <p>
              You agree to indemnify, defend, and hold harmless Financiar and its affiliates, officers, directors, employees, and agents from and against any and all claims, liabilities, damages, losses, costs, and expenses (including reasonable attorneys' fees) arising from or related to: (a) your use of the Services; (b) your violation of these Terms; (c) your violation of any applicable law or regulation; (d) any data or content you submit through the Services; or (e) your negligence or willful misconduct.
            </p>
          </section>

          {/* 13 */}
          <section>
            <h2 className="text-xl font-semibold text-foreground">13. Dispute Resolution</h2>
            <p>
              <strong>Informal Resolution.</strong> Before initiating any formal proceeding, you agree to first contact us at legal@thefinanciar.com and attempt to resolve the dispute informally for at least 30 days.
            </p>
            <p className="mt-3">
              <strong>Binding Arbitration.</strong> If the dispute is not resolved informally, any claim or controversy arising from or relating to these Terms or the Services shall be resolved by binding arbitration administered by the American Arbitration Association (AAA) under its Commercial Arbitration Rules. The arbitration shall be conducted in English, and the seat of arbitration shall be Wilmington, Delaware, USA.
            </p>
            <p className="mt-3">
              <strong>Class Action Waiver.</strong> ALL CLAIMS AND DISPUTES MUST BE BROUGHT IN YOUR INDIVIDUAL CAPACITY, AND NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY PURPORTED CLASS, COLLECTIVE, OR REPRESENTATIVE PROCEEDING.
            </p>
            <p className="mt-3">
              <strong>Exceptions.</strong> Either party may seek injunctive or equitable relief in any court of competent jurisdiction. Claims within the jurisdiction of a small claims court may be brought there.
            </p>
            <p className="mt-3">
              <strong>EU/EEA Users.</strong> If you are located in the European Union or European Economic Area, you may also refer disputes to the European Commission's Online Dispute Resolution platform. Nothing in this section limits your rights under mandatory consumer protection laws of your jurisdiction.
            </p>
          </section>

          {/* 14 */}
          <section>
            <h2 className="text-xl font-semibold text-foreground">14. Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the State of Delaware, United States, without regard to its conflict of law provisions. For users subject to EU law, mandatory provisions of local consumer protection law shall apply to the extent they cannot be waived.
            </p>
          </section>

          {/* 15 */}
          <section>
            <h2 className="text-xl font-semibold text-foreground">15. Termination</h2>
            <p>
              <strong>By You.</strong> You may terminate your account at any time through your account settings or by contacting support. Termination does not relieve you of any obligation to pay fees incurred prior to termination.
            </p>
            <p className="mt-3">
              <strong>By Us.</strong> We may suspend or terminate your access to the Services immediately and without prior notice for cause, including but not limited to: violation of these Terms, suspected fraud, regulatory requirements, or prolonged inactivity. We will endeavor to provide reasonable notice when practicable.
            </p>
            <p className="mt-3">
              <strong>Effect of Termination.</strong> Upon termination: (a) your license to use the Services immediately ceases; (b) you must pay any outstanding fees; (c) we will make your User Data available for export for 30 days, after which we may delete it in accordance with our data retention policies; (d) provisions that by their nature should survive termination will survive, including Sections 8, 10, 11, 12, 13, and 14.
            </p>
          </section>

          {/* 16 */}
          <section>
            <h2 className="text-xl font-semibold text-foreground">16. Force Majeure</h2>
            <p>
              Financiar shall not be liable for any failure or delay in performing its obligations under these Terms caused by circumstances beyond its reasonable control, including but not limited to: natural disasters, pandemics, government actions, payment processor outages, banking system failures, cyberattacks, internet service disruptions, or power outages.
            </p>
          </section>

          {/* 17 */}
          <section>
            <h2 className="text-xl font-semibold text-foreground">17. Modifications to Terms</h2>
            <p>
              We reserve the right to modify these Terms at any time. We will provide at least 30 days' notice of material changes by email or prominent notice within the Services. Your continued use of the Services after the effective date of the revised Terms constitutes your acceptance of the changes. If you do not agree to the revised Terms, you must stop using the Services and close your account before the effective date.
            </p>
          </section>

          {/* 18 */}
          <section>
            <h2 className="text-xl font-semibold text-foreground">18. General Provisions</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Entire Agreement.</strong> These Terms, together with the Privacy Policy and any applicable supplemental terms, constitute the entire agreement between you and Financiar.</li>
              <li><strong>Severability.</strong> If any provision of these Terms is held invalid or unenforceable, the remaining provisions shall remain in full force and effect.</li>
              <li><strong>Waiver.</strong> No waiver of any term shall be deemed a further or continuing waiver of such term or any other term.</li>
              <li><strong>Assignment.</strong> You may not assign or transfer these Terms without our prior written consent. We may assign these Terms freely in connection with a merger, acquisition, or sale of assets.</li>
              <li><strong>No Agency.</strong> Nothing in these Terms creates a partnership, joint venture, employment, or agency relationship between you and Financiar.</li>
              <li><strong>Notices.</strong> Notices to you will be sent to the email address associated with your account. Notices to Financiar should be sent to legal@thefinanciar.com.</li>
            </ul>
          </section>

          {/* 19 */}
          <section>
            <h2 className="text-xl font-semibold text-foreground">19. Contact Us</h2>
            <p>
              If you have questions about these Terms of Service, please contact us:
            </p>
            <ul className="list-none pl-0 space-y-1 mt-2">
              <li><strong>Email:</strong> legal@thefinanciar.com</li>
              <li><strong>Support:</strong> support@thefinanciar.com</li>
            </ul>
          </section>
        </div>
      </main>
    </div>
  );
}
