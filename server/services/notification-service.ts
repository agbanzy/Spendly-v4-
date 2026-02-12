import { storage } from '../storage';
import type { InsertNotification, NotificationSettings } from '@shared/schema';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

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
  text?: string;
}

interface SmsConfig {
  to: string;
  body: string;
}

type EmailProvider = 'aws' | 'sendgrid' | 'none';
type SmsProvider = 'aws' | 'twilio' | 'none';

class NotificationService {
  private twilioClient: any = null;
  private sendgridClient: any = null;
  private sesClient: SESClient | null = null;
  private snsClient: SNSClient | null = null;
  private emailProvider: EmailProvider = 'none';
  private smsProvider: SmsProvider = 'none';

  constructor() {
    this.initializeClients();
  }

  private initializeClients() {
    // Initialize AWS SES for email (preferred)
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_REGION) {
      try {
        this.sesClient = new SESClient({
          region: process.env.AWS_REGION,
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          },
        });
        this.emailProvider = 'aws';
        console.log('AWS SES client initialized');
      } catch (error) {
        console.log('AWS SES client initialization failed:', error);
      }
    }

    // Initialize AWS SNS for SMS (preferred)
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_REGION) {
      try {
        this.snsClient = new SNSClient({
          region: process.env.AWS_REGION,
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          },
        });
        this.smsProvider = 'aws';
        console.log('AWS SNS client initialized');
      } catch (error) {
        console.log('AWS SNS client initialization failed:', error);
      }
    }

    // Fallback to SendGrid for email
    if (this.emailProvider === 'none' && process.env.SENDGRID_API_KEY) {
      try {
        const sgMail = require('@sendgrid/mail');
        sgMail.setApiKey(process.env.SENDGRID_API_KEY);
        this.sendgridClient = sgMail;
        this.emailProvider = 'sendgrid';
        console.log('SendGrid client initialized (fallback)');
      } catch (error) {
        console.log('SendGrid client not available');
      }
    }

    // Fallback to Twilio for SMS
    if (this.smsProvider === 'none' && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      try {
        const twilio = require('twilio');
        this.twilioClient = twilio(
          process.env.TWILIO_ACCOUNT_SID,
          process.env.TWILIO_AUTH_TOKEN
        );
        this.smsProvider = 'twilio';
        console.log('Twilio client initialized (fallback)');
      } catch (error) {
        console.log('Twilio client not available');
      }
    }

    console.log(`Notification providers - Email: ${this.emailProvider}, SMS: ${this.smsProvider}`);
  }

  async send(options: SendNotificationOptions): Promise<void> {
    const { userId, type, title, message, data, channels = ['in_app'] } = options;

    const settings = await storage.getNotificationSettings(userId);
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

    if (enabledChannels.includes('email') && settings?.email) {
      promises.push(this.sendEmail({
        to: settings.email,
        subject: title,
        html: this.formatEmailHtml(title, message, data),
        text: message,
      }).then(() => {
        storage.updateNotification(created.id, { emailSent: true });
      }).catch(console.error));
    }

    if (enabledChannels.includes('sms') && settings?.phone) {
      promises.push(this.sendSms({
        to: settings.phone,
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

  async sendEmail(config: EmailConfig): Promise<void> {
    const fromEmail = process.env.AWS_SES_FROM_EMAIL || process.env.SENDGRID_FROM_EMAIL || 'noreply@spendly.app';
    const fromName = process.env.AWS_SES_FROM_NAME || 'Spendly';
    const formattedFrom = `${fromName} <${fromEmail}>`;

    // Use AWS SES if available
    if (this.emailProvider === 'aws' && this.sesClient) {
      try {
        const command = new SendEmailCommand({
          Source: formattedFrom,
          Destination: {
            ToAddresses: [config.to],
          },
          Message: {
            Subject: {
              Data: config.subject,
              Charset: 'UTF-8',
            },
            Body: {
              Html: {
                Data: config.html,
                Charset: 'UTF-8',
              },
              Text: {
                Data: config.text || config.html.replace(/<[^>]*>/g, ''),
                Charset: 'UTF-8',
              },
            },
          },
        });

        await this.sesClient.send(command);
        console.log('Email sent via AWS SES to:', config.to);
        return;
      } catch (error) {
        console.error('Failed to send email via AWS SES:', error);
        throw error;
      }
    }

    // Fallback to SendGrid
    if (this.emailProvider === 'sendgrid' && this.sendgridClient) {
      try {
        await this.sendgridClient.send({
          to: config.to,
          from: fromEmail,
          subject: config.subject,
          text: config.text || config.html.replace(/<[^>]*>/g, ''),
          html: config.html,
        });
        console.log('Email sent via SendGrid to:', config.to);
        return;
      } catch (error) {
        console.error('Failed to send email via SendGrid:', error);
        throw error;
      }
    }

    console.log('No email provider configured, skipping email:', config.subject);
  }

  async sendSms(config: SmsConfig): Promise<void> {
    // Use AWS SNS if available
    if (this.smsProvider === 'aws' && this.snsClient) {
      try {
        const command = new PublishCommand({
          PhoneNumber: config.to,
          Message: config.body,
          MessageAttributes: {
            'AWS.SNS.SMS.SenderID': {
              DataType: 'String',
              StringValue: process.env.AWS_SNS_SENDER_ID || 'Spendly',
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

    // Fallback to Twilio
    if (this.smsProvider === 'twilio' && this.twilioClient) {
      try {
        await this.twilioClient.messages.create({
          body: config.body,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: config.to,
        });
        console.log('SMS sent via Twilio to:', config.to);
        return;
      } catch (error) {
        console.error('Failed to send SMS via Twilio:', error);
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

  // HTML escape function to prevent XSS in email templates
  private escapeHtml(unsafe: string): string {
    if (!unsafe) return '';
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private formatEmailHtml(title: string, message: string, data?: Record<string, unknown>): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${title}</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <div style="background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); padding: 32px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Spendly</h1>
            </div>
            <div style="padding: 32px;">
              <h2 style="color: #1f2937; margin: 0 0 16px 0; font-size: 20px;">${title}</h2>
              <p style="color: #4b5563; line-height: 1.6; margin: 0 0 24px 0;">${message}</p>
              ${data?.actionUrl ? `
                <a href="${data.actionUrl}" style="display: inline-block; background-color: #4F46E5; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600;">View Details</a>
              ` : ''}
            </div>
            <div style="background-color: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                You received this email because you have notifications enabled for your Spendly account.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;
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
      message: `Your expense of ${sym}${expense.amount.toLocaleString()} at ${expense.merchant} was rejected. ${expense.reason ? `Reason: ${expense.reason}` : ''}`,
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
      message: 'Congratulations! Your identity verification has been approved. You now have full access to all Spendly features.',
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
  }): Promise<{ success: boolean; error?: string }> {
    const appUrl = process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : 'https://spendly.app';

    // Escape user inputs to prevent XSS
    const safeName = this.escapeHtml(config.name);
    const safeRole = this.escapeHtml(config.role);
    const safeDepartment = config.department ? this.escapeHtml(config.department) : '';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>You're Invited to Spendly</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to Spendly!</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="font-size: 16px;">Hi <strong>${safeName}</strong>,</p>
          <p style="font-size: 16px;">You've been invited to join your team on Spendly as a <strong>${safeRole}</strong>${safeDepartment ? ` in the ${safeDepartment} department` : ''}.</p>
          <p style="font-size: 16px;">Spendly is your team's expense management platform where you can:</p>
          <ul style="font-size: 15px; color: #555;">
            <li>Submit and track expenses</li>
            <li>Manage budgets and approvals</li>
            <li>Access virtual cards for company spending</li>
            <li>View real-time financial insights</li>
          </ul>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${appUrl}/login" style="background: #6366f1; color: white; padding: 14px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Get Started</a>
          </div>
          <p style="font-size: 14px; color: #666;">If you have any questions, please contact your team administrator${config.invitedBy ? ` or reply to this email` : ''}.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;">
          <p style="font-size: 12px; color: #999; text-align: center;">This email was sent by Spendly. If you didn't expect this invitation, you can safely ignore this email.</p>
        </div>
      </body>
      </html>
    `;

    // Use original (unescaped) values for plain text email - no XSS risk in plain text
    const text = `Hi ${config.name},

You've been invited to join your team on Spendly as a ${config.role}${config.department ? ` in the ${config.department} department` : ''}.

Get started at: ${appUrl}/login

If you have any questions, please contact your team administrator.

- The Spendly Team`;

    try {
      await this.sendEmail({
        to: config.email,
        subject: `You're invited to join Spendly`,
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
    const appUrl = process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : 'https://spendlymanager.com';

    // Escape user input to prevent XSS
    const safeName = this.escapeHtml(config.name);

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Spendly</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <div style="background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); padding: 40px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 32px;">Welcome to Spendly!</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Your financial operating system</p>
          </div>
          <div style="padding: 32px;">
            <p style="font-size: 18px; color: #1f2937;">Hi <strong>${safeName}</strong>,</p>
            <p style="color: #4b5563; line-height: 1.6; font-size: 16px;">Thank you for signing up for Spendly! We're excited to have you on board.</p>
            <p style="color: #4b5563; line-height: 1.6; font-size: 16px;">Here's what you can do with Spendly:</p>
            <ul style="color: #4b5563; line-height: 1.8; font-size: 15px;">
              <li>Track and manage expenses effortlessly</li>
              <li>Set budgets and monitor spending</li>
              <li>Create and send professional invoices</li>
              <li>Manage vendor payments and payroll</li>
              <li>Get real-time financial insights</li>
            </ul>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${appUrl}/dashboard" style="display: inline-block; background-color: #4F46E5; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">Go to Dashboard</a>
            </div>
            <p style="color: #6b7280; font-size: 14px;">Need help getting started? Check out our onboarding guide or contact our support team.</p>
          </div>
          <div style="background-color: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
              &copy; ${new Date().getFullYear()} Spendly. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await this.sendEmail({
        to: config.email,
        subject: 'Welcome to Spendly - Your Account is Ready!',
        html,
        text: `Hi ${config.name}, Welcome to Spendly! Your account has been created successfully. Visit ${appUrl}/dashboard to get started.`,
      });
      console.log('Welcome email sent to:', config.email);
      return { success: true };
    } catch (error) {
      console.error('Failed to send welcome email:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async sendPasswordResetSuccess(config: { email: string; name: string }): Promise<{ success: boolean; error?: string }> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset Successful</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <div style="background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Password Reset Successful</h1>
          </div>
          <div style="padding: 32px;">
            <p style="font-size: 16px; color: #1f2937;">Hi <strong>${config.name}</strong>,</p>
            <p style="color: #4b5563; line-height: 1.6;">Your password has been successfully reset. You can now log in with your new password.</p>
            <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 24px 0; border-radius: 4px;">
              <p style="color: #92400e; margin: 0; font-size: 14px;"><strong>Security Notice:</strong> If you didn't make this change, please contact our support team immediately.</p>
            </div>
            <p style="color: #6b7280; font-size: 14px;">For your security, we recommend using a strong, unique password.</p>
          </div>
          <div style="background-color: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} Spendly. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await this.sendEmail({
        to: config.email,
        subject: 'Your Spendly Password Has Been Reset',
        html,
        text: `Hi ${config.name}, Your password has been successfully reset. If you didn't make this change, please contact support immediately.`,
      });
      console.log('Password reset confirmation email sent to:', config.email);
      return { success: true };
    } catch (error) {
      console.error('Failed to send password reset confirmation:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async sendEmailVerification(config: { email: string; name: string; verificationLink: string }): Promise<{ success: boolean; error?: string }> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Email</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <div style="background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Verify Your Email</h1>
          </div>
          <div style="padding: 32px;">
            <p style="font-size: 16px; color: #1f2937;">Hi <strong>${config.name}</strong>,</p>
            <p style="color: #4b5563; line-height: 1.6;">Please verify your email address to complete your Spendly account setup.</p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${config.verificationLink}" style="display: inline-block; background-color: #4F46E5; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">Verify Email Address</a>
            </div>
            <p style="color: #6b7280; font-size: 14px;">This link will expire in 24 hours. If you didn't create a Spendly account, you can safely ignore this email.</p>
          </div>
          <div style="background-color: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} Spendly. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await this.sendEmail({
        to: config.email,
        subject: 'Verify Your Spendly Email Address',
        html,
        text: `Hi ${config.name}, Please verify your email by visiting: ${config.verificationLink}. This link expires in 24 hours.`,
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
    // Escape all user inputs to prevent XSS
    const safeName = this.escapeHtml(config.name);
    const safeRecipientName = this.escapeHtml(config.recipientName);
    const safeRecipientBank = config.recipientBank ? this.escapeHtml(config.recipientBank) : '';
    const safeRecipientAccount = config.recipientAccount ? this.escapeHtml(config.recipientAccount) : '';
    const safeReference = this.escapeHtml(config.reference);
    const safeDate = this.escapeHtml(config.date);
    const safeCurrency = this.escapeHtml(config.currency);

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payout Confirmation</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <div style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); padding: 32px; text-align: center;">
            <div style="font-size: 48px; margin-bottom: 10px;">✓</div>
            <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Payout Successful</h1>
          </div>
          <div style="padding: 32px;">
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
          </div>
          <div style="background-color: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} Spendly. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await this.sendEmail({
        to: config.email,
        subject: `Payout Confirmation - ${config.currency} ${config.amount.toLocaleString()} sent`,
        html,
        text: `Hi ${config.name}, Your payout of ${config.currency} ${config.amount} to ${config.recipientName} has been processed. Reference: ${config.reference}`,
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
    const itemsHtml = config.items.map(item => `
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #374151;">${item.description}</td>
        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #374151; text-align: center;">${item.quantity}</td>
        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #374151; text-align: right;">${config.currency} ${item.price.toLocaleString()}</td>
        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #374151; text-align: right;">${config.currency} ${(item.quantity * item.price).toLocaleString()}</td>
      </tr>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invoice ${config.invoiceNumber}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <div style="background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Invoice</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0;">${config.invoiceNumber}</p>
          </div>
          <div style="padding: 32px;">
            <p style="font-size: 16px; color: #1f2937;">Dear <strong>${config.clientName}</strong>,</p>
            <p style="color: #4b5563; line-height: 1.6;">Please find attached your invoice from <strong>${config.senderName}</strong>.</p>
            
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
              <p style="color: #92400e; margin: 0; font-size: 14px;"><strong>Due Date:</strong> ${config.dueDate}</p>
            </div>

            ${config.paymentLink ? `
            <div style="text-align: center; margin: 32px 0;">
              <a href="${config.paymentLink}" style="display: inline-block; background-color: #4F46E5; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">Pay Now</a>
            </div>
            ` : ''}

            <p style="color: #6b7280; font-size: 14px;">If you have any questions about this invoice, please contact us.</p>
          </div>
          <div style="background-color: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">This invoice was sent via Spendly</p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await this.sendEmail({
        to: config.email,
        subject: `Invoice ${config.invoiceNumber} from ${config.senderName} - ${config.currency} ${config.amount.toLocaleString()}`,
        html,
        text: `Invoice ${config.invoiceNumber} from ${config.senderName}. Amount: ${config.currency} ${config.amount}. Due: ${config.dueDate}.`,
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
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your Payslip</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <div style="background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Payslip</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0;">${config.payPeriod}</p>
          </div>
          <div style="padding: 32px;">
            <p style="font-size: 16px; color: #1f2937;">Dear <strong>${config.employeeName}</strong>,</p>
            <p style="color: #4b5563; line-height: 1.6;">Your salary for ${config.payPeriod} has been processed by <strong>${config.companyName}</strong>.</p>
            
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

            <p style="color: #6b7280; font-size: 14px;"><strong>Payment Date:</strong> ${config.paymentDate}</p>
            <p style="color: #6b7280; font-size: 14px;">The funds have been transferred to your registered bank account.</p>
          </div>
          <div style="background-color: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} ${config.companyName}. Powered by Spendly.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await this.sendEmail({
        to: config.email,
        subject: `Your Payslip - ${config.payPeriod}`,
        html,
        text: `Hi ${config.employeeName}, Your salary for ${config.payPeriod} has been processed. Net Pay: ${config.currency} ${config.netPay}. Payment Date: ${config.paymentDate}.`,
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
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Login Alert</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <div style="background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px;">New Login Detected</h1>
          </div>
          <div style="padding: 32px;">
            <p style="font-size: 16px; color: #1f2937;">Hi <strong>${config.name}</strong>,</p>
            <p style="color: #4b5563; line-height: 1.6;">We detected a new login to your Spendly account.</p>
            <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin: 24px 0;">
              <p style="margin: 8px 0; color: #374151;"><strong>Time:</strong> ${config.loginTime}</p>
              ${config.device ? `<p style="margin: 8px 0; color: #374151;"><strong>Device:</strong> ${config.device}</p>` : ''}
              ${config.ipAddress ? `<p style="margin: 8px 0; color: #374151;"><strong>IP Address:</strong> ${config.ipAddress}</p>` : ''}
              ${config.location ? `<p style="margin: 8px 0; color: #374151;"><strong>Location:</strong> ${config.location}</p>` : ''}
            </div>
            <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 24px 0; border-radius: 4px;">
              <p style="color: #92400e; margin: 0; font-size: 14px;"><strong>Wasn't you?</strong> If you didn't log in, please change your password immediately and contact support.</p>
            </div>
          </div>
          <div style="background-color: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} Spendly. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await this.sendEmail({
        to: config.email,
        subject: 'New Login to Your Spendly Account',
        html,
        text: `Hi ${config.name}, A new login was detected on your Spendly account at ${config.loginTime}. If this wasn't you, please change your password immediately.`,
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
    
    const message = `Spendly: ${typeLabel} ${sign}${config.currency}${config.amount.toLocaleString()} - ${config.description}.${balanceText}`;

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
}

export const notificationService = new NotificationService();
