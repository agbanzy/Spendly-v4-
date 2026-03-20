import { storage } from '../storage';
import type { InsertNotification, NotificationSettings } from '@shared/schema';
import { SESClient, SendRawEmailCommand } from '@aws-sdk/client-ses';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

interface SendNotificationOptions {
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  channels?: ('in_app' | 'email' | 'sms' | 'push')[];
}

interface EmailConfig {
  to: string;
  subject: string;
  html: string;
  text: string;
}

interface SmsConfig {
  to: string;
  body: string;
}

type EmailProvider = 'smtp' | 'aws' | 'none';
type SmsProvider = 'aws' | 'none';

// Security: URL validation to prevent XSS in actionUrl
function sanitizeUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  // Only allow relative paths or https/http URLs
  if (url.startsWith('/')) return url;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return url;
  } catch {}
  return undefined;
}

// Security: Email validation
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Security: SMS text sanitization to remove control characters
function sanitizeSmsText(text: string): string {
  // Remove control characters and limit length
  return text.replace(/[\x00-\x1F\x7F]/g, '').substring(0, 160);
}

class NotificationService {
  private sesClient: SESClient | null = null;
  private snsClient: SNSClient | null = null;
  private smtpTransporter: Transporter | null = null;
  private emailProvider: EmailProvider = 'none';
  private smsProvider: SmsProvider = 'none';

  constructor() {
    this.initializeClients();
  }

  private initializeClients() {
    // Priority 1: Microsoft 365 / SMTP (preferred)
    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (smtpHost && smtpUser && smtpPass) {
      try {
        this.smtpTransporter = nodemailer.createTransport({
          host: smtpHost,
          port: parseInt(process.env.SMTP_PORT || '587', 10),
          secure: process.env.SMTP_SECURE === 'true', // true for 465, false for 587 (STARTTLS)
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
          tls: {
            // Microsoft 365 requires TLS
            ciphers: 'SSLv3',
            rejectUnauthorized: true,
          },
        });
        this.emailProvider = 'smtp';
        console.log(`SMTP email client initialized (${smtpHost}, user: ${smtpUser})`);
      } catch (error) {
        console.log('SMTP client initialization failed:', error);
      }
    }

    // Priority 2: AWS SES (fallback)
    const region = process.env.AWS_REGION;
    const hasExplicitCreds = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY;
    const isOnAWS = process.env.ECS_CONTAINER_METADATA_URI_V4 || process.env.AWS_EXECUTION_ENV;
    const canUseAWS = region && (hasExplicitCreds || isOnAWS);

    if (canUseAWS) {
      const clientConfig: Record<string, any> = { region };
      if (hasExplicitCreds) {
        clientConfig.credentials = {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        };
      }

      if (this.emailProvider === 'none') {
        try {
          this.sesClient = new SESClient(clientConfig);
          this.emailProvider = 'aws';
          console.log('AWS SES client initialized' + (hasExplicitCreds ? ' (explicit credentials)' : ' (IAM role)'));
        } catch (error) {
          console.log('AWS SES client initialization failed:', error);
        }
      }

      try {
        this.snsClient = new SNSClient(clientConfig);
        this.smsProvider = 'aws';
        console.log('AWS SNS client initialized' + (hasExplicitCreds ? ' (explicit credentials)' : ' (IAM role)'));
      } catch (error) {
        console.log('AWS SNS client initialization failed:', error);
      }
    }

    console.log(`Notification providers - Email: ${this.emailProvider}, SMS: ${this.smsProvider}`);
  }

  async send(options: SendNotificationOptions): Promise<void> {
    const { userId, type, title, message, data, channels = ['in_app'] } = options;

    let settings = await storage.getNotificationSettings(userId);
    
    // If no notification settings, try to auto-create from user profile
    if (!settings) {
      try {
        const profile = await storage.getUserProfileByCognitoSub(userId);
        if (profile) {
          const now = new Date().toISOString();
          settings = await storage.createNotificationSettings({
            userId,
            emailEnabled: true,
            smsEnabled: !!profile.phoneNumber,
            pushEnabled: true,
            inAppEnabled: true,
            email: profile.email,
            phone: profile.phoneNumber || null,
            pushToken: null,
            expenseNotifications: true,
            paymentNotifications: true,
            billNotifications: true,
            budgetNotifications: true,
            securityNotifications: true,
            marketingNotifications: false,
            createdAt: now,
            updatedAt: now,
          });
        }
      } catch (err) {
        console.error('Failed to auto-create notification settings:', err);
      }
    }

    // Fallback: if settings still missing email, look up from profile
    let recipientEmail = settings?.email;
    let recipientPhone = settings?.phone;
    if (!recipientEmail || !recipientPhone) {
      try {
        const profile = await storage.getUserProfileByCognitoSub(userId);
        if (profile) {
          if (!recipientEmail) recipientEmail = profile.email;
          if (!recipientPhone) recipientPhone = profile.phoneNumber || undefined;
        }
      } catch (e) { /* ignore */ }
    }

    const enabledChannels = this.getEnabledChannels(settings, channels, type);

    const now = new Date().toISOString();
    const notification: InsertNotification = {
      userId,
      type,
      title,
      message,
      data: data || null,
      channels: enabledChannels,
      read: false,
      readAt: null,
      emailSent: false,
      smsSent: false,
      pushSent: false,
      createdAt: now,
    };

    const created = await storage.createNotification(notification);

    const promises: Promise<void>[] = [];

    if (enabledChannels.includes('email') && recipientEmail && isValidEmail(recipientEmail)) {
      promises.push(this.sendEmail({
        to: recipientEmail,
        subject: title,
        html: this.formatEmailHtml(title, message, data),
        text: message,
      }).then(() => {
        storage.updateNotification(created.id, { emailSent: true });
      }).catch(console.error));
    }

    if (enabledChannels.includes('sms') && recipientPhone) {
      promises.push(this.sendSms({
        to: recipientPhone,
        body: `${title}: ${message}`,
      }).then(() => {
        storage.updateNotification(created.id, { smsSent: true });
      }).catch(console.error));
    }

    if (enabledChannels.includes('push')) {
      promises.push(this.sendPushNotification(userId, title, message, data)
        .then(() => {
          storage.updateNotification(created.id, { pushSent: true });
        }).catch(console.error));
    }

    await Promise.allSettled(promises);
  }

  private getEnabledChannels(
    settings: NotificationSettings | null,
    requestedChannels: string[],
    type: string
  ): string[] {
    if (!settings) {
      return ['in_app'];
    }

    const channels: string[] = [];

    if (settings.inAppEnabled && requestedChannels.includes('in_app')) {
      channels.push('in_app');
    }

    if (settings.emailEnabled && requestedChannels.includes('email')) {
      if (this.isNotificationTypeEnabled(settings, type)) {
        channels.push('email');
      }
    }

    if (settings.smsEnabled && requestedChannels.includes('sms')) {
      if (this.isNotificationTypeEnabled(settings, type)) {
        channels.push('sms');
      }
    }

    if (settings.pushEnabled && requestedChannels.includes('push')) {
      if (this.isNotificationTypeEnabled(settings, type)) {
        channels.push('push');
      }
    }

    return channels.length > 0 ? channels : ['in_app'];
  }

  private isNotificationTypeEnabled(settings: NotificationSettings, type: string): boolean {
    if (type.includes('expense')) return settings.expenseNotifications;
    if (type.includes('payment')) return settings.paymentNotifications;
    if (type.includes('bill')) return settings.billNotifications;
    if (type.includes('budget')) return settings.budgetNotifications;
    if (type.includes('kyc') || type.includes('security')) return settings.securityNotifications;
    return true;
  }

  private getAppUrl(): string {
    return process.env.APP_URL || 'https://thefinanciar.com';
  }

  async sendEmail(config: EmailConfig): Promise<void> {
    const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.AWS_SES_FROM_EMAIL || 'noreply@thefinanciar.com';
    const fromName = process.env.SMTP_FROM_NAME || process.env.AWS_SES_FROM_NAME || 'Financiar';
    const formattedFrom = `${fromName} <${fromEmail}>`;
    const appUrl = this.getAppUrl();
    const plainText = config.text || config.html.replace(/<[^>]*>/g, '');

    // Priority 1: SMTP (Microsoft 365 / custom SMTP)
    if (this.emailProvider === 'smtp' && this.smtpTransporter) {
      try {
        await this.smtpTransporter.sendMail({
          from: formattedFrom,
          to: config.to,
          subject: config.subject,
          text: plainText,
          html: config.html,
          headers: {
            'X-Mailer': 'Financiar/1.0',
            'List-Unsubscribe': `<mailto:unsubscribe@thefinanciar.com>, <${appUrl}/settings>`,
          },
        });
        console.log('Email sent via SMTP to:', config.to);
        return;
      } catch (error) {
        console.error('Failed to send email via SMTP:', error);
        throw error;
      }
    }

    // Priority 2: AWS SES (fallback)
    if (this.emailProvider === 'aws' && this.sesClient) {
      try {
        const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2)}`;

        const rawEmail = [
          `MIME-Version: 1.0`,
          `From: ${formattedFrom}`,
          `To: ${config.to}`,
          `Subject: =?UTF-8?B?${Buffer.from(config.subject).toString('base64')}?=`,
          `List-Unsubscribe: <mailto:unsubscribe@thefinanciar.com>, <${appUrl}/settings>`,
          `Reply-To: support@thefinanciar.com`,
          `X-Mailer: Financiar/1.0`,
          `Precedence: bulk`,
          `Content-Type: multipart/alternative; boundary="${boundary}"`,
          ``,
          `--${boundary}`,
          `Content-Type: text/plain; charset=UTF-8`,
          `Content-Transfer-Encoding: 7bit`,
          ``,
          plainText,
          ``,
          `--${boundary}`,
          `Content-Type: text/html; charset=UTF-8`,
          `Content-Transfer-Encoding: 7bit`,
          ``,
          config.html,
          ``,
          `--${boundary}--`,
        ].join('\r\n');

        const command = new SendRawEmailCommand({
          RawMessage: {
            Data: Buffer.from(rawEmail),
          },
        });

        await this.sesClient.send(command);
        console.log('Email sent via AWS SES (raw) to:', config.to);
        return;
      } catch (error) {
        console.error('Failed to send email via AWS SES:', error);
        throw error;
      }
    }

    console.log('No email provider configured, skipping email:', config.subject);
  }

  async sendSms(config: SmsConfig): Promise<void> {
    if (this.smsProvider === 'aws' && this.snsClient) {
      try {
        const command = new PublishCommand({
          PhoneNumber: config.to,
          Message: config.body,
          MessageAttributes: {
            'AWS.SNS.SMS.SenderID': {
              DataType: 'String',
              StringValue: process.env.AWS_SNS_SENDER_ID || 'Financiar',
            },
            'AWS.SNS.SMS.SMSType': {
              DataType: 'String',
              StringValue: 'Transactional',
            },
          },
        });

        await this.snsClient.send(command);
        console.log('SMS sent via AWS SNS to:', config.to);
        return;
      } catch (error) {
        console.error('Failed to send SMS via AWS SNS:', error);
        throw error;
      }
    }

    console.log('No SMS provider configured, skipping SMS:', config.body);
  }

  async sendPushNotification(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, unknown>
  ): Promise<void> {
    const tokens = await storage.getPushTokens(userId);
    
    if (!tokens || tokens.length === 0) {
      console.log('No push tokens for user:', userId);
      return;
    }

    for (const tokenRecord of tokens) {
      try {
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: tokenRecord.token,
            title,
            body,
            data,
            sound: 'default',
          }),
        });

        if (!response.ok) {
          console.error('Push notification failed:', await response.text());
        } else {
          console.log('Push notification sent to:', tokenRecord.platform);
        }
      } catch (error) {
        console.error('Failed to send push notification:', error);
      }
    }
  }

  private getCurrencySymbol(currency: string): string {
    const symbols: Record<string, string> = {
      USD: '$', EUR: '\u20AC', GBP: '\u00A3', NGN: '\u20A6', 
      KES: 'KSh', GHS: '\u20B5', ZAR: 'R', EGP: 'E\u00A3',
      RWF: 'RF', XOF: 'CFA', CAD: 'C$', AUD: 'A$',
    };
    return symbols[currency] || currency + ' ';
  }

  private escapeHtml(unsafe: string): string {
    if (!unsafe) return '';
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private buildEmailTemplate(options: {
    preheader: string;
    headerTitle: string;
    headerColor?: string;
    bodyHtml: string;
    plainText: string;
  }): { html: string; text: string } {
    const appUrl = this.getAppUrl();
    const headerBg = options.headerColor || 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)';

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(options.headerTitle)}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px;">
  <div style="display:none;font-size:1px;color:#f4f4f5;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
    ${this.escapeHtml(options.preheader)}
  </div>
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    <div style="background: ${headerBg}; padding: 32px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px;">${this.escapeHtml(options.headerTitle)}</h1>
    </div>
    <div style="padding: 32px;">
      ${options.bodyHtml}
    </div>
    <div style="background-color: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0 0 8px 0;">
        You are receiving this because you have an account with Financiar.
      </p>
      <p style="color: #9ca3af; font-size: 12px; margin: 0 0 8px 0;">
        <a href="${appUrl}/settings" style="color: #6366f1; text-decoration: underline;">Manage notification preferences</a>
      </p>
      <p style="color: #9ca3af; font-size: 11px; margin: 0;">
        Financiar Inc., 1 Market Street, San Francisco, CA 94105
      </p>
    </div>
  </div>
</body>
</html>`;

    const plainFooter = `\n\n---\nYou are receiving this because you have an account with Financiar.\nManage notification preferences: ${appUrl}/settings\nFinanciar Inc., 1 Market Street, San Francisco, CA 94105`;

    return {
      html,
      text: options.plainText + plainFooter,
    };
  }

  private formatEmailHtml(title: string, message: string, data?: Record<string, unknown>): string {
    const { html } = this.buildEmailTemplate({
      preheader: message.substring(0, 100),
      headerTitle: title,
      bodyHtml: `
        <h2 style="color: #1f2937; margin: 0 0 16px 0; font-size: 20px;">${this.escapeHtml(title)}</h2>
        <p style="color: #4b5563; line-height: 1.6; margin: 0 0 24px 0;">${this.escapeHtml(message)}</p>
        ${sanitizeUrl(data?.actionUrl as string | undefined) ? `
          <a href="${sanitizeUrl(data?.actionUrl as string | undefined)}" style="display: inline-block; background-color: #4F46E5; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600;">View Details</a>
        ` : ''}
      `,
      plainText: message,
    });
    return html;
  }

  async notifyExpenseSubmitted(userId: string, expense: { id: string; merchant: string; amount: number; currency?: string }): Promise<void> {
    const cur = expense.currency || 'USD';
    const sym = this.getCurrencySymbol(cur);
    await this.send({
      userId,
      type: 'expense_submitted',
      title: 'Expense Submitted',
      message: `Your expense of ${sym}${expense.amount.toLocaleString()} at ${expense.merchant} has been submitted for approval.`,
      data: { expenseId: expense.id, actionUrl: '/expenses' },
      channels: ['in_app', 'push'],
    });
  }

  async notifyExpenseApproved(userId: string, expense: { id: string; merchant: string; amount: number; currency?: string }): Promise<void> {
    const cur = expense.currency || 'USD';
    const sym = this.getCurrencySymbol(cur);
    await this.send({
      userId,
      type: 'expense_approved',
      title: 'Expense Approved',
      message: `Your expense of ${sym}${expense.amount.toLocaleString()} at ${expense.merchant} has been approved.`,
      data: { expenseId: expense.id, actionUrl: '/expenses' },
      channels: ['in_app', 'email', 'push'],
    });
  }

  async notifyExpenseRejected(userId: string, expense: { id: string; merchant: string; amount: number; currency?: string; reason?: string }): Promise<void> {
    const cur = expense.currency || 'USD';
    const sym = this.getCurrencySymbol(cur);
    await this.send({
      userId,
      type: 'expense_rejected',
      title: 'Expense Rejected',
      message: `Your expense of ${sym}${expense.amount.toLocaleString()} at ${expense.merchant} was rejected. ${expense.reason ? `Reason: ${sanitizeSmsText(expense.reason)}` : ''}`,
      data: { expenseId: expense.id, actionUrl: '/expenses' },
      channels: ['in_app', 'email', 'push'],
    });
  }

  async notifyPaymentReceived(userId: string, payment: { amount: number; from: string; currency?: string }): Promise<void> {
    const cur = payment.currency || 'USD';
    const sym = this.getCurrencySymbol(cur);
    await this.send({
      userId,
      type: 'payment_received',
      title: 'Payment Received',
      message: `You received ${sym}${payment.amount.toLocaleString()} from ${payment.from}.`,
      data: { actionUrl: '/transactions' },
      channels: ['in_app', 'email', 'sms', 'push'],
    });
  }

  async notifyBillDue(userId: string, bill: { id: string; name: string; amount: number; dueDate: string; currency?: string }): Promise<void> {
    const cur = bill.currency || 'USD';
    const sym = this.getCurrencySymbol(cur);
    await this.send({
      userId,
      type: 'bill_due',
      title: 'Bill Due Soon',
      message: `Your ${bill.name} bill of ${sym}${bill.amount.toLocaleString()} is due on ${bill.dueDate}.`,
      data: { billId: bill.id, actionUrl: '/bills' },
      channels: ['in_app', 'email', 'push'],
    });
  }

  async notifyBudgetWarning(userId: string, budget: { category: string; spent: number; limit: number; percentage: number; currency?: string }): Promise<void> {
    const cur = budget.currency || 'USD';
    const sym = this.getCurrencySymbol(cur);
    await this.send({
      userId,
      type: 'budget_warning',
      title: 'Budget Warning',
      message: `You've used ${budget.percentage}% of your ${budget.category} budget (${sym}${budget.spent.toLocaleString()} of ${sym}${budget.limit.toLocaleString()}).`,
      data: { actionUrl: '/budget' },
      channels: ['in_app', 'push'],
    });
  }

  async notifyKycApproved(userId: string): Promise<void> {
    await this.send({
      userId,
      type: 'kyc_approved',
      title: 'Verification Approved',
      message: 'Your identity verification has been approved. You now have full access to all Financiar features.',
      data: { actionUrl: '/dashboard' },
      channels: ['in_app', 'email', 'push'],
    });
  }

  async notifyKycRejected(userId: string, reason?: string): Promise<void> {
    await this.send({
      userId,
      type: 'kyc_rejected',
      title: 'Verification Rejected',
      message: `Your identity verification was rejected. ${reason ? `Reason: ${reason}` : 'Please resubmit with valid documents.'}`,
      data: { actionUrl: '/onboarding' },
      channels: ['in_app', 'email', 'push'],
    });
  }

  async notifyCardTransaction(userId: string, transaction: { cardLast4: string; amount: number; merchant: string; currency?: string }): Promise<void> {
    const cur = transaction.currency || 'USD';
    const sym = this.getCurrencySymbol(cur);
    await this.send({
      userId,
      type: 'card_transaction',
      title: 'Card Transaction',
      message: `${sym}${transaction.amount.toLocaleString()} spent at ${transaction.merchant} using card ending in ${transaction.cardLast4}.`,
      data: { actionUrl: '/cards' },
      channels: ['in_app', 'push'],
    });
  }

  async sendTeamInvite(config: {
    email: string;
    name: string;
    role: string;
    department?: string;
    invitedBy?: string;
    companyName?: string;
    inviteToken?: string;
  }): Promise<{ success: boolean; error?: string }> {
    const appUrl = this.getAppUrl();
    const safeName = this.escapeHtml(config.name);
    const safeRole = this.escapeHtml(config.role);
    const safeDepartment = config.department ? this.escapeHtml(config.department) : '';
    const safeCompanyName = config.companyName ? this.escapeHtml(config.companyName) : 'your team';
    const inviteUrl = config.inviteToken 
      ? `${appUrl}/invite/${config.inviteToken}` 
      : `${appUrl}/login`;

    const bodyHtml = `
      <p style="font-size: 16px; color: #1f2937;">Hi <strong>${safeName}</strong>,</p>
      <p style="font-size: 16px; color: #4b5563;">You have been invited to join <strong>${safeCompanyName}</strong> on Financiar as a <strong>${safeRole}</strong>${safeDepartment ? ` in the ${safeDepartment} department` : ''}.</p>
      ${config.invitedBy ? `<p style="font-size: 14px; color: #6b7280;">Invited by: ${this.escapeHtml(config.invitedBy)}</p>` : ''}
      <p style="font-size: 16px; color: #4b5563;">With Financiar you can:</p>
      <ul style="font-size: 15px; color: #555;">
        <li>Submit and track expenses</li>
        <li>Manage budgets and approvals</li>
        <li>Access virtual cards for company spending</li>
        <li>View real-time financial insights</li>
      </ul>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${inviteUrl}" style="background: #6366f1; color: white; padding: 14px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Accept Invitation</a>
      </div>
      ${config.inviteToken ? `<p style="font-size: 13px; color: #999;">This invitation expires in 7 days. If the button above does not work, copy and paste this link in your browser: ${inviteUrl}</p>` : ''}
      <p style="font-size: 14px; color: #666;">If you have any questions, please contact your team administrator${config.invitedBy ? ` or reply to this email` : ''}.</p>
      <p style="font-size: 12px; color: #999;">If you did not expect this invitation, you can safely ignore this email.</p>
    `;

    const plainText = `Hi ${config.name},

You have been invited to join ${config.companyName || 'your team'} on Financiar as a ${config.role}${config.department ? ` in the ${config.department} department` : ''}.
${config.invitedBy ? `Invited by: ${config.invitedBy}` : ''}

Accept your invitation: ${inviteUrl}

${config.inviteToken ? 'This invitation expires in 7 days.' : ''}

If you have any questions, please contact your team administrator.

- The Financiar Team`;

    const { html, text } = this.buildEmailTemplate({
      preheader: `You have been invited to join ${config.companyName || 'Financiar'} as a ${config.role}`,
      headerTitle: 'Team Invitation',
      bodyHtml,
      plainText,
    });

    try {
      await this.sendEmail({
        to: config.email,
        subject: `You are invited to join ${config.companyName || 'Financiar'}`,
        html,
        text,
      });
      console.log('Team invite email sent successfully to:', config.email);
      return { success: true };
    } catch (error) {
      console.error('Failed to send team invite email:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async sendWelcomeEmail(config: { email: string; name: string }): Promise<{ success: boolean; error?: string }> {
    const appUrl = this.getAppUrl();
    const safeName = this.escapeHtml(config.name);

    const bodyHtml = `
      <p style="font-size: 18px; color: #1f2937;">Hi <strong>${safeName}</strong>,</p>
      <p style="color: #4b5563; line-height: 1.6; font-size: 16px;">Thank you for creating your account.</p>
      <p style="color: #4b5563; line-height: 1.6; font-size: 16px;">Here is what you can do with Financiar:</p>
      <ul style="color: #4b5563; line-height: 1.8; font-size: 15px;">
        <li>Track and manage expenses</li>
        <li>Set budgets and monitor spending</li>
        <li>Create and send professional invoices</li>
        <li>Manage vendor payments and payroll</li>
        <li>Get real-time financial insights</li>
      </ul>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${appUrl}/dashboard" style="display: inline-block; background-color: #4F46E5; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">Go to Dashboard</a>
      </div>
      <p style="color: #6b7280; font-size: 14px;">Need help getting started? Check out our onboarding guide or contact our support team.</p>
    `;

    const plainText = `Hi ${config.name},

Thank you for creating your account.

Here is what you can do with Financiar:
- Track and manage expenses
- Set budgets and monitor spending
- Create and send professional invoices
- Manage vendor payments and payroll
- Get real-time financial insights

Visit ${appUrl}/dashboard to get started.`;

    const { html, text } = this.buildEmailTemplate({
      preheader: 'Your Financiar account has been created successfully',
      headerTitle: 'Welcome to Financiar',
      bodyHtml,
      plainText,
    });

    try {
      await this.sendEmail({
        to: config.email,
        subject: 'Your Financiar account is ready',
        html,
        text,
      });
      console.log('Welcome email sent to:', config.email);
      return { success: true };
    } catch (error) {
      console.error('Failed to send welcome email:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async sendPasswordResetSuccess(config: { email: string; name: string }): Promise<{ success: boolean; error?: string }> {
    const safeName = this.escapeHtml(config.name);

    const bodyHtml = `
      <p style="font-size: 16px; color: #1f2937;">Hi <strong>${safeName}</strong>,</p>
      <p style="color: #4b5563; line-height: 1.6;">Your password has been successfully reset. You can now log in with your new password.</p>
      <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 24px 0; border-radius: 4px;">
        <p style="color: #92400e; margin: 0; font-size: 14px;"><strong>Security Notice:</strong> If you did not make this change, please contact our support team immediately.</p>
      </div>
      <p style="color: #6b7280; font-size: 14px;">For your security, we recommend using a strong, unique password.</p>
    `;

    const plainText = `Hi ${config.name},

Your password has been successfully reset. You can now log in with your new password.

Security Notice: If you did not make this change, please contact our support team immediately.

For your security, we recommend using a strong, unique password.`;

    const { html, text } = this.buildEmailTemplate({
      preheader: 'Your Financiar password has been changed',
      headerTitle: 'Password Reset Successful',
      bodyHtml,
      plainText,
    });

    try {
      await this.sendEmail({
        to: config.email,
        subject: 'Your Financiar Password Has Been Reset',
        html,
        text,
      });
      console.log('Password reset confirmation email sent to:', config.email);
      return { success: true };
    } catch (error) {
      console.error('Failed to send password reset confirmation:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async sendEmailVerification(config: { email: string; name: string; verificationLink: string }): Promise<{ success: boolean; error?: string }> {
    const safeName = this.escapeHtml(config.name);

    const bodyHtml = `
      <p style="font-size: 16px; color: #1f2937;">Hi <strong>${safeName}</strong>,</p>
      <p style="color: #4b5563; line-height: 1.6;">Please verify your email address to complete your Financiar account setup.</p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${config.verificationLink}" style="display: inline-block; background-color: #4F46E5; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">Verify Email Address</a>
      </div>
      <p style="color: #6b7280; font-size: 14px;">This link will expire in 24 hours. If you did not create a Financiar account, you can safely ignore this email.</p>
    `;

    const plainText = `Hi ${config.name},

Please verify your email by visiting: ${config.verificationLink}

This link expires in 24 hours. If you did not create a Financiar account, you can safely ignore this email.`;

    const { html, text } = this.buildEmailTemplate({
      preheader: 'Verify your email to complete account setup',
      headerTitle: 'Verify Your Email',
      bodyHtml,
      plainText,
    });

    try {
      await this.sendEmail({
        to: config.email,
        subject: 'Verify Your Financiar Email Address',
        html,
        text,
      });
      console.log('Email verification sent to:', config.email);
      return { success: true };
    } catch (error) {
      console.error('Failed to send email verification:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async notifyPayoutProcessed(userId: string, payout: { 
    amount: number; 
    currency: string; 
    recipientName: string; 
    bankName?: string;
    reference?: string;
  }): Promise<void> {
    await this.send({
      userId,
      type: 'payout_processed',
      title: 'Payout Sent',
      message: `${payout.currency} ${payout.amount.toLocaleString()} has been sent to ${payout.recipientName}${payout.bankName ? ` via ${payout.bankName}` : ''}.`,
      data: { 
        amount: payout.amount,
        currency: payout.currency,
        recipient: payout.recipientName,
        reference: payout.reference,
        actionUrl: '/transactions' 
      },
      channels: ['in_app', 'email', 'sms', 'push'],
    });
  }

  async sendPayoutConfirmationEmail(config: {
    email: string;
    name: string;
    amount: number;
    currency: string;
    recipientName: string;
    recipientBank?: string;
    recipientAccount?: string;
    reference: string;
    date: string;
  }): Promise<{ success: boolean; error?: string }> {
    const safeName = this.escapeHtml(config.name);
    const safeRecipientName = this.escapeHtml(config.recipientName);
    const safeRecipientBank = config.recipientBank ? this.escapeHtml(config.recipientBank) : '';
    const safeRecipientAccount = config.recipientAccount ? this.escapeHtml(config.recipientAccount) : '';
    const safeReference = this.escapeHtml(config.reference);
    const safeDate = this.escapeHtml(config.date);
    const safeCurrency = this.escapeHtml(config.currency);

    const bodyHtml = `
      <p style="font-size: 16px; color: #1f2937;">Hi <strong>${safeName}</strong>,</p>
      <p style="color: #4b5563; line-height: 1.6;">Your payout has been successfully processed. Here are the details:</p>
      <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin: 24px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Amount</td>
            <td style="padding: 8px 0; color: #1f2937; font-weight: 600; text-align: right; font-size: 18px;">${safeCurrency} ${config.amount.toLocaleString()}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Recipient</td>
            <td style="padding: 8px 0; color: #1f2937; text-align: right;">${safeRecipientName}</td>
          </tr>
          ${safeRecipientBank ? `
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Bank</td>
            <td style="padding: 8px 0; color: #1f2937; text-align: right;">${safeRecipientBank}</td>
          </tr>
          ` : ''}
          ${safeRecipientAccount ? `
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Account</td>
            <td style="padding: 8px 0; color: #1f2937; text-align: right;">****${safeRecipientAccount.slice(-4)}</td>
          </tr>
          ` : ''}
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Reference</td>
            <td style="padding: 8px 0; color: #1f2937; text-align: right; font-family: monospace;">${safeReference}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Date</td>
            <td style="padding: 8px 0; color: #1f2937; text-align: right;">${safeDate}</td>
          </tr>
        </table>
      </div>
      <p style="color: #6b7280; font-size: 14px;">The funds should arrive in the recipient's account within 1-3 business days depending on the bank.</p>
    `;

    const plainText = `Hi ${config.name},

Your payout has been successfully processed.

Amount: ${config.currency} ${config.amount.toLocaleString()}
Recipient: ${config.recipientName}${config.recipientBank ? `\nBank: ${config.recipientBank}` : ''}
Reference: ${config.reference}
Date: ${config.date}

The funds should arrive in the recipient's account within 1-3 business days depending on the bank.`;

    const { html, text } = this.buildEmailTemplate({
      preheader: `Payout of ${config.currency} ${config.amount.toLocaleString()} sent to ${config.recipientName}`,
      headerTitle: 'Payout Successful',
      headerColor: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
      bodyHtml,
      plainText,
    });

    try {
      await this.sendEmail({
        to: config.email,
        subject: `Payout Confirmation - ${config.currency} ${config.amount.toLocaleString()} sent`,
        html,
        text,
      });
      console.log('Payout confirmation email sent to:', config.email);
      return { success: true };
    } catch (error) {
      console.error('Failed to send payout confirmation:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async notifyInvoiceSent(userId: string, invoice: { 
    id: string;
    invoiceNumber: string;
    clientName: string; 
    amount: number;
    currency: string;
    dueDate: string;
  }): Promise<void> {
    await this.send({
      userId,
      type: 'invoice_sent',
      title: 'Invoice Sent',
      message: `Invoice ${invoice.invoiceNumber} for ${invoice.currency} ${invoice.amount.toLocaleString()} has been sent to ${invoice.clientName}.`,
      data: { 
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        actionUrl: '/invoices' 
      },
      channels: ['in_app', 'email', 'push'],
    });
  }

  async sendInvoiceEmail(config: {
    email: string;
    clientName: string;
    senderName: string;
    invoiceNumber: string;
    amount: number;
    currency: string;
    dueDate: string;
    items: Array<{ description: string; quantity: number; price: number }>;
    paymentLink?: string;
  }): Promise<{ success: boolean; error?: string }> {
    const safeClientName = this.escapeHtml(config.clientName);
    const safeSenderName = this.escapeHtml(config.senderName);
    const safeInvoiceNumber = this.escapeHtml(config.invoiceNumber);

    const itemsHtml = config.items.map(item => `
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #374151;">${this.escapeHtml(item.description)}</td>
        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #374151; text-align: center;">${item.quantity}</td>
        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #374151; text-align: right;">${config.currency} ${item.price.toLocaleString()}</td>
        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #374151; text-align: right;">${config.currency} ${(item.quantity * item.price).toLocaleString()}</td>
      </tr>
    `).join('');

    const bodyHtml = `
      <p style="font-size: 16px; color: #1f2937;">Dear <strong>${safeClientName}</strong>,</p>
      <p style="color: #4b5563; line-height: 1.6;">Please find your invoice from <strong>${safeSenderName}</strong>.</p>
      
      <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
        <thead>
          <tr style="background-color: #f9fafb;">
            <th style="padding: 12px 0; text-align: left; color: #6b7280; font-weight: 600; font-size: 14px;">Description</th>
            <th style="padding: 12px 0; text-align: center; color: #6b7280; font-weight: 600; font-size: 14px;">Qty</th>
            <th style="padding: 12px 0; text-align: right; color: #6b7280; font-weight: 600; font-size: 14px;">Price</th>
            <th style="padding: 12px 0; text-align: right; color: #6b7280; font-weight: 600; font-size: 14px;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="3" style="padding: 16px 0; text-align: right; font-weight: 600; color: #1f2937; font-size: 16px;">Total Due:</td>
            <td style="padding: 16px 0; text-align: right; font-weight: 700; color: #4F46E5; font-size: 18px;">${config.currency} ${config.amount.toLocaleString()}</td>
          </tr>
        </tfoot>
      </table>

      <div style="background-color: #fef3c7; border-radius: 8px; padding: 16px; margin: 24px 0;">
        <p style="color: #92400e; margin: 0; font-size: 14px;"><strong>Due Date:</strong> ${this.escapeHtml(config.dueDate)}</p>
      </div>

      ${config.paymentLink ? `
      <div style="text-align: center; margin: 32px 0;">
        <a href="${config.paymentLink}" style="display: inline-block; background-color: #4F46E5; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">Pay Now</a>
      </div>
      ` : ''}

      <p style="color: #6b7280; font-size: 14px;">If you have any questions about this invoice, please contact us.</p>
    `;

    const itemsText = config.items.map(item => `- ${item.description} x${item.quantity}: ${config.currency} ${(item.quantity * item.price).toLocaleString()}`).join('\n');

    const plainText = `Dear ${config.clientName},

Please find your invoice from ${config.senderName}.

Invoice: ${config.invoiceNumber}
${itemsText}

Total Due: ${config.currency} ${config.amount.toLocaleString()}
Due Date: ${config.dueDate}`;

    const { html, text } = this.buildEmailTemplate({
      preheader: `Invoice ${config.invoiceNumber} - ${config.currency} ${config.amount.toLocaleString()} due ${config.dueDate}`,
      headerTitle: `Invoice ${safeInvoiceNumber}`,
      bodyHtml,
      plainText,
    });

    try {
      await this.sendEmail({
        to: config.email,
        subject: `Invoice ${config.invoiceNumber} from ${config.senderName} - ${config.currency} ${config.amount.toLocaleString()}`,
        html,
        text,
      });
      console.log('Invoice email sent to:', config.email);
      return { success: true };
    } catch (error) {
      console.error('Failed to send invoice email:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async notifyPayrollProcessed(userId: string, payroll: { 
    totalAmount: number;
    currency: string;
    employeeCount: number;
    payPeriod: string;
  }): Promise<void> {
    await this.send({
      userId,
      type: 'payroll_processed',
      title: 'Payroll Processed',
      message: `Payroll of ${payroll.currency} ${payroll.totalAmount.toLocaleString()} for ${payroll.employeeCount} employees (${payroll.payPeriod}) has been processed.`,
      data: { actionUrl: '/payroll' },
      channels: ['in_app', 'email', 'push'],
    });
  }

  async sendPayslipEmail(config: {
    email: string;
    employeeName: string;
    payPeriod: string;
    grossSalary: number;
    deductions: number;
    netPay: number;
    currency: string;
    paymentDate: string;
    companyName: string;
  }): Promise<{ success: boolean; error?: string }> {
    const safeEmployeeName = this.escapeHtml(config.employeeName);
    const safeCompanyName = this.escapeHtml(config.companyName);
    const safePayPeriod = this.escapeHtml(config.payPeriod);

    const bodyHtml = `
      <p style="font-size: 16px; color: #1f2937;">Dear <strong>${safeEmployeeName}</strong>,</p>
      <p style="color: #4b5563; line-height: 1.6;">Your salary for ${safePayPeriod} has been processed by <strong>${safeCompanyName}</strong>.</p>
      
      <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin: 24px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 12px 0; color: #6b7280; font-size: 14px; border-bottom: 1px solid #e5e7eb;">Gross Salary</td>
            <td style="padding: 12px 0; color: #1f2937; text-align: right; font-size: 16px; border-bottom: 1px solid #e5e7eb;">${config.currency} ${config.grossSalary.toLocaleString()}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; color: #6b7280; font-size: 14px; border-bottom: 1px solid #e5e7eb;">Deductions</td>
            <td style="padding: 12px 0; color: #dc2626; text-align: right; font-size: 16px; border-bottom: 1px solid #e5e7eb;">- ${config.currency} ${config.deductions.toLocaleString()}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; color: #1f2937; font-weight: 600; font-size: 16px;">Net Pay</td>
            <td style="padding: 12px 0; color: #10B981; font-weight: 700; text-align: right; font-size: 20px;">${config.currency} ${config.netPay.toLocaleString()}</td>
          </tr>
        </table>
      </div>

      <p style="color: #6b7280; font-size: 14px;"><strong>Payment Date:</strong> ${this.escapeHtml(config.paymentDate)}</p>
      <p style="color: #6b7280; font-size: 14px;">The funds have been transferred to your registered bank account.</p>
    `;

    const plainText = `Dear ${config.employeeName},

Your salary for ${config.payPeriod} has been processed by ${config.companyName}.

Gross Salary: ${config.currency} ${config.grossSalary.toLocaleString()}
Deductions: - ${config.currency} ${config.deductions.toLocaleString()}
Net Pay: ${config.currency} ${config.netPay.toLocaleString()}

Payment Date: ${config.paymentDate}
The funds have been transferred to your registered bank account.`;

    const { html, text } = this.buildEmailTemplate({
      preheader: `Your payslip for ${config.payPeriod} - Net pay: ${config.currency} ${config.netPay.toLocaleString()}`,
      headerTitle: `Payslip - ${safePayPeriod}`,
      bodyHtml,
      plainText,
    });

    try {
      await this.sendEmail({
        to: config.email,
        subject: `Your Payslip - ${config.payPeriod}`,
        html,
        text,
      });
      console.log('Payslip email sent to:', config.email);
      return { success: true };
    } catch (error) {
      console.error('Failed to send payslip email:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async sendLoginAlertEmail(config: {
    email: string;
    name: string;
    loginTime: string;
    ipAddress?: string;
    device?: string;
    location?: string;
  }): Promise<{ success: boolean; error?: string }> {
    const safeName = this.escapeHtml(config.name);

    const bodyHtml = `
      <p style="font-size: 16px; color: #1f2937;">Hi <strong>${safeName}</strong>,</p>
      <p style="color: #4b5563; line-height: 1.6;">We detected a new login to your Financiar account.</p>
      <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin: 24px 0;">
        <p style="margin: 8px 0; color: #374151;"><strong>Time:</strong> ${this.escapeHtml(config.loginTime)}</p>
        ${config.device ? `<p style="margin: 8px 0; color: #374151;"><strong>Device:</strong> ${this.escapeHtml(config.device)}</p>` : ''}
        ${config.ipAddress ? `<p style="margin: 8px 0; color: #374151;"><strong>IP Address:</strong> ${this.escapeHtml(config.ipAddress)}</p>` : ''}
        ${config.location ? `<p style="margin: 8px 0; color: #374151;"><strong>Location:</strong> ${this.escapeHtml(config.location)}</p>` : ''}
      </div>
      <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 24px 0; border-radius: 4px;">
        <p style="color: #92400e; margin: 0; font-size: 14px;"><strong>Not you?</strong> If you did not log in, please change your password immediately and contact support.</p>
      </div>
    `;

    const plainText = `Hi ${config.name},

We detected a new login to your Financiar account.

Time: ${config.loginTime}${config.device ? `\nDevice: ${config.device}` : ''}${config.ipAddress ? `\nIP Address: ${config.ipAddress}` : ''}${config.location ? `\nLocation: ${config.location}` : ''}

If you did not log in, please change your password immediately and contact support.`;

    const { html, text } = this.buildEmailTemplate({
      preheader: `New login detected on your Financiar account at ${config.loginTime}`,
      headerTitle: 'New Login Detected',
      bodyHtml,
      plainText,
    });

    try {
      await this.sendEmail({
        to: config.email,
        subject: 'New Login to Your Financiar Account',
        html,
        text,
      });
      console.log('Login alert email sent to:', config.email);
      return { success: true };
    } catch (error) {
      console.error('Failed to send login alert email:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async sendTransactionAlertSms(config: {
    phone: string;
    type: 'credit' | 'debit';
    amount: number;
    currency: string;
    description: string;
    balance?: number;
  }): Promise<{ success: boolean; error?: string }> {
    const typeLabel = config.type === 'credit' ? 'Credited' : 'Debited';
    const sign = config.type === 'credit' ? '+' : '-';
    const balanceText = config.balance !== undefined ? ` Bal: ${config.currency}${config.balance.toLocaleString()}` : '';
    
    const message = `Financiar: ${typeLabel} ${sign}${config.currency}${config.amount.toLocaleString()} - ${config.description}.${balanceText}`;

    try {
      await this.sendSms({
        to: config.phone,
        body: message,
      });
      console.log('Transaction SMS alert sent to:', config.phone);
      return { success: true };
    } catch (error) {
      console.error('Failed to send transaction SMS:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async sendBillPaymentEmail(config: {
    email: string;
    name: string;
    billName: string;
    amount: number;
    currency: string;
    provider: string;
    paymentDate: string;
    reference: string;
  }): Promise<{ success: boolean; error?: string }> {
    const safeName = this.escapeHtml(config.name);
    const safeBillName = this.escapeHtml(config.billName);
    const safeProvider = this.escapeHtml(config.provider);
    const safeReference = this.escapeHtml(config.reference);
    const safeDate = this.escapeHtml(config.paymentDate);

    const bodyHtml = `
      <p style="font-size: 16px; color: #1f2937;">Hi <strong>${safeName}</strong>,</p>
      <p style="color: #4b5563; line-height: 1.6;">Your bill payment has been processed successfully.</p>
      <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin: 24px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Bill</td>
            <td style="padding: 8px 0; color: #1f2937; text-align: right;">${safeBillName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Amount</td>
            <td style="padding: 8px 0; color: #1f2937; font-weight: 600; text-align: right; font-size: 18px;">${config.currency} ${config.amount.toLocaleString()}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Provider</td>
            <td style="padding: 8px 0; color: #1f2937; text-align: right;">${safeProvider}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Payment Date</td>
            <td style="padding: 8px 0; color: #1f2937; text-align: right;">${safeDate}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Reference</td>
            <td style="padding: 8px 0; color: #1f2937; text-align: right; font-family: monospace;">${safeReference}</td>
          </tr>
        </table>
      </div>
    `;

    const plainText = `Hi ${config.name},

Your bill payment has been processed successfully.

Bill: ${config.billName}
Amount: ${config.currency} ${config.amount.toLocaleString()}
Provider: ${config.provider}
Payment Date: ${config.paymentDate}
Reference: ${config.reference}`;

    const { html, text } = this.buildEmailTemplate({
      preheader: `Bill payment of ${config.currency} ${config.amount.toLocaleString()} for ${config.billName} confirmed`,
      headerTitle: 'Bill Payment Confirmation',
      headerColor: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
      bodyHtml,
      plainText,
    });

    try {
      await this.sendEmail({
        to: config.email,
        subject: `Bill Payment Confirmation - ${config.billName}`,
        html,
        text,
      });
      console.log('Bill payment email sent to:', config.email);
      return { success: true };
    } catch (error) {
      console.error('Failed to send bill payment email:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async sendExpenseApprovalRequestEmail(config: {
    email: string;
    approverName: string;
    submitterName: string;
    expenseDescription: string;
    amount: number;
    currency: string;
    expenseDate: string;
  }): Promise<{ success: boolean; error?: string }> {
    const appUrl = this.getAppUrl();
    const safeApproverName = this.escapeHtml(config.approverName);
    const safeSubmitterName = this.escapeHtml(config.submitterName);
    const safeDescription = this.escapeHtml(config.expenseDescription);
    const safeDate = this.escapeHtml(config.expenseDate);

    const bodyHtml = `
      <p style="font-size: 16px; color: #1f2937;">Hi <strong>${safeApproverName}</strong>,</p>
      <p style="color: #4b5563; line-height: 1.6;">An expense has been submitted and requires your approval.</p>
      <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin: 24px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Submitted By</td>
            <td style="padding: 8px 0; color: #1f2937; text-align: right;">${safeSubmitterName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Description</td>
            <td style="padding: 8px 0; color: #1f2937; text-align: right;">${safeDescription}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Amount</td>
            <td style="padding: 8px 0; color: #1f2937; font-weight: 600; text-align: right; font-size: 18px;">${config.currency} ${config.amount.toLocaleString()}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Date</td>
            <td style="padding: 8px 0; color: #1f2937; text-align: right;">${safeDate}</td>
          </tr>
        </table>
      </div>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${appUrl}/expenses" style="display: inline-block; background-color: #4F46E5; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">Review Expense</a>
      </div>
    `;

    const plainText = `Hi ${config.approverName},

An expense has been submitted and requires your approval.

Submitted By: ${config.submitterName}
Description: ${config.expenseDescription}
Amount: ${config.currency} ${config.amount.toLocaleString()}
Date: ${config.expenseDate}

Review the expense at: ${appUrl}/expenses`;

    const { html, text } = this.buildEmailTemplate({
      preheader: `Expense approval needed: ${config.currency} ${config.amount.toLocaleString()} from ${config.submitterName}`,
      headerTitle: 'Expense Approval Request',
      bodyHtml,
      plainText,
    });

    try {
      await this.sendEmail({
        to: config.email,
        subject: `Expense Approval Required - ${config.currency} ${config.amount.toLocaleString()} from ${config.submitterName}`,
        html,
        text,
      });
      console.log('Expense approval request email sent to:', config.email);
      return { success: true };
    } catch (error) {
      console.error('Failed to send expense approval request email:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async sendPaymentReceiptEmail(config: {
    email: string;
    name: string;
    amount: number;
    currency: string;
    from: string;
    reference: string;
    date: string;
  }): Promise<{ success: boolean; error?: string }> {
    const safeName = this.escapeHtml(config.name);
    const safeFrom = this.escapeHtml(config.from);
    const safeReference = this.escapeHtml(config.reference);
    const safeDate = this.escapeHtml(config.date);

    const bodyHtml = `
      <p style="font-size: 16px; color: #1f2937;">Hi <strong>${safeName}</strong>,</p>
      <p style="color: #4b5563; line-height: 1.6;">A payment has been received to your account.</p>
      <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin: 24px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Amount</td>
            <td style="padding: 8px 0; color: #10B981; font-weight: 600; text-align: right; font-size: 18px;">${config.currency} ${config.amount.toLocaleString()}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">From</td>
            <td style="padding: 8px 0; color: #1f2937; text-align: right;">${safeFrom}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Reference</td>
            <td style="padding: 8px 0; color: #1f2937; text-align: right; font-family: monospace;">${safeReference}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Date</td>
            <td style="padding: 8px 0; color: #1f2937; text-align: right;">${safeDate}</td>
          </tr>
        </table>
      </div>
    `;

    const plainText = `Hi ${config.name},

A payment has been received to your account.

Amount: ${config.currency} ${config.amount.toLocaleString()}
From: ${config.from}
Reference: ${config.reference}
Date: ${config.date}`;

    const { html, text } = this.buildEmailTemplate({
      preheader: `Payment of ${config.currency} ${config.amount.toLocaleString()} received from ${config.from}`,
      headerTitle: 'Payment Received',
      headerColor: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
      bodyHtml,
      plainText,
    });

    try {
      await this.sendEmail({
        to: config.email,
        subject: `Payment Receipt - ${config.currency} ${config.amount.toLocaleString()} from ${config.from}`,
        html,
        text,
      });
      console.log('Payment receipt email sent to:', config.email);
      return { success: true };
    } catch (error) {
      console.error('Failed to send payment receipt email:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
  async notifyExpenseReviewRequested(reviewerUserId: string, expense: {
    id: string;
    merchant: string;
    amount: number;
    currency?: string;
    submitterName: string;
    note?: string;
  }): Promise<void> {
    const cur = expense.currency || 'USD';
    const sym = this.getCurrencySymbol(cur);
    await this.send({
      userId: reviewerUserId,
      type: 'expense_review_request',
      title: 'Expense Review Requested',
      message: `${expense.submitterName} has requested your review on an expense of ${sym}${expense.amount.toLocaleString()} at ${expense.merchant}.${expense.note ? ` Note: ${expense.note}` : ''}`,
      data: { expenseId: expense.id, actionUrl: '/expenses' },
      channels: ['in_app', 'email', 'push'],
    });
  }

  async notifyExpenseSubmittedForApproval(approverUserIds: string[], expense: {
    id: string;
    merchant: string;
    amount: number;
    currency?: string;
    submitterName: string;
    category?: string;
  }): Promise<void> {
    const cur = expense.currency || 'USD';
    const sym = this.getCurrencySymbol(cur);
    for (const approverId of approverUserIds) {
      await this.send({
        userId: approverId,
        type: 'expense_pending_approval',
        title: 'Expense Pending Your Approval',
        message: `${expense.submitterName} submitted an expense of ${sym}${expense.amount.toLocaleString()} at ${expense.merchant}${expense.category ? ` (${expense.category})` : ''} for your approval.`,
        data: { expenseId: expense.id, actionUrl: '/expenses' },
        channels: ['in_app', 'email', 'push'],
      });
    }
  }

  async notifyWalletDeposit(userId: string, deposit: {
    amount: number;
    currency: string;
    method: string;
    reference?: string;
  }): Promise<void> {
    const sym = this.getCurrencySymbol(deposit.currency);
    await this.send({
      userId,
      type: 'payment_received',
      title: 'Wallet Funded Successfully',
      message: `${sym}${deposit.amount.toLocaleString()} has been added to your ${deposit.currency} wallet via ${deposit.method}.${deposit.reference ? ` Ref: ${deposit.reference}` : ''}`,
      data: { actionUrl: '/dashboard' },
      channels: ['in_app', 'email', 'push'],
    });
  }

  async notifyTransferSent(userId: string, transfer: {
    amount: number;
    currency: string;
    recipientName: string;
    reference?: string;
  }): Promise<void> {
    const sym = this.getCurrencySymbol(transfer.currency);
    await this.send({
      userId,
      type: 'payment_sent',
      title: 'Transfer Sent',
      message: `${sym}${transfer.amount.toLocaleString()} has been sent to ${transfer.recipientName}.${transfer.reference ? ` Ref: ${transfer.reference}` : ''}`,
      data: { actionUrl: '/transactions' },
      channels: ['in_app', 'email', 'push'],
    });
  }

  async notifyBillPaid(userId: string, bill: {
    name: string;
    amount: number;
    currency: string;
    provider: string;
  }): Promise<void> {
    const sym = this.getCurrencySymbol(bill.currency);
    await this.send({
      userId,
      type: 'bill_paid',
      title: 'Bill Payment Successful',
      message: `Your ${bill.name} bill of ${sym}${bill.amount.toLocaleString()} to ${bill.provider} has been paid successfully.`,
      data: { actionUrl: '/bills' },
      channels: ['in_app', 'email', 'push'],
    });
  }
  // ==================== EXPENSE LIFECYCLE EMAILS ====================

  async sendExpenseApprovedEmail(config: {
    email: string;
    name: string;
    expenseDescription: string;
    amount: number;
    currency: string;
    approverName: string;
  }): Promise<{ success: boolean; error?: string }> {
    const appUrl = this.getAppUrl();
    const safeName = this.escapeHtml(config.name);
    const safeDesc = this.escapeHtml(config.expenseDescription);
    const safeApprover = this.escapeHtml(config.approverName);

    const bodyHtml = `
      <p style="font-size: 16px; color: #1f2937;">Hi <strong>${safeName}</strong>,</p>
      <p style="color: #4b5563; line-height: 1.6;">Your expense has been approved!</p>
      <div style="background-color: #f0fdf4; border-radius: 8px; padding: 20px; margin: 24px 0; border-left: 4px solid #22c55e;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Description</td>
            <td style="padding: 8px 0; color: #1f2937; text-align: right;">${safeDesc}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Amount</td>
            <td style="padding: 8px 0; color: #1f2937; font-weight: 600; text-align: right; font-size: 18px;">${config.currency} ${config.amount.toLocaleString()}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Approved By</td>
            <td style="padding: 8px 0; color: #1f2937; text-align: right;">${safeApprover}</td>
          </tr>
        </table>
      </div>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${appUrl}/expenses" style="display: inline-block; background-color: #22c55e; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">View Expenses</a>
      </div>
    `;

    const plainText = `Hi ${config.name}, your expense "${config.expenseDescription}" for ${config.currency} ${config.amount.toLocaleString()} has been approved by ${config.approverName}.`;

    const { html, text } = this.buildEmailTemplate({
      preheader: `Expense approved: ${config.currency} ${config.amount.toLocaleString()}`,
      headerTitle: 'Expense Approved',
      bodyHtml,
      plainText,
      headerColor: '#22c55e',
    });

    try {
      await this.sendEmail({ to: config.email, subject: `Expense Approved - ${config.currency} ${config.amount.toLocaleString()}`, html, text });
      return { success: true };
    } catch (error) {
      console.error('Failed to send expense approved email:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async sendExpenseRejectedEmail(config: {
    email: string;
    name: string;
    expenseDescription: string;
    amount: number;
    currency: string;
    rejectedBy: string;
    reason?: string;
  }): Promise<{ success: boolean; error?: string }> {
    const appUrl = this.getAppUrl();
    const safeName = this.escapeHtml(config.name);
    const safeDesc = this.escapeHtml(config.expenseDescription);
    const safeRejector = this.escapeHtml(config.rejectedBy);
    const safeReason = config.reason ? this.escapeHtml(config.reason) : 'No reason provided';

    const bodyHtml = `
      <p style="font-size: 16px; color: #1f2937;">Hi <strong>${safeName}</strong>,</p>
      <p style="color: #4b5563; line-height: 1.6;">Unfortunately, your expense has been rejected.</p>
      <div style="background-color: #fef2f2; border-radius: 8px; padding: 20px; margin: 24px 0; border-left: 4px solid #ef4444;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Description</td>
            <td style="padding: 8px 0; color: #1f2937; text-align: right;">${safeDesc}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Amount</td>
            <td style="padding: 8px 0; color: #1f2937; font-weight: 600; text-align: right; font-size: 18px;">${config.currency} ${config.amount.toLocaleString()}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Rejected By</td>
            <td style="padding: 8px 0; color: #1f2937; text-align: right;">${safeRejector}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Reason</td>
            <td style="padding: 8px 0; color: #1f2937; text-align: right;">${safeReason}</td>
          </tr>
        </table>
      </div>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${appUrl}/expenses" style="display: inline-block; background-color: #4F46E5; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">Edit &amp; Resubmit</a>
      </div>
    `;

    const plainText = `Hi ${config.name}, your expense "${config.expenseDescription}" for ${config.currency} ${config.amount.toLocaleString()} was rejected by ${config.rejectedBy}. Reason: ${config.reason || 'No reason provided'}.`;

    const { html, text } = this.buildEmailTemplate({
      preheader: `Expense rejected: ${config.currency} ${config.amount.toLocaleString()}`,
      headerTitle: 'Expense Rejected',
      bodyHtml,
      plainText,
      headerColor: '#ef4444',
    });

    try {
      await this.sendEmail({ to: config.email, subject: `Expense Rejected - ${config.currency} ${config.amount.toLocaleString()}`, html, text });
      return { success: true };
    } catch (error) {
      console.error('Failed to send expense rejected email:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // ==================== PAYOUT LIFECYCLE EMAILS ====================

  async sendPayoutCompletedEmail(config: {
    email: string;
    name: string;
    amount: number;
    currency: string;
    recipientName: string;
    reference: string;
  }): Promise<{ success: boolean; error?: string }> {
    const safeName = this.escapeHtml(config.name);
    const safeRecipient = this.escapeHtml(config.recipientName);
    const safeRef = this.escapeHtml(config.reference);

    const bodyHtml = `
      <p style="font-size: 16px; color: #1f2937;">Hi <strong>${safeName}</strong>,</p>
      <p style="color: #4b5563; line-height: 1.6;">Your payout has been completed and the funds have been settled.</p>
      <div style="background-color: #f0fdf4; border-radius: 8px; padding: 20px; margin: 24px 0; border-left: 4px solid #22c55e;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Amount</td>
            <td style="padding: 8px 0; color: #1f2937; font-weight: 600; text-align: right; font-size: 18px;">${config.currency} ${config.amount.toLocaleString()}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Recipient</td>
            <td style="padding: 8px 0; color: #1f2937; text-align: right;">${safeRecipient}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Reference</td>
            <td style="padding: 8px 0; color: #1f2937; text-align: right; font-family: monospace;">${safeRef}</td>
          </tr>
        </table>
      </div>
    `;

    const plainText = `Hi ${config.name}, your payout of ${config.currency} ${config.amount.toLocaleString()} to ${config.recipientName} has been completed. Ref: ${config.reference}`;

    const { html, text } = this.buildEmailTemplate({
      preheader: `Payout completed: ${config.currency} ${config.amount.toLocaleString()}`,
      headerTitle: 'Payout Completed',
      bodyHtml,
      plainText,
      headerColor: '#22c55e',
    });

    try {
      await this.sendEmail({ to: config.email, subject: `Payout Completed - ${config.currency} ${config.amount.toLocaleString()}`, html, text });
      return { success: true };
    } catch (error) {
      console.error('Failed to send payout completed email:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async sendPayoutFailedEmail(config: {
    email: string;
    name: string;
    amount: number;
    currency: string;
    recipientName: string;
    reason?: string;
  }): Promise<{ success: boolean; error?: string }> {
    const appUrl = this.getAppUrl();
    const safeName = this.escapeHtml(config.name);
    const safeRecipient = this.escapeHtml(config.recipientName);
    const safeReason = config.reason ? this.escapeHtml(config.reason) : 'Please contact support for details';

    const bodyHtml = `
      <p style="font-size: 16px; color: #1f2937;">Hi <strong>${safeName}</strong>,</p>
      <p style="color: #4b5563; line-height: 1.6;">Your payout could not be completed.</p>
      <div style="background-color: #fef2f2; border-radius: 8px; padding: 20px; margin: 24px 0; border-left: 4px solid #ef4444;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Amount</td>
            <td style="padding: 8px 0; color: #1f2937; font-weight: 600; text-align: right; font-size: 18px;">${config.currency} ${config.amount.toLocaleString()}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Recipient</td>
            <td style="padding: 8px 0; color: #1f2937; text-align: right;">${safeRecipient}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Reason</td>
            <td style="padding: 8px 0; color: #ef4444; text-align: right;">${safeReason}</td>
          </tr>
        </table>
      </div>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${appUrl}/transactions" style="display: inline-block; background-color: #4F46E5; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">View Transactions</a>
      </div>
    `;

    const plainText = `Hi ${config.name}, your payout of ${config.currency} ${config.amount.toLocaleString()} to ${config.recipientName} failed. Reason: ${config.reason || 'Contact support'}`;

    const { html, text } = this.buildEmailTemplate({
      preheader: `Payout failed: ${config.currency} ${config.amount.toLocaleString()}`,
      headerTitle: 'Payout Failed',
      bodyHtml,
      plainText,
      headerColor: '#ef4444',
    });

    try {
      await this.sendEmail({ to: config.email, subject: `Payout Failed - ${config.currency} ${config.amount.toLocaleString()}`, html, text });
      return { success: true };
    } catch (error) {
      console.error('Failed to send payout failed email:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // ==================== TEAM LIFECYCLE EMAILS ====================

  async sendInviteAcceptedEmail(config: {
    email: string;
    adminName: string;
    memberName: string;
    memberEmail: string;
    role: string;
    companyName: string;
  }): Promise<{ success: boolean; error?: string }> {
    const appUrl = this.getAppUrl();
    const safeAdmin = this.escapeHtml(config.adminName);
    const safeMember = this.escapeHtml(config.memberName);
    const safeMemberEmail = this.escapeHtml(config.memberEmail);
    const safeRole = this.escapeHtml(config.role);
    const safeCompany = this.escapeHtml(config.companyName);

    const bodyHtml = `
      <p style="font-size: 16px; color: #1f2937;">Hi <strong>${safeAdmin}</strong>,</p>
      <p style="color: #4b5563; line-height: 1.6;"><strong>${safeMember}</strong> (${safeMemberEmail}) has accepted their invitation and joined <strong>${safeCompany}</strong> as a <strong>${safeRole}</strong>.</p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${appUrl}/team" style="display: inline-block; background-color: #4F46E5; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">View Team</a>
      </div>
    `;

    const plainText = `Hi ${config.adminName}, ${config.memberName} (${config.memberEmail}) has joined ${config.companyName} as ${config.role}.`;

    const { html, text } = this.buildEmailTemplate({
      preheader: `${config.memberName} joined ${config.companyName}`,
      headerTitle: 'New Team Member',
      bodyHtml,
      plainText,
    });

    try {
      await this.sendEmail({ to: config.email, subject: `${config.memberName} joined ${config.companyName}`, html, text });
      return { success: true };
    } catch (error) {
      console.error('Failed to send invite accepted email:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async sendRoleChangedEmail(config: {
    email: string;
    name: string;
    oldRole: string;
    newRole: string;
    companyName: string;
  }): Promise<{ success: boolean; error?: string }> {
    const safeName = this.escapeHtml(config.name);
    const safeOld = this.escapeHtml(config.oldRole);
    const safeNew = this.escapeHtml(config.newRole);
    const safeCompany = this.escapeHtml(config.companyName);

    const bodyHtml = `
      <p style="font-size: 16px; color: #1f2937;">Hi <strong>${safeName}</strong>,</p>
      <p style="color: #4b5563; line-height: 1.6;">Your role in <strong>${safeCompany}</strong> has been updated.</p>
      <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin: 24px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Previous Role</td>
            <td style="padding: 8px 0; color: #9ca3af; text-align: right;">${safeOld}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">New Role</td>
            <td style="padding: 8px 0; color: #4F46E5; font-weight: 600; text-align: right;">${safeNew}</td>
          </tr>
        </table>
      </div>
    `;

    const plainText = `Hi ${config.name}, your role in ${config.companyName} has changed from ${config.oldRole} to ${config.newRole}.`;

    const { html, text } = this.buildEmailTemplate({
      preheader: `Role updated: ${config.oldRole} → ${config.newRole}`,
      headerTitle: 'Role Updated',
      bodyHtml,
      plainText,
    });

    try {
      await this.sendEmail({ to: config.email, subject: `Your role in ${config.companyName} has been updated`, html, text });
      return { success: true };
    } catch (error) {
      console.error('Failed to send role changed email:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // ==================== PAYOUT LIFECYCLE NOTIFICATIONS ====================

  async notifyPayoutApproved(userId: string, payout: {
    amount: number;
    currency: string;
    recipientName: string;
    approverName?: string;
  }): Promise<void> {
    const sym = this.getCurrencySymbol(payout.currency);
    await this.send({
      userId,
      type: 'payment_sent',
      title: 'Payout Approved',
      message: `Your payout of ${sym}${payout.amount.toLocaleString()} to ${payout.recipientName} has been approved${payout.approverName ? ` by ${payout.approverName}` : ''} and is now being processed.`,
      data: { actionUrl: '/transactions' },
      channels: ['in_app', 'email', 'push'],
    });
  }

  async notifyPayoutCompleted(userId: string, payout: {
    amount: number;
    currency: string;
    recipientName: string;
    reference?: string;
  }): Promise<void> {
    const sym = this.getCurrencySymbol(payout.currency);
    await this.send({
      userId,
      type: 'payment_sent',
      title: 'Payout Completed',
      message: `${sym}${payout.amount.toLocaleString()} has been successfully settled to ${payout.recipientName}.${payout.reference ? ` Ref: ${payout.reference}` : ''}`,
      data: { actionUrl: '/transactions' },
      channels: ['in_app', 'email', 'push'],
    });
  }

  async notifyPayoutFailed(userId: string, payout: {
    amount: number;
    currency: string;
    recipientName: string;
    reason?: string;
  }): Promise<void> {
    const sym = this.getCurrencySymbol(payout.currency);
    await this.send({
      userId,
      type: 'payment_sent',
      title: 'Payout Failed',
      message: `Your payout of ${sym}${payout.amount.toLocaleString()} to ${payout.recipientName} has failed.${payout.reason ? ` Reason: ${payout.reason}` : ' Please contact support.'}`,
      data: { actionUrl: '/transactions' },
      channels: ['in_app', 'email', 'push'],
    });
  }

  // ==================== TEAM LIFECYCLE NOTIFICATIONS ====================

  async notifyInviteAccepted(adminUserId: string, memberName: string, companyName: string): Promise<void> {
    await this.send({
      userId: adminUserId,
      type: 'team_invite',
      title: 'Invitation Accepted',
      message: `${memberName} has accepted the invitation and joined ${companyName}.`,
      data: { actionUrl: '/team' },
      channels: ['in_app', 'email', 'push'],
    });
  }

  async notifyRoleChanged(userId: string, oldRole: string, newRole: string, companyName: string): Promise<void> {
    await this.send({
      userId,
      type: 'system_alert',
      title: 'Role Updated',
      message: `Your role in ${companyName} has been changed from ${oldRole} to ${newRole}.`,
      data: { actionUrl: '/settings' },
      channels: ['in_app', 'email', 'push'],
    });
  }
}

export const notificationService = new NotificationService();
